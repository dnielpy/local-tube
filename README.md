# LocalTube

A YouTube clone for the home network. Browse a library of videos stored on a local hard drive, watch them with a YouTube-style player, and download new ones from YouTube by pasting a link (yt-dlp does the downloading).

- `apps/api`: FastAPI, PostgreSQL (SQLAlchemy 2 + Alembic) and yt-dlp. It serves the library, streams the videos with HTTP Range support, and runs a background download queue.
- `apps/web`: Next.js with Tailwind, built to look like youtube.com: home grid, search results, watch page with a custom player, and a downloads page.
- `apps/browser`: a Chromium you see inside LocalTube (KasmVNC), used only to sign profiles in to YouTube.

The monorepo uses Turborepo with pnpm workspaces. The Python app is plugged into turbo through a small `package.json` that calls `uv`.

## Deploying on the server

Requirements: Docker with the Compose plugin.

```bash
cp .env.example .env
# Edit .env: POSTGRES_PASSWORD and MEDIA_PATH (folder on the external drive).
docker compose up -d --build
```

LocalTube is now at `http://<server-ip>` (or the `PORT` you chose). Caddy is the only exposed service. It sends `/api/*` to FastAPI and everything else to Next.js.

Videos are saved under `MEDIA_PATH/<youtube id>/video.mp4`, next to their `thumbnail.jpg`. The database stores the paths relative to that folder, so the drive can be mounted somewhere else later.

Before a download starts, LocalTube analyzes the video (`GET /api/downloads/formats`) and opens a dialog with every resolution YouTube offers and its approximate size. The sizes come from the same yt-dlp format selection the download uses. 360p is preselected; `DEFAULT_MAX_HEIGHT` changes that default, which also applies to API requests that do not choose a quality.

### Profiles

LocalTube opens on a "¿Quién está viendo?" screen, like Netflix. Every profile has its own library, downloads, YouTube subscriptions and watch progress, and opens with a 4-digit PIN. Five wrong PINs lock the profile for a minute. A video downloaded by two profiles is stored once on the drive, and deleting it from one library keeps the file for the other.

Creating a profile needs a connection, because every profile signs in to YouTube:

1. "Agregar perfil": choose a name and a PIN.
2. A real Chromium opens inside the page. Sign in to your Google account there, as on any computer.
3. As soon as YouTube's session cookies show up, LocalTube saves them for the profile, takes the account's photo as the profile photo, closes Chromium and syncs the subscriptions.

The cookies are kept in the `localtube-config` volume (`/config/profiles/<id>/cookies.txt`) and yt-dlp uses them for that profile's downloads and subscriptions. yt-dlp also saves the cookies YouTube renews along the way. When they expire anyway ("Sign in to confirm you're not a bot"), use "Volver a iniciar sesión en YouTube" in the profile menu: Chromium reopens with the same profile, usually already signed in.

The `browser` container stays up with an empty desktop (about 100 MB). Chromium only runs during a sign-in. Caddy serves it at `/browser/` only to the profile that is signing in at that moment.

The first profile created takes over the videos and downloads that existed before profiles.

YouTube changes often, and yt-dlp has to keep up. When downloads start failing, rebuild the api image to pull the latest yt-dlp:

```bash
docker compose build --no-cache api && docker compose up -d api
```

## Online and offline

The api checks every minute whether it can reach YouTube (`GET https://www.youtube.com/generate_204`, an empty response). The sidebar shows the result. Its "Modo sin conexión" switch forces offline mode even when the network works, so LocalTube does not spend any data.

- **Online:** the sidebar lists the profile's real YouTube subscriptions in YouTube's order. A channel page shows the channel's banner, avatar, subscribers and description, its latest 10 videos (each can be opened on YouTube or downloaded), and the videos you have downloaded from it.
- **Offline:** the sidebar stays exactly the same, built from the cached subscriptions. The only difference is inside a channel: instead of its latest 10 videos, the page shows the videos you have downloaded from it, with the cached banner and avatar. Queued downloads wait and start on their own when the connection comes back.

Until the subscriptions have been synced once, the sidebar lists the channels you have downloaded videos from.

Everything that comes from YouTube is cached so it is fetched as rarely as possible:

| What | Where | Refreshed |
| --- | --- | --- |
| Subscriptions | `channels` table | Every 24 h, or with ↻ |
| A channel's latest 10 videos and its info | `channels`, `channel_videos` | When the page is opened and the cache is older than 6 h, or with "Actualizar" |
| Avatars (176 px), banners (1280 px wide) and thumbnails (320×180) | `MEDIA_PATH/.cache/` | Only when YouTube changes the image |

Channel data comes from yt-dlp in flat mode: one request for all subscriptions and one per channel page, with no extra request per video. The browser never talks to YouTube directly. Every image is served by the api from its cache.

## Development

Requirements: Node 24, pnpm, [uv](https://docs.astral.sh/uv/) and Docker. To download videos outside Docker you also need `ffmpeg` and `deno` on your `PATH`.

```bash
pnpm install
(cd apps/api && uv sync)
docker compose -f docker-compose.dev.yml up -d   # Postgres on :5442, browser on :3010 and :9000
(cd apps/api && uv run alembic upgrade head)
pnpm dev                                          # api on :8000, web on :3000
```

In development, `next dev` forwards `/api` to `http://localhost:8000`. Set `API_URL` to point it somewhere else.

Copy `apps/api/.env.example` to `apps/api/.env`. `docker-compose.dev.yml` also starts the browser container: its desktop on `localhost:3010` (which `next dev` serves at `/browser/`) and its control api on `localhost:9000`. Profiles are kept in `./config/profiles`.

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
| GET | `/api/profiles` | Profiles for the picker |
| POST | `/api/profiles` `{name, pin}` | Creates a profile and opens Chromium for its YouTube sign-in |
| POST | `/api/profiles/{id}/unlock` `{pin}` | Starts a session (HttpOnly cookie, 30 days) |
| GET / POST / DELETE | `/api/profiles/{id}/youtube` | Polls, restarts or cancels the YouTube sign-in |
| DELETE | `/api/profiles/{id}` `{pin}` | Deletes a profile |
| GET / DELETE | `/api/session` | The current profile / switch profile |
| GET | `/api/videos?q=&channel=&limit=&offset=` | The profile's library, newest first |
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
