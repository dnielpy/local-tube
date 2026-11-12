"""Opens Chromium for one LocalTube profile at a time and reports its YouTube session.

The api is the only client: it opens a session when someone starts signing in, polls it
until YouTube's login cookies show up, and then closes it. Chromium only runs in between.
"""

import asyncio
import itertools
import json
import logging
import os
import re
import shutil
import subprocess
import threading
import time
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import websockets

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("control")

PROFILES = Path(os.environ.get("PROFILES_DIR", "/data/profiles"))
PORT = int(os.environ.get("CONTROL_PORT", "9000"))
DEBUG_PORT = 9222
LOGIN_URL = (
    "https://accounts.google.com/ServiceLogin?service=youtube&hl=es"
    "&continue=https%3A%2F%2Fwww.youtube.com%2Fsignin%3Faction_handle_signin%3Dtrue"
    "%26next%3D%252F"
)
SIGNED_IN_COOKIES = {"SAPISID", "LOGIN_INFO"}
COOKIE_DOMAINS = ("youtube.com", "google.com")
UUID = re.compile(r"^[0-9a-f-]{36}$")

ACCOUNT_SCRIPT = """
(async () => {
  try {
    const text = await (await fetch('/getAccountSwitcherEndpoint')).text();
    const data = JSON.parse(text.replace(/^\\)\\]\\}'/, ''));
    const sections = data.data.actions[0].getMultiPageMenuAction.menu
      .multiPageMenuRenderer.sections;
    for (const section of sections) {
      for (const group of section.accountSectionListRenderer?.contents ?? []) {
        for (const entry of group.accountItemSectionRenderer?.contents ?? []) {
          const item = entry.accountItem;
          if (item && item.isSelected) {
            const photos = item.accountPhoto.thumbnails;
            return {name: item.accountName.simpleText, avatar: photos[photos.length - 1].url};
          }
        }
      }
    }
  } catch (e) {}
  const img = document.querySelector('#avatar-btn img');
  return img && img.src ? {name: null, avatar: img.src} : null;
})()
"""


