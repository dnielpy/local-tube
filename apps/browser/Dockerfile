FROM lscr.io/linuxserver/baseimage-kasmvnc:debianbookworm

ENV TITLE="LocalTube" \
    SUBFOLDER=/browser/ \
    NO_DECOR=true \
    NO_FULL=true

RUN apt-get update \
    && apt-get install -y --no-install-recommends chromium python3 python3-websockets fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

COPY control.py /app/control.py
COPY root/ /

EXPOSE 3000 9000
