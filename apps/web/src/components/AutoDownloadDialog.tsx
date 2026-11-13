"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";

import {
  api,
  ApiError,
  queryKeys,
  type AutoDownloadSettings,
  type Channel,
  type RemoteVideo,
  type VideoFormats,
} from "@/lib/api";
import {
  formatBytes,
  formatClock,
  formatDuration,
  nextAt,
  preferredHeight,
  qualityName,
} from "@/lib/format";

import { AlertIcon, BoltIcon, CloseIcon, DownloadIcon } from "./icons";

const DEFAULT_SETTINGS: AutoDownloadSettings = {
  max_height: 480,
  start_time: null,
  per_channel: 10,
};
// Looking for new videos fills the first half of the bar, sizing them the second.
const SEARCH_SHARE = 50;

type Item = {
  video: RemoteVideo;
  channel: Channel;
  formats: VideoFormats | null;
  height: number | null;
  checked: boolean;
};

type Scan =
  | { phase: "scanning"; label: string; progress: number; found: number }
  | { phase: "none" }
  | { phase: "empty" }
  | { phase: "review"; items: Item[] };

type Problems = { channels: number; videos: number; signIn: boolean };

function needsSignIn(error: unknown): boolean {
  return error instanceof Error && /Sign in to confirm|cookies/i.test(error.message);
}

