"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";

import type { Video } from "@/lib/api";
import { useRecordWatch } from "@/lib/watch-progress";

import { CloseIcon, OpenPlayerIcon, PauseIcon, PlayIcon, ReplayIcon } from "./icons";
import { useOptionalPlayback, type Playback } from "./player/playback";

/**
 * The video keeps playing in a small box at the bottom right after leaving its watch page, like
 * YouTube's mini player: play/pause, close, and expand back to the watch page.
 */
export function MiniPlayer() {
  const playback = useOptionalPlayback();
  if (!playback) return null;
  return <MiniPlayerHost playback={playback} />;
}

function MiniPlayerHost({ playback }: { playback: Playback }) {
  const state = useSyncExternalStore(
    playback.subscribe,
    playback.getSnapshot,
    playback.getSnapshot,
  );
  const pathname = usePathname();
  const search = useSearchParams().toString();

  useEffect(() => {
    if (pathname !== "/watch") playback.setLastPage(search ? `${pathname}?${search}` : pathname);
  }, [playback, pathname, search]);

  if (!state.video || state.owned) return null;
  return <MiniPlayerBox playback={playback} video={state.video} href={state.href} />;
}

function MiniPlayerBox({
  playback,
  video,
  href,
}: {
  playback: Playback;
  video: Video;
  href: string;
}) {
  const router = useRouter();
  const recordWatch = useRecordWatch();
  const slotRef = useRef<HTMLDivElement>(null);
  const v = playback.element;
  const [playing, setPlaying] = useState(() => !v.paused && !v.ended);
  const [ended, setEnded] = useState(() => v.ended);
  const [progress, setProgress] = useState(() => (v.duration > 0 ? v.currentTime / v.duration : 0));

  // Moves the shared element in, in the same commit the watch page let it go, so it never stops.
  useLayoutEffect(() => {
    slotRef.current?.appendChild(v);
    if (v.paused && playback.wasPlaying) v.play().catch(() => {});
    const sync = () => {
      setPlaying(!v.paused && !v.ended);
      setEnded(v.ended);
      setProgress(v.duration > 0 ? v.currentTime / v.duration : 0);
    };
    sync();
    const events = ["play", "pause", "ended", "timeupdate", "loadedmetadata"] as const;
    events.forEach((name) => v.addEventListener(name, sync));
    return () => {
      events.forEach((name) => v.removeEventListener(name, sync));
      // A watch page taking it back keeps it playing only if it was.
      playback.wasPlaying = !v.paused && !v.ended;
    };
  }, [playback, v]);

  // Saves where the video is, as the watch page does.
  useEffect(() => {
    const save = () => recordWatch(video.id, v.currentTime, v.duration);
    const interval = setInterval(() => !v.paused && save(), 5000);
    v.addEventListener("pause", save);
    v.addEventListener("ended", save);
    window.addEventListener("pagehide", save);
    return () => {
      save();
      clearInterval(interval);
      v.removeEventListener("pause", save);
      v.removeEventListener("ended", save);
      window.removeEventListener("pagehide", save);
    };
  }, [playback, v, video.id, recordWatch]);

  function togglePlay() {
    if (v.paused || v.ended) v.play().catch(() => {});
    else v.pause();
  }

  const expand = () => router.push(href);

  const button =
    "flex size-10 items-center justify-center rounded-full text-white hover:bg-white/15 focus-visible:bg-white/15";

  return (
    <div
      role="region"
      aria-label="Reproductor en miniatura"
      className="fixed right-3 bottom-3 z-40 w-[min(400px,max(240px,60vw))] overflow-hidden rounded-xl bg-yt-menu shadow-[0_4px_32px_rgba(0,0,0,0.4)] [animation:yt-mini-in_0.2s_ease-out]"
    >
      <div className="group/mini relative aspect-video bg-black">
        <div ref={slotRef} className="absolute inset-0" />
        <button
          type="button"
          aria-label="Ampliar"
          onClick={expand}
          className="absolute inset-0 bg-black/0 transition-colors group-hover/mini:bg-black/40 pointer-coarse:bg-black/30"
        />
        <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover/mini:opacity-100 group-focus-within/mini:opacity-100 pointer-coarse:opacity-100">
          <button
            type="button"
            aria-label="Ampliar"
            title="Ampliar"
            onClick={expand}
            className={`pointer-events-auto absolute top-1 left-1 ${button}`}
          >
            <OpenPlayerIcon />
          </button>
          <button
            type="button"
            aria-label="Cerrar"
            title="Cerrar"
            onClick={() => playback.close()}
            className={`pointer-events-auto absolute top-1 right-1 ${button}`}
          >
            <CloseIcon />
          </button>
          <button
            type="button"
            aria-label={ended ? "Volver a ver" : playing ? "Pausar" : "Reproducir"}
            title={ended ? "Volver a ver" : playing ? "Pausar" : "Reproducir"}
            onClick={togglePlay}
            className="pointer-events-auto absolute top-1/2 left-1/2 flex size-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-white hover:bg-white/15"
          >
            {ended ? (
              <ReplayIcon size={52} />
            ) : playing ? (
              <PauseIcon size={52} />
            ) : (
              <PlayIcon size={52} />
            )}
          </button>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-white/20">
          <div className="h-full bg-yt-brand" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>
      <button type="button" onClick={expand} className="block w-full px-3 py-2 text-left">
        <p className="truncate text-sm font-medium">{video.title}</p>
        <p className="truncate text-xs text-yt-text-secondary">{video.channel ?? "Desconocido"}</p>
      </button>
    </div>
  );
}
