FROM python:3.12-slim

# ffmpeg merges the video and audio streams; deno is the JavaScript runtime yt-dlp
# needs to solve YouTube's player challenges.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=denoland/deno:bin-2.5.6 /deno /usr/local/bin/deno
COPY --from=ghcr.io/astral-sh/uv:0.13.6 /uv /usr/local/bin/uv

WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY alembic.ini ./
COPY alembic ./alembic
COPY app ./app

ENV PATH="/app/.venv/bin:$PATH" MEDIA_ROOT=/media
EXPOSE 8000
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips='*'"]