function sizeOf(item: Item): number | null {
  const quality = item.formats?.qualities.find((q) => q.height === item.height);
  return quality?.size_bytes ?? null;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Look for the new videos of the auto-download channels, then queue the chosen ones. */
export function AutoDownloadDialog({ onClose }: { onClose: () => void }) {
  const client = useQueryClient();
  const [scan, setScan] = useState<Scan>({
    phase: "scanning",
    label: "Buscando videos nuevos…",
    progress: 0,
    found: 0,
  });
  const [problems, setProblems] = useState<Problems>({ channels: 0, videos: 0, signIn: false });
  const [queueing, setQueueing] = useState(false);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const abort = new AbortController();
    const { signal } = abort;
    const step = (label: string, progress: number, found: number) =>
      setScan({ phase: "scanning", label, progress, found });

    async function run() {
      const options = await api.autoDownloadSettings().catch(() => DEFAULT_SETTINGS);
      if (signal.aborted) return;
      setSettings(options);
      const channels = (await api.autoDownloadChannels()).filter(
        (channel) => channel.enabled && channel.id,
      );
      if (signal.aborted) return;
      if (channels.length === 0) {
        setScan({ phase: "none" });
        return;
      }
      const found: Problems = { channels: 0, videos: 0, signIn: false };
      const pending: { video: RemoteVideo; channel: Channel }[] = [];

      // One request at a time, so YouTube never sees several at once from this account.
      for (const [index, channel] of channels.entries()) {
        try {
          const result = await api.pendingVideos(channel.id!, signal);
          pending.push(...result.videos.map((video) => ({ video, channel: result.channel })));
        } catch (error) {
          if (signal.aborted) return;
          found.channels += 1;
          found.signIn ||= needsSignIn(error);
        }
        step(
          "Buscando videos nuevos…",
          ((index + 1) / channels.length) * SEARCH_SHARE,
          pending.length,
        );
      }

      const items: Item[] = [];
      let skipped = 0;
      for (const [index, { video, channel }] of pending.entries()) {
        step(
          "Calculando el peso de los videos…",
          SEARCH_SHARE + (index / pending.length) * (100 - SEARCH_SHARE),
          pending.length - skipped,
        );
        try {
          const formats = await api.formats(video.youtube_url, signal);
          if (formats.video_id) {
            skipped += 1;
            continue;
          }
          items.push({
            video,
            channel,
            formats,
            height: preferredHeight(
              formats.qualities.map((quality) => quality.height),
              options.max_height,
            ),
            checked: true,
          });
        } catch (error) {
          if (signal.aborted) return;
          found.videos += 1;
          found.signIn ||= needsSignIn(error);
          // Without its qualities it can still be queued, up to the default height.
          items.push({ video, channel, formats: null, height: null, checked: true });
        }
      }

      step("Preparando la lista…", 100, items.length);
      // Let the bar reach the end before the list replaces it.
      await wait(450);
      if (signal.aborted) return;
      setProblems(found);
      setScan(items.length > 0 ? { phase: "review", items } : { phase: "empty" });
    }

    run().catch((error) => {
      if (signal.aborted) return;
      setProblems({ channels: 0, videos: 0, signIn: needsSignIn(error) });
      setScan({ phase: "empty" });
    });
    return () => abort.abort();
  }, []);

  const items = scan.phase === "review" ? scan.items : [];
  const chosen = items.filter((item) => item.checked);
  const known = chosen.map(sizeOf).filter((size): size is number => size !== null);
  const total = known.reduce((sum, size) => sum + size, 0);
  const allChecked = items.length > 0 && items.every((item) => item.checked);

  function setItems(next: Item[]) {
    setScan({ phase: "review", items: next });
  }

  async function download() {
    setQueueing(true);
    setQueueError(null);
    let failed = 0;
    const startAt = settings.start_time ? nextAt(settings.start_time).toISOString() : null;
    for (const item of chosen) {
      try {
        await api.createDownload({
          url: item.video.youtube_url,
          maxHeight: item.height ?? settings.max_height,
          startAt,
          title: item.video.title,
        });
      } catch (error) {
        // 409: it is already in the library or on its way.
        if (!(error instanceof ApiError && error.status === 409)) failed += 1;
      }
    }
    client.invalidateQueries({ queryKey: queryKeys.downloads });
    setQueueing(false);
    if (failed > 0) {
      setQueueError(
        `${plural(failed, "video no se pudo", "videos no se pudieron")} añadir a la cola.`,
      );
      return;
    }
    onClose();
  }

  const notes = [
    problems.channels > 0 &&
      `${plural(problems.channels, "canal no se pudo", "canales no se pudieron")} revisar.`,
    problems.videos > 0 &&
      `No se pudo calcular el peso de ${plural(problems.videos, "video", "videos")}.`,
    problems.signIn && "YouTube pidió iniciar sesión: puede que tus cookies hayan caducado.",
  ].filter(Boolean);

  const subtitle =
    scan.phase === "review"
      ? `${plural(items.length, "video nuevo", "videos nuevos")} en tus canales`
      : scan.phase === "scanning"
        ? "Revisando tus canales con autodescarga"
        : null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Autodescarga"
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[calc(100vh-32px)] w-full max-w-[640px] flex-col overflow-hidden rounded-2xl border border-yt-border bg-yt-bg shadow-[0_8px_40px_rgba(0,0,0,0.6)]"
      >
        <header className="flex items-center gap-4 py-4 pr-3 pl-6">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-yt-brand/15 text-yt-brand">
            <BoltIcon />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg leading-6 font-bold">Autodescarga</h2>
            {subtitle && <p className="truncate text-sm text-yt-text-secondary">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-yt-surface"
          >
            <CloseIcon />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto border-t border-yt-divider">
          {scan.phase === "scanning" ? (
            <div className="px-6 pt-8 pb-12">
              <div className="mb-8 flex flex-col items-center">
                <span className="relative flex size-20 items-center justify-center">
                  <span className="absolute inset-0 rounded-full bg-yt-brand/30 [animation:yt-halo_1.8s_ease-out_infinite]" />
                  <span className="relative flex size-20 items-center justify-center rounded-full bg-yt-brand shadow-[0_0_24px_4px_color-mix(in_srgb,var(--yt-brand)_45%,transparent)]">
                    <span
                      key={scan.found}
                      className="text-3xl font-bold text-white tabular-nums [animation:yt-pop_0.35s_ease-out]"
                    >
                      {scan.found}
                    </span>
                  </span>
                </span>
                <span className="mt-3 text-xs text-yt-text-secondary">
                  {scan.found === 1 ? "video encontrado" : "videos encontrados"}
                </span>
              </div>
              <div className="mb-3 flex items-baseline justify-between gap-4">
                <p className="text-sm font-medium">{scan.label}</p>
                <span className="text-xs text-yt-text-secondary tabular-nums">
                  {Math.round(scan.progress)}%
                </span>
              </div>
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(scan.progress)}
                className="relative h-1 rounded-full bg-yt-surface"
              >
                <div
                  className="relative h-full rounded-full bg-yt-brand transition-[width] duration-500 ease-out"
                  style={{ width: `${Math.max(scan.progress, 2)}%` }}
                >
                  {/* A light that keeps running along the filled part. */}
                  <span className="absolute inset-0 overflow-hidden rounded-full">
                    <span className="absolute inset-y-0 w-16 bg-gradient-to-r from-transparent via-white/70 to-transparent [animation:yt-progress-run_1.6s_ease-in-out_infinite]" />
                  </span>
                  {/* The comet: a glowing tail behind a twinkling head. */}
                  <span className="absolute top-1/2 right-0 h-[3px] w-12 -translate-y-1/2 rounded-full bg-gradient-to-r from-transparent to-[#ff6b6b] blur-[1px]" />
                  <span className="absolute top-1/2 right-0 size-2.5 translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_6px_2px_var(--yt-brand),0_0_14px_5px_color-mix(in_srgb,var(--yt-brand)_60%,transparent)] [animation:yt-twinkle_1.2s_ease-in-out_infinite]" />
                </div>
              </div>
              <p className="mt-3 text-xs text-yt-text-secondary">
                Puede tardar un poco según cuántos canales tengas.
              </p>
            </div>
          ) : scan.phase === "none" ? (
            <div className="px-6 py-10 text-center">
              <p className="text-sm">Todavía no has elegido canales para la autodescarga.</p>
              <Link
                href="/settings"
                onClick={onClose}
                className="mt-4 inline-flex h-9 items-center rounded-full bg-yt-surface px-4 text-sm font-medium hover:bg-yt-surface-hover"
              >
                Elegir canales
              </Link>
            </div>
          ) : scan.phase === "empty" ? (
            <div className="px-6 py-12 text-center">
              <p className="text-base font-medium">Estás al día</p>
              <p className="mt-1 text-sm text-yt-text-secondary">
                No hay videos nuevos en tus canales.
              </p>
            </div>
          ) : (
            <>
              <label className="flex h-12 cursor-pointer items-center gap-4 px-6 text-sm">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={(event) =>
                    setItems(items.map((item) => ({ ...item, checked: event.target.checked })))
                  }
                  className="size-[18px] shrink-0 accent-yt-brand"
                />
                <span className="font-medium">Seleccionar todos</span>
              </label>
              <ul className="px-3 pb-2">
                {items.map((item, index) => (
                  <ItemRow
                    key={item.video.youtube_id}
                    item={item}
                    fallbackHeight={settings.max_height}
                    onChange={(change) =>
                      setItems(items.map((it, i) => (i === index ? { ...it, ...change } : it)))
                    }
                  />
                ))}
              </ul>
            </>
          )}
          {notes.length > 0 && scan.phase !== "scanning" && (
            <div className="mx-6 mb-4 flex gap-3 rounded-xl bg-yt-surface px-4 py-3 text-xs text-yt-text-secondary">
              <AlertIcon size={16} className="mt-px shrink-0 text-yt-brand" />
              <span>{notes.join(" ")}</span>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-yt-divider px-6 py-3">
          <div className="min-w-0 text-sm">
            {queueError ? (
              <span className="text-yt-error">{queueError}</span>
            ) : scan.phase === "review" ? (
              <>
                <span className="font-medium">{plural(chosen.length, "video", "videos")}</span>
                {total > 0 && (
                  <span className="text-yt-text-secondary">
                    {" · "}
                    {known.length < chosen.length ? "más de " : ""}
                    {formatBytes(total)}
                  </span>
                )}
                {settings.start_time && (
                  <span className="block text-xs text-yt-text-secondary">
                    Empezarán a las {formatClock(nextAt(settings.start_time))}
                  </span>
                )}
              </>
            ) : null}
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-full px-4 text-sm font-medium hover:bg-yt-surface"
            >
              Cancelar
            </button>
            {scan.phase === "review" && (
              <button
                type="button"
                disabled={chosen.length === 0 || queueing}
                onClick={download}
                className="flex h-9 items-center gap-2 rounded-full bg-yt-cta-bg pr-4 pl-3 text-sm font-medium text-yt-cta-text hover:bg-yt-cta-hover disabled:opacity-40"
              >
                <DownloadIcon size={20} />
                {queueing ? "Añadiendo…" : "Descargar"}
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

function ItemRow({
  item,
  fallbackHeight,
  onChange,
}: {
  item: Item;
  fallbackHeight: number;
  onChange: (change: Partial<Item>) => void;
}) {
  const { video, channel, formats } = item;
  const qualities = [...(formats?.qualities ?? [])].reverse();
  return (
    <li
      className={`flex items-center gap-3 rounded-xl px-3 py-2 transition-opacity hover:bg-yt-surface ${
        item.checked ? "" : "opacity-50"
      }`}
    >
      <input
        type="checkbox"
        aria-label={`Descargar ${video.title}`}
        checked={item.checked}
        onChange={(event) => onChange({ checked: event.target.checked })}
        className="size-[18px] shrink-0 accent-yt-brand"
      />
      <div className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-lg bg-yt-skeleton mini:w-40">
        {video.thumbnail_url && (
          <img src={video.thumbnail_url} alt="" loading="lazy" className="size-full object-cover" />
        )}
        {video.duration_seconds ? (
          <span className="absolute right-1 bottom-1 rounded bg-black/80 px-1 text-xs leading-4 font-medium text-white">
            {formatDuration(video.duration_seconds)}
          </span>
        ) : null}
      </div>
      <div className="min-w-0 flex-1 self-start pt-0.5">
        <p className="line-clamp-2 text-sm leading-5 font-medium">{video.title}</p>
        <p className="mt-0.5 truncate text-xs text-yt-text-secondary">{channel.name}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {qualities.length > 0 ? (
            <span className="relative inline-flex">
              <select
                aria-label="Calidad"
                value={item.height ?? ""}
                onChange={(event) => onChange({ height: Number(event.target.value) })}
                className="h-7 appearance-none rounded-full bg-yt-surface pr-7 pl-3 text-xs font-medium outline-none hover:bg-yt-surface-hover focus-visible:ring-2 focus-visible:ring-yt-brand"
              >
                {qualities.map((quality) => (
                  <option key={quality.height} value={quality.height} className="bg-yt-menu">
                    {quality.height}p · {qualityName(quality.height)}
                    {quality.size_bytes ? ` · ${formatBytes(quality.size_bytes)}` : ""}
                  </option>
                ))}
              </select>
              <svg
                viewBox="0 0 24 24"
                width={16}
                height={16}
                aria-hidden="true"
                className="pointer-events-none absolute top-1.5 right-2 fill-current"
              >
                <path d="m18 9.28-6.35 6.35-6.37-6.35.72-.71 5.64 5.65 5.65-5.65z" />
              </svg>
            </span>
          ) : (
            <span className="inline-flex h-7 items-center rounded-full bg-yt-surface px-3 text-xs text-yt-text-secondary">
              Hasta {fallbackHeight}p
            </span>
          )}
          <span className="text-xs text-yt-text-secondary tabular-nums">
            {formatBytes(sizeOf(item)) ?? "Peso desconocido"}
          </span>
        </div>
      </div>
    </li>
  );
}
