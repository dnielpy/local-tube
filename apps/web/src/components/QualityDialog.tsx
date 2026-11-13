"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";

import { api, ApiError, queryKeys, type DownloadJob } from "@/lib/api";
import { formatBytes, formatDuration, qualityName } from "@/lib/format";

import { AlertIcon } from "./icons";

function errorText(error: unknown): string {
  if (error instanceof ApiError && error.status === 503) {
    return "Sin conexión: no se pueden consultar las calidades ahora.";
  }
  return error instanceof Error ? error.message : "No se pudo analizar el video.";
}

export function QualityDialog({
  url,
  onClose,
  onQueued,
}: {
  url: string | null;
  onClose: () => void;
  onQueued?: (job: DownloadJob) => void;
}) {
  if (!url) return null;
  return <QualityDialogContent key={url} url={url} onClose={onClose} onQueued={onQueued} />;
}

function QualityDialogContent({
  url,
  onClose,
  onQueued,
}: {
  url: string;
  onClose: () => void;
  onQueued?: (job: DownloadJob) => void;
}) {
  const client = useQueryClient();
  const [choice, setChoice] = useState<number | null>(null);
  const formats = useQuery({
    queryKey: queryKeys.formats(url),
    queryFn: () => api.formats(url),
    staleTime: 10 * 60_000,
    retry: false,
  });
  const create = useMutation({
    mutationFn: (height: number) => api.createDownload({ url, maxHeight: height }),
    onSuccess: (job) => {
      client.invalidateQueries({ queryKey: queryKeys.downloads });
      onQueued?.(job);
      onClose();
    },
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const data = formats.data;
  const selected = choice ?? data?.default_height ?? null;
  const downloaded = data?.video_id ?? null;
  const canDownload = !!data && !downloaded && selected !== null && !create.isPending;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Descargar video"
        className="flex max-h-[calc(100vh-32px)] w-full max-w-[420px] flex-col rounded-xl bg-yt-menu shadow-[0_4px_32px_rgba(0,0,0,0.25)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="px-6 pt-6">
          <h2 className="text-xl leading-7 font-bold">Descargar video</h2>
          {data && (
            <p className="mt-2 line-clamp-2 text-sm leading-5 text-yt-text-secondary">
              {data.title}
              {data.duration_seconds ? ` · ${formatDuration(data.duration_seconds)}` : ""}
            </p>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          {formats.isError ? (
            <p className="flex gap-3 px-3 py-4 text-sm text-yt-error">
              <AlertIcon className="shrink-0" />
              {errorText(formats.error)}
            </p>
          ) : !data ? (
            <div className="flex flex-col items-center gap-4 px-3 py-8 text-center">
              <div className="size-9 rounded-full border-[3px] border-yt-surface border-t-yt-link [animation:yt-spin_0.9s_linear_infinite]" />
              <div>
                <p className="text-sm font-medium">Analizando las calidades disponibles…</p>
                <p className="mt-1 text-xs text-yt-text-secondary">
                  Puede tardar unos segundos según la conexión.
                </p>
              </div>
            </div>
          ) : downloaded ? (
            <div className="px-3 py-4 text-sm">
              <p>Este video ya está en tu biblioteca.</p>
              <Link
                href={`/watch?v=${downloaded}`}
                onClick={onClose}
                className="mt-2 inline-block font-medium text-yt-link"
              >
                Verlo ahora
              </Link>
            </div>
          ) : data.qualities.length === 0 ? (
            <p className="px-3 py-4 text-sm text-yt-text-secondary">
              No hay calidades de video disponibles para este enlace.
            </p>
          ) : (
            <div role="radiogroup" aria-label="Calidad" className="flex flex-col">
              {[...data.qualities].reverse().map((quality) => {
                const checked = quality.height === selected;
                return (
                  <button
                    key={quality.height}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    onClick={() => setChoice(quality.height)}
                    className="flex h-14 items-center gap-4 rounded-lg px-3 text-left hover:bg-yt-surface"
                  >
                    <span
                      className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${
                        checked ? "border-yt-link" : "border-yt-text-secondary"
                      }`}
                    >
                      {checked && <span className="size-[10px] rounded-full bg-yt-link" />}
                    </span>
                    <span className="flex-1">
                      <span className="block text-sm font-medium">
                        {qualityName(quality.height)} ({quality.height}p)
                      </span>
                      {quality.height === data.default_height && (
                        <span className="block text-xs text-yt-text-secondary">Recomendada</span>
                      )}
                    </span>
                    <span className="text-sm text-yt-text-secondary">
                      {formatBytes(quality.size_bytes) ?? "—"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {create.isError && (
            <p className="flex gap-3 px-3 pt-2 text-sm text-yt-error">
              <AlertIcon className="shrink-0" />
              {errorText(create.error)}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 pb-6">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-full px-4 text-sm font-medium hover:bg-yt-surface"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!canDownload}
            onClick={() => selected !== null && create.mutate(selected)}
            className="h-9 rounded-full bg-yt-cta-bg px-4 text-sm font-medium text-yt-cta-text hover:bg-yt-cta-hover disabled:opacity-40"
          >
            {create.isPending ? "Añadiendo…" : "Descargar"}
          </button>
        </div>
      </div>
    </div>
  );
}
