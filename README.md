# LocalTube

A YouTube clone for the home network. Browse a library of videos stored on a local hard drive, watch them with a YouTube-style player, and download new ones from YouTube by pasting a link (yt-dlp does the downloading).

- `apps/api`: FastAPI, PostgreSQL (SQLAlchemy 2 + Alembic) and yt-dlp. It serves the library, streams the videos with HTTP Range support, and runs a background download queue.
- `apps/web`: Next.js with Tailwind, built to look like youtube.com: home grid, search results, watch page with a custom player, and a downloads page.

The monorepo uses Turborepo with pnpm workspaces. The Python app is plugged into turbo through a small `package.json` that calls `uv`.

## Deploying on the server

Requirements: Docker with the Compose plugin, and the external drive mounted on the server.

```bash
cp .env.production.example .env.production
# Edit .env.production: a strong POSTGRES_PASSWORD and MEDIA_PATH, the folder on the external drive.
mkdir -p /mnt/disco/localtube   # the MEDIA_PATH folder, on the mounted drive
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build --wait
```

`MEDIA_PATH` must exist before the containers start. If the drive is not mounted, the api refuses to start instead of saving the videos on the system disk. Mount the drive at boot (for example with an `/etc/fstab` entry using `nofail`) so LocalTube finds it after a restart.

To update a running deployment later, run `./scripts/update.sh`. It checks that `MEDIA_PATH` is there, stops the containers, runs `git pull`, and builds and starts them again, waiting until they are healthy. The build also fetches the latest yt-dlp, once a day at most. The database, the profiles with their cookies and the videos are kept.

LocalTube is now at `http://<server-ip>:3004` (`WEB_PORT`). Caddy serves it and sends `/api/*` to FastAPI and everything else to Next.js. The api is also exposed alone on `API_PORT` (3005).

Videos are saved under `MEDIA_PATH/<youtube id>/video.mp4`, next to their `thumbnail.jpg`. The database stores the paths relative to that folder, so the drive can be mounted somewhere else later.

Before a download starts, LocalTube analyzes the video (`GET /api/downloads/formats`) and opens a dialog with every resolution YouTube offers and its approximate size. The sizes come from the same yt-dlp format selection the download uses. 360p is preselected; `DEFAULT_MAX_HEIGHT` changes that default, which also applies to API requests that do not choose a quality.

### Profiles

LocalTube opens on a "¿Quién está viendo?" screen, like Netflix. Every profile has its own library, downloads, YouTube subscriptions and watch progress, and opens with a 4-digit PIN. Five wrong PINs lock the profile for a minute. A session lasts 30 days on each device. A video downloaded by two profiles is stored once on the drive, and deleting it from one library keeps the file for the other.

To create a profile, choose a name and a PIN, and then paste the YouTube cookies of your account (or choose the file):

1. In a private/incognito window, log in to YouTube, open `https://www.youtube.com/robots.txt` in that same tab, and export the cookies for youtube.com in Netscape format, for example with the "Get cookies.txt LOCALLY" extension.
2. Close the private window without logging out, so YouTube does not rotate those cookies.

Do not copy them from your everyday browser: YouTube rotates the account cookies of every open YouTube tab, and a copy taken from a session that stays open stops working within minutes (yt-dlp then warns that "the provided YouTube account cookies are no longer valid"). A session exported this way and used only by LocalTube lasts weeks; yt-dlp keeps the cookies it renews in the profile's `cookies.txt`.

LocalTube checks that the cookies hold a signed-in YouTube session, saves them in the `localtube-config` volume (`/config/profiles/<id>/cookies.txt`), takes the account's photo as the profile photo and syncs the subscriptions. yt-dlp uses them for that profile's downloads and subscriptions, and saves the cookies YouTube renews along the way. When they expire ("Sign in to confirm you're not a bot"), export them again and use "Actualizar cookies de YouTube" in the profile menu.

The first profile created takes over the videos and downloads that existed before profiles.

