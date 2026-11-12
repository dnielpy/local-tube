# LocalTube

A YouTube clone for the home network. Browse a library of videos stored on a local hard drive, watch them with a YouTube-style player, and download new ones from YouTube by pasting a link (yt-dlp does the downloading).

- `apps/api`: FastAPI, PostgreSQL (SQLAlchemy 2 + Alembic) and yt-dlp. It serves the library, streams the videos with HTTP Range support, and runs a background download queue.
- `apps/web`: Next.js with Tailwind, built to look like youtube.com: home grid, search results, watch page with a custom player, and a downloads page.

The monorepo uses Turborepo with pnpm workspaces. The Python app is plugged into turbo through a small `package.json` that calls `uv`.

## Deploying on the server

Requirements: Docker with the Compose plugin.

```bash
cp .env.example .env
# Edit .env: set POSTGRES_PASSWORD and MEDIA_PATH (the folder on the hard drive).
docker compose up -d --build
```

LocalTube is now at `http://<server-ip>` (or the `PORT` you chose). Caddy is the only exposed service. It sends `/api/*` to FastAPI and everything else to Next.js.

Videos are saved under `MEDIA_PATH/<youtube id>/video.mp4`, next to their `thumbnail.jpg`. The database stores the paths relative to that folder, so the drive can be mounted somewhere else later.

Videos download at 360p by default. The downloads page has a quality selector (360p, 480p, 720p, 1080p or the best available), and `DEFAULT_MAX_HEIGHT` changes the default for requests that do not say.

### YouTube cookies

From some networks YouTube refuses to serve videos without a signed-in session ("Sign in to confirm you're not a bot"). yt-dlp can reuse the cookies of a browser where you are logged in to YouTube:

1. In a private/incognito window, log in to YouTube, open `https://www.youtube.com/robots.txt` in that same tab, and export the cookies for youtube.com in Netscape format, for example with the "Get cookies.txt LOCALLY" extension. Then close the private window without logging out, so YouTube does not rotate those cookies.
2. Save the file on the server as `config/cookies.txt`, next to `docker-compose.yml`.
3. Add `COOKIES_FILE=/config/cookies.txt` to `.env` and run `docker compose up -d api`.
4. Retry the failed download from the downloads page.

When the cookies expire, export them again the same way.

YouTube changes often, and yt-dlp has to keep up. When downloads start failing, rebuild the api image to pull the latest yt-dlp:

```bash
docker compose build --no-cache api && docker compose up -d api
```

## Development

Requirements: Node 24, pnpm, [uv](https://docs.astral.sh/uv/) and Docker. To download videos outside Docker you also need `ffmpeg` and `deno` on your `PATH`.

```bash
pnpm install
(cd apps/api && uv sync)
docker compose -f docker-compose.dev.yml up -d   # Postgres on localhost:5442
(cd apps/api && uv run alembic upgrade head)
pnpm dev                                          # api on :8000, web on :3000
```

In development, `next dev` forwards `/api` to `http://localhost:8000`. Set `API_URL` to point it somewhere else.

Copy `apps/api/.env.example` to `apps/api/.env`. It sets `COOKIES_FROM_BROWSER=chrome`, so the api reads YouTube cookies straight from your Chrome profile. On macOS the first download asks for Keychain access to "Chrome Safe Storage": allow it.

| Command | What it does |
| --- | --- |
| `pnpm dev` | Runs the api (with reload) and the web app |
| `pnpm lint` | ruff + eslint |
| `pnpm typecheck` | TypeScript |
| `pnpm test` | pytest. It needs the dev Postgres and a `localtube_test` database: `docker compose -f docker-compose.dev.yml exec postgres createdb -U localtube localtube_test` |
| `pnpm build` | Production build of the web app |
| `pnpm --filter web generate:api` | Regenerates `apps/web/src/lib/api-types.ts` from the FastAPI OpenAPI schema |

### API

| Method | Path | |
| --- | --- | --- |
| GET | `/api/videos?q=&channel=&limit=&offset=` | Library, newest first |
| GET | `/api/videos/channels` | Channel names, most recent first |
| GET | `/api/videos/{id}` | One video |
| GET | `/api/videos/{id}/stream` | The video file, with Range support |
| GET | `/api/videos/{id}/thumbnail` | The thumbnail |
| DELETE | `/api/videos/{id}` | Removes the video and its files |
| POST | `/api/downloads` `{url}` | Queues a download. Returns 409 if the video is already in the library or already queued |
| GET | `/api/downloads` | Download history with live progress |
| POST | `/api/downloads/{id}/retry` | Re-queues a failed download |
| DELETE | `/api/downloads/{id}` | Removes a finished or failed job from the history |

Downloads are rows in `download_jobs`. A worker inside the api process claims them with `SELECT … FOR UPDATE SKIP LOCKED`. `DOWNLOAD_CONCURRENCY` controls how many run at once. Jobs interrupted by a restart go back to the queue.

### Player shortcuts

The player uses the same keys as youtube.com: `k`/space play/pause, `j`/`l` ±10 s, ←/→ ±5 s, ↑/↓ volume, `m` mute, `f` fullscreen, `t` theater mode, `0`–`9` jump to 0–90 %, `Shift+N` next video, `Shift+<`/`>` speed.
