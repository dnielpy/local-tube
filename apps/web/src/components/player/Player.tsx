"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import type { Video } from "@/lib/api";
import { formatDuration } from "@/lib/format";
import { readPosition, savePosition } from "@/lib/watch-progress";

import {
  FullscreenExitIcon,
  FullscreenIcon,
  NextIcon,
  PauseIcon,
  PlayIcon,
  ReplayIcon,
  SettingsIcon,
  TheaterExitIcon,
  TheaterIcon,
  VolumeHighIcon,
  VolumeLowIcon,
  VolumeMutedIcon,
} from "../icons";
import { ProgressBar } from "./ProgressBar";
import { SettingsMenu } from "./SettingsMenu";

const VOLUME_KEY = "localtube:volume";
const HIDE_AFTER_MS = 3000;
const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

type Bezel = { id: number; kind: "play" | "pause" } | null;
type Toast = { id: number; text: string; side?: "left" | "right" } | null;

function readVolume(): { volume: number; muted: boolean } {
  try {
    const saved = JSON.parse(localStorage.getItem(VOLUME_KEY) ?? "null");
    if (saved && typeof saved.volume === "number") return saved;
  } catch {}
  return { volume: 1, muted: false };
}

export function Player({
  video,
  theater,
  onToggleTheater,
  onNext,
}: {
  video: Video;
  theater: boolean;
  onToggleTheater: () => void;
  onNext?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(video.duration_seconds ?? 0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [bezel, setBezel] = useState<Bezel>(null);
  const [toast, setToast] = useState<Toast>(null);

  const el = () => videoRef.current;

  const flashToast = useCallback((text: string, side?: "left" | "right") => {
    setToast({ id: Date.now(), text, side });
  }, []);

  // ---- playback actions -------------------------------------------------------------------

  const togglePlay = useCallback(() => {
    const v = el();
    if (!v) return;
    if (v.paused || v.ended) {
      v.play().catch(() => {});
      setBezel({ id: Date.now(), kind: "play" });
    } else {
      v.pause();
      setBezel({ id: Date.now(), kind: "pause" });
    }
  }, []);

  const seekTo = useCallback((time: number) => {
    const v = el();
    if (!v || !Number.isFinite(v.duration)) return;
    v.currentTime = Math.min(Math.max(time, 0), v.duration);
    setCurrent(v.currentTime);
  }, []);

  const seekBy = useCallback(
    (delta: number) => {
      const v = el();
      if (!v) return;
      seekTo(v.currentTime + delta);
      flashToast(`${Math.abs(delta)} segundos`, delta < 0 ? "left" : "right");
    },
    [seekTo, flashToast],
  );

  const applyVolume = useCallback((next: number, nextMuted: boolean) => {
    const v = el();
    const clamped = Math.min(Math.max(next, 0), 1);
    if (v) {
      v.volume = clamped;
      v.muted = nextMuted;
    }
    setVolume(clamped);
    setMuted(nextMuted);
    try {
      localStorage.setItem(VOLUME_KEY, JSON.stringify({ volume: clamped, muted: nextMuted }));
    } catch {}
  }, []);

  const toggleMute = useCallback(() => {
    if (muted || volume === 0) applyVolume(volume || 1, false);
    else applyVolume(volume, true);
  }, [muted, volume, applyVolume]);

  const changeRate = useCallback((next: number) => {
    const v = el();
    if (v) v.playbackRate = next;
    setRate(next);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    const v = el() as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (!container) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else if (container.requestFullscreen) {
      container.requestFullscreen().catch(() => {});
    } else {
      // iOS Safari only lets the <video> element itself go fullscreen.
      v?.webkitEnterFullscreen?.();
    }
  }, []);

  // ---- controls auto-hide -----------------------------------------------------------------

  const showControls = useCallback(() => {
    setControlsVisible(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (!el()?.paused) setControlsVisible(false);
    }, HIDE_AFTER_MS);
  }, []);

  useEffect(() => () => clearTimeout(hideTimer.current), []);

  const showAll = !playing || settingsOpen || controlsVisible;

  // ---- media element setup ----------------------------------------------------------------

  useEffect(() => {
    const v = el();
    if (!v) return;
    const saved = readVolume();
    v.volume = saved.volume;
    v.muted = saved.muted;
    setVolume(saved.volume);
    setMuted(saved.muted);
  }, []);

  useEffect(() => {
    const v = el();
    if (!v) return;
    const save = () => savePosition(video.id, v.currentTime, v.duration);
    const interval = setInterval(() => !v.paused && save(), 5000);
    v.addEventListener("pause", save);
    window.addEventListener("pagehide", save);
    return () => {
      save();
      clearInterval(interval);
      v.removeEventListener("pause", save);
      window.removeEventListener("pagehide", save);
    };
  }, [video.id]);

  function onLoadedMetadata() {
    const v = el();
    if (!v) return;
    setDuration(v.duration);
    v.playbackRate = rate;
    const saved = readPosition(video.id);
    if (saved && saved.time < v.duration - 10) v.currentTime = saved.time;
    v.play().catch(() => {});
  }

  function onProgress() {
    const v = el();
    if (!v || v.buffered.length === 0) return;
    for (let i = 0; i < v.buffered.length; i++) {
      if (v.buffered.start(i) <= v.currentTime && v.currentTime <= v.buffered.end(i)) {
        setBuffered(v.buffered.end(i));
        return;
      }
    }
  }

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // ---- keyboard shortcuts (the same ones youtube.com uses) --------------------------------

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, [contenteditable=true]")) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const v = el();
      if (!v) return;

      if (event.shiftKey) {
        if (event.key === ">" || event.key === "<") {
          const index = SPEEDS.indexOf(v.playbackRate);
          const next =
            SPEEDS[Math.min(Math.max(index + (event.key === ">" ? 1 : -1), 0), SPEEDS.length - 1)];
          changeRate(next);
          flashToast(`${next}x`);
          event.preventDefault();
        } else if (event.key.toLowerCase() === "n" && onNext) {
          onNext();
        }
        return;
      }

      const handled = (() => {
        switch (event.key.toLowerCase()) {
          case " ":
          case "k":
            togglePlay();
            return true;
          case "j":
            seekBy(-10);
            return true;
          case "l":
            seekBy(10);
            return true;
          case "arrowleft":
            seekBy(-5);
            return true;
          case "arrowright":
            seekBy(5);
            return true;
          case "arrowup":
          case "arrowdown": {
            const next =
              Math.round((v.volume + (event.key === "ArrowUp" ? 0.05 : -0.05)) * 100) / 100;
            applyVolume(next, false);
            flashToast(`${Math.round(Math.min(Math.max(next, 0), 1) * 100)}%`);
            return true;
          }
          case "m":
            toggleMute();
            return true;
          case "f":
            toggleFullscreen();
            return true;
          case "t":
            onToggleTheater();
            return true;
          case "home":
            seekTo(0);
            return true;
          case "end":
            seekTo(v.duration);
            return true;
          default:
            if (/^[0-9]$/.test(event.key)) {
              seekTo((Number(event.key) / 10) * v.duration);
              return true;
            }
            return false;
        }
      })();

      if (handled) {
        event.preventDefault();
        showControls();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    togglePlay,
    seekBy,
    seekTo,
    applyVolume,
    toggleMute,
    toggleFullscreen,
    onToggleTheater,
    onNext,
    changeRate,
    flashToast,
    showControls,
  ]);

  // ---- touch: tap shows controls, double tap on a side skips 10 seconds -------------------

  const lastTap = useRef(0);
  function onSurfacePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse") return;
    const now = Date.now();
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    if (now - lastTap.current < 300 && (x < 0.35 || x > 0.65)) {
      seekBy(x < 0.5 ? -10 : 10);
      lastTap.current = 0;
      return;
    }
    lastTap.current = now;
    if (controlsVisible && playing) setControlsVisible(false);
    else showControls();
  }

  const volumeIcon =
    muted || volume === 0 ? (
      <VolumeMutedIcon size={36} />
    ) : volume < 0.5 ? (
      <VolumeLowIcon size={36} />
    ) : (
      <VolumeHighIcon size={36} />
    );

  return (
    <div
      ref={containerRef}
      className={`group/player relative overflow-hidden bg-black select-none ${
        fullscreen
          ? "h-full w-full"
          : theater
            ? "h-full w-full"
            : "aspect-video w-full rounded-none search:rounded-xl"
      } ${showAll ? "" : "cursor-none"}`}
      onMouseMove={showControls}
      onMouseLeave={() => playing && !settingsOpen && setControlsVisible(false)}
    >
      <video
        ref={videoRef}
        src={video.stream_url}
        poster={video.thumbnail_url ?? undefined}
        preload="metadata"
        playsInline
        className="absolute inset-0 size-full object-contain"
        onLoadedMetadata={onLoadedMetadata}
        onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
        onProgress={onProgress}
        onPlay={() => {
          setPlaying(true);
          setEnded(false);
          showControls();
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setEnded(true);
          savePosition(video.id, 0, 0);
        }}
        onWaiting={() => setWaiting(true)}
        onPlaying={() => setWaiting(false)}
        onCanPlay={() => setWaiting(false)}
        onRateChange={(event) => setRate(event.currentTarget.playbackRate)}
      />

      {/* Click surface: click toggles play, double click toggles fullscreen. */}
      <div
        className="absolute inset-0"
        onClick={(event) => {
          // Touch is handled in onPointerUp; a tap there only shows the controls.
          const pointer = (event.nativeEvent as PointerEvent).pointerType;
          if (pointer && pointer !== "mouse") return;
          if (settingsOpen) setSettingsOpen(false);
          else togglePlay();
        }}
        onDoubleClick={toggleFullscreen}
        onPointerUp={onSurfacePointerUp}
      />

      {waiting && playing && (
        <div className="pointer-events-none absolute top-1/2 left-1/2 size-16 -translate-x-1/2 -translate-y-1/2">
          <div className="size-full rounded-full border-4 border-white/25 border-t-white [animation:yt-spin_1s_linear_infinite]" />
        </div>
      )}

      {bezel && (
        <div
          key={bezel.id}
          className="pointer-events-none absolute top-1/2 left-1/2 flex size-[52px] items-center justify-center rounded-full bg-black/50 text-white [animation:yt-bezel_0.5s_linear_forwards]"
        >
          {bezel.kind === "play" ? <PlayIcon size={52} /> : <PauseIcon size={52} />}
        </div>
      )}

      {toast && (
        <div
          key={toast.id}
          className={`pointer-events-none absolute top-1/2 -translate-y-1/2 rounded-full bg-black/50 px-4 py-2 text-sm font-medium text-white [animation:yt-fade_0.9s_linear_forwards] ${
            toast.side === "left"
              ? "left-[10%]"
              : toast.side === "right"
                ? "right-[10%]"
                : "top-[15%] left-1/2 -translate-x-1/2"
          }`}
          onAnimationEnd={() => setToast(null)}
        >
          {toast.side === "left" && "◀◀ "}
          {toast.text}
          {toast.side === "right" && " ▶▶"}
        </div>
      )}

      {/* Bottom chrome: gradient, progress bar and the control row. */}
      <div
        className={`absolute inset-x-0 bottom-0 transition-opacity duration-200 ${
          showAll ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[98px] bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

        <SettingsMenu
          open={settingsOpen}
          rate={rate}
          speeds={SPEEDS}
          onRate={(next) => {
            changeRate(next);
            setSettingsOpen(false);
          }}
          onClose={() => setSettingsOpen(false)}
        />

        <div className="relative px-3">
          <ProgressBar current={current} duration={duration} buffered={buffered} onSeek={seekTo} />
          <div className="flex h-12 items-center text-white">
            <ControlButton
              label={ended ? "Volver a ver" : playing ? "Pausar (k)" : "Reproducir (k)"}
              onClick={togglePlay}
            >
              {ended ? (
                <ReplayIcon size={36} />
              ) : playing ? (
                <PauseIcon size={36} />
              ) : (
                <PlayIcon size={36} />
              )}
            </ControlButton>
            {onNext && (
              <ControlButton label="Siguiente (Mayús + N)" onClick={onNext}>
                <NextIcon size={36} />
              </ControlButton>
            )}

            <div className="group/volume flex items-center">
              <ControlButton
                label={muted ? "Activar sonido (m)" : "Silenciar (m)"}
                onClick={toggleMute}
              >
                {volumeIcon}
              </ControlButton>
              <div className="w-0 overflow-hidden transition-[width] duration-200 group-hover/volume:w-[60px] group-focus-within/volume:w-[60px]">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={muted ? 0 : volume}
                  aria-label="Volumen"
                  onChange={(event) => applyVolume(Number(event.target.value), false)}
                  className="mx-1 h-1 w-[52px] cursor-pointer appearance-none rounded-full bg-white/30 accent-white [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                  style={{
                    background: `linear-gradient(to right, #fff ${(muted ? 0 : volume) * 100}%, rgba(255,255,255,.2) ${(muted ? 0 : volume) * 100}%)`,
                  }}
                />
              </div>
            </div>

            <div className="px-[5px] text-[13px] leading-[47px] whitespace-nowrap [text-shadow:0_0_2px_rgba(0,0,0,.5)]">
              <span>{formatDuration(current)}</span>
              <span className="px-1 text-white/70">/</span>
              <span className="text-white/90">{formatDuration(duration)}</span>
            </div>

            <div className="ml-auto flex items-center">
              <ControlButton
                label="Configuración"
                onClick={() => setSettingsOpen((value) => !value)}
                className={settingsOpen ? "[&_svg]:rotate-[30deg]" : ""}
              >
                <SettingsIcon size={36} className="transition-transform duration-100" />
              </ControlButton>
              {!fullscreen && (
                <ControlButton
                  label={theater ? "Vista predeterminada (t)" : "Modo cine (t)"}
                  onClick={onToggleTheater}
                  className="hidden watch:flex"
                >
                  {theater ? <TheaterExitIcon size={36} /> : <TheaterIcon size={36} />}
                </ControlButton>
              )}
              <ControlButton
                label={fullscreen ? "Salir de pantalla completa (f)" : "Pantalla completa (f)"}
                onClick={toggleFullscreen}
              >
                {fullscreen ? <FullscreenExitIcon size={36} /> : <FullscreenIcon size={36} />}
              </ControlButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ControlButton({
  label,
  onClick,
  children,
  className = "",
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`group/btn relative flex h-12 w-12 shrink-0 items-center justify-center opacity-90 hover:opacity-100 ${className}`}
    >
      {children}
      <span className="pointer-events-none absolute bottom-[58px] left-1/2 hidden -translate-x-1/2 rounded bg-[rgba(28,28,28,0.9)] px-2 py-[5px] text-xs font-medium whitespace-nowrap text-[#eee] group-hover/btn:block">
        {label}
      </span>
    </button>
  );
}