YouTube changes often, and yt-dlp has to keep up. When downloads start failing, run `./scripts/update.sh`: the api image is rebuilt with the latest yt-dlp.

## Online and offline

The api checks every minute whether it can reach YouTube (`GET https://www.youtube.com/generate_204`, an empty response). The sidebar shows the result. Its "Modo sin conexión" switch forces offline mode even when the network works, so LocalTube does not spend any data.

- **Online:** the sidebar lists the profile's real YouTube subscriptions in YouTube's order. A channel page shows the channel's banner, avatar, subscribers and description, its latest 10 videos (each can be opened on YouTube or downloaded), and the videos you have downloaded from it.
- **Offline:** the sidebar stays exactly the same, built from the cached subscriptions. The only difference is inside a channel: instead of its latest 10 videos, the page shows the videos you have downloaded from it, with the cached banner and avatar. Queued downloads wait and start on their own when the connection comes back.

### Feed

In Ajustes → Feed you choose channels from your subscriptions and how often they are checked (every 6 h by default). Online, the home page then opens on the feed: the latest video of each of those channels, newest first, with "Descargado" on the ones already in your library. Premieres and live streams are skipped until they can be downloaded. The ↻ button in the top bar checks every channel right away. Offline, or with the "Todos" chip, the home page shows your downloaded videos as before.

The api refreshes each profile's feed by itself once the interval passes, even when nobody has LocalTube open, so the feed is ready when you come in. A channel whose page was fetched within the interval, for example because you opened it, is not asked again.

Until the subscriptions have been synced once, the sidebar lists the channels you have downloaded videos from.

Everything that comes from YouTube is cached so it is fetched as rarely as possible:

| What | Where | Refreshed |
| --- | --- | --- |
| Subscriptions | `channels` table | Every 24 h, or with ↻ |
| A channel's latest 10 videos and its info | `channels`, `channel_videos` | When the page is opened and the cache is older than 6 h, or with "Actualizar" |
| The feed's channels | `channels`, `channel_videos` | Every feed interval (6 h by default), or with ↻ |
| Avatars (176 px), banners (1280 px wide) and thumbnails (320×180) | `MEDIA_PATH/.cache/` | Only when YouTube changes the image |

Channel data comes from yt-dlp in flat mode: one request for all subscriptions and one per channel page, with no extra request per video. The browser never talks to YouTube directly. Every image is served by the api from its cache.

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

Copy `apps/api/.env.example` to `apps/api/.env`. Profiles and their cookies are kept in `./config/profiles`.

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
| POST | `/api/profiles` `{name, pin, cookies}` | Creates a profile with its YouTube cookies and signs in |
| POST | `/api/profiles/{id}/unlock` `{pin}` | Starts a session (HttpOnly cookie, 30 days) |
| PUT | `/api/profiles/{id}/cookies` `{cookies}` | Replaces the profile's YouTube cookies |
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
| GET | `/api/feed` | The latest video of each feed channel. Starts a refresh when it is due |
| POST | `/api/feed/refresh` | Checks every feed channel now |
| GET / PUT | `/api/feed/channels` `{channel_ids}` | The subscriptions, marking the ones in the feed / chooses them |
| GET / PUT | `/api/feed/settings` `{refresh_hours}` | How often the feed is refreshed: 1, 2, 3, 6, 12 or 24 h |

Downloads are rows in `download_jobs`. A worker inside the api process claims them with `SELECT … FOR UPDATE SKIP LOCKED`. `DOWNLOAD_CONCURRENCY` controls how many run at once. Jobs interrupted by a restart go back to the queue.

### Player shortcuts

The player uses the same keys as youtube.com: `k`/space play/pause, `j`/`l` ±10 s, ←/→ ±5 s, ↑/↓ volume, `m` mute, `f` fullscreen, `t` theater mode, `0`–`9` jump to 0–90 %, `Shift+N` next video, `Shift+<`/`>` speed.
