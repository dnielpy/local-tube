#!/bin/sh
# Updates a production deployment: stops the containers, pulls the latest code and starts everything again.
# Usage, from anywhere: ./scripts/update.sh
set -eu

cd "$(dirname "$0")/.."

if [ ! -f .env.production ]; then
    echo "Missing .env.production (copy .env.production.example and fill it in)" >&2
    exit 1
fi

compose() {
    docker compose -f docker-compose.prod.yml --env-file .env.production "$@"
}

media_path=$(sed -n 's/^MEDIA_PATH=//p' .env.production)
if [ ! -d "$media_path" ]; then
    echo "MEDIA_PATH ($media_path) is not a folder: is the drive mounted?" >&2
    exit 1
fi

echo "==> Stopping containers"
compose down

echo "==> Pulling latest code"
git pull --ff-only

echo "==> Building and starting containers"
# A new value every day makes the build fetch the latest yt-dlp.
YTDLP_REFRESH=$(date +%Y-%m-%d) compose up -d --build --wait

compose ps