class Session:
    def __init__(self, profile_id: str) -> None:
        self.profile_id = profile_id
        self.data_dir = PROFILES / profile_id / "chromium"
        self.process: subprocess.Popen | None = None
        self.account: dict | None = None

    def start(self) -> None:
        self.data_dir.mkdir(parents=True, exist_ok=True)
        # A crash leaves these behind and Chromium then refuses to open the profile.
        for lock in ("SingletonLock", "SingletonCookie", "SingletonSocket"):
            (self.data_dir / lock).unlink(missing_ok=True)
        self.process = subprocess.Popen(
            [
                shutil.which("chromium") or "chromium",
                f"--user-data-dir={self.data_dir}",
                f"--remote-debugging-port={DEBUG_PORT}",
                "--remote-debugging-address=127.0.0.1",
                "--password-store=basic",
                "--no-first-run",
                "--no-default-browser-check",
                "--no-sandbox",
                "--start-maximized",
                "--lang=es",
                LOGIN_URL,
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

    def running(self) -> bool:
        return self.process is not None and self.process.poll() is None

    def stop(self) -> None:
        if not self.running():
            return
        try:
            asyncio.run(_browser_call("Browser.close"))
            self.process.wait(10)
        except Exception:
            self.process.terminate()
            try:
                self.process.wait(10)
            except subprocess.TimeoutExpired:
                self.process.kill()


_lock = threading.Lock()
_current: Session | None = None
_ids = itertools.count(1)


def _debugger_url() -> str:
    deadline = time.monotonic() + 15
    while True:
        try:
            url = f"http://127.0.0.1:{DEBUG_PORT}/json/version"
            with urllib.request.urlopen(url, timeout=2) as response:
                return json.load(response)["webSocketDebuggerUrl"]
        except OSError:
            if time.monotonic() > deadline:
                raise
            time.sleep(0.3)


async def _send(ws, method: str, params: dict | None = None, session_id: str | None = None):
    message_id = next(_ids)
    message: dict = {"id": message_id, "method": method, "params": params or {}}
    if session_id:
        message["sessionId"] = session_id
    await ws.send(json.dumps(message))
    while True:
        reply = json.loads(await ws.recv())
        if reply.get("id") == message_id:
            if "error" in reply:
                raise RuntimeError(reply["error"].get("message", "CDP error"))
            return reply.get("result", {})


async def _browser_call(method: str, params: dict | None = None) -> dict:
    async with websockets.connect(_debugger_url(), max_size=None) as ws:
        return await _send(ws, method, params)


async def _cookies() -> list[dict]:
    result = await _browser_call("Storage.getCookies")
    return [
        cookie
        for cookie in result.get("cookies", [])
        if cookie["domain"].lstrip(".").endswith(COOKIE_DOMAINS)
    ]


async def _account() -> dict | None:
    """Open YouTube in a background tab and read the signed-in account's name and photo."""
    async with websockets.connect(_debugger_url(), max_size=None) as ws:
        target = await _send(
            ws, "Target.createTarget", {"url": "https://www.youtube.com/", "background": True}
        )
        session = await _send(
            ws, "Target.attachToTarget", {"targetId": target["targetId"], "flatten": True}
        )
        session_id = session["sessionId"]
        try:
            for _ in range(30):
                await asyncio.sleep(1)
                result = await _send(
                    ws,
                    "Runtime.evaluate",
                    {"expression": ACCOUNT_SCRIPT, "awaitPromise": True, "returnByValue": True},
                    session_id,
                )
                value = result.get("result", {}).get("value")
                if value and value.get("avatar"):
                    return value
            return None
        finally:
            await _send(ws, "Target.closeTarget", {"targetId": target["targetId"]})


def netscape(cookies: list[dict]) -> str:
    lines = ["# Netscape HTTP Cookie File"]
    for cookie in cookies:
        domain = cookie["domain"]
        expires = int(cookie["expires"]) if cookie.get("expires", -1) > 0 else 0
        lines.append(
            "\t".join(
                [
                    domain,
                    "TRUE" if domain.startswith(".") else "FALSE",
                    cookie.get("path") or "/",
                    "TRUE" if cookie.get("secure") else "FALSE",
                    str(expires),
                    cookie["name"],
                    cookie["value"],
                ]
            )
        )
    return "\n".join(lines) + "\n"


def status() -> dict:
    session = _current
    if session is None or not session.running():
        return {"profile_id": session.profile_id if session else None, "running": False}
    cookies = asyncio.run(_cookies())
    names = {cookie["name"] for cookie in cookies if "youtube.com" in cookie["domain"]}
    signed_in = SIGNED_IN_COOKIES <= names
    body: dict = {"profile_id": session.profile_id, "running": True, "signed_in": signed_in}
    if signed_in:
        if session.account is None:
            try:
                session.account = asyncio.run(_account()) or {}
            except Exception:
                logger.exception("could not read the YouTube account")
                session.account = {}
        body["cookies"] = netscape(cookies)
        body["name"] = session.account.get("name")
        body["avatar_url"] = session.account.get("avatar")
    return body


class Handler(BaseHTTPRequestHandler):
    def _reply(self, code: int, body: dict | None = None) -> None:
        if code == 204:
            self.send_response(code)
            self.end_headers()
            return
        payload = json.dumps(body or {}).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self) -> None:
        if self.path != "/session":
            return self._reply(404)
        with _lock:
            try:
                self._reply(200, status())
            except Exception as exc:
                logger.exception("could not read the session")
                self._reply(502, {"error": str(exc)})

    def do_POST(self) -> None:
        global _current
        if self.path != "/session":
            return self._reply(404)
        length = int(self.headers.get("Content-Length") or 0)
        profile_id = str(json.loads(self.rfile.read(length) or b"{}").get("profile_id", ""))
        if not UUID.match(profile_id):
            return self._reply(422, {"error": "profile_id must be a uuid"})
        with _lock:
            if _current is not None:
                _current.stop()
            _current = Session(profile_id)
            _current.start()
            logger.info("opened Chromium for %s", profile_id)
        self._reply(201, {"profile_id": profile_id, "running": True})

    def do_DELETE(self) -> None:
        global _current
        if self.path != "/session":
            return self._reply(404)
        with _lock:
            if _current is not None:
                _current.stop()
                logger.info("closed Chromium for %s", _current.profile_id)
            _current = None
        self._reply(204)

    def log_message(self, format: str, *args) -> None:
        pass


if __name__ == "__main__":
    PROFILES.mkdir(parents=True, exist_ok=True)
    logger.info("listening on %s", PORT)
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
