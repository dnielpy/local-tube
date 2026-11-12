"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { use, useEffect, useRef, useState, type FormEvent } from "react";
import { browser } from "react-dom";

import { api, ApiError, queryKeys, type DownloadJob, type JobStatus } from "@/lib/api";
import { timeAgo } from "@/lib/format";

import { IconButton } from "./IconButton";
import { AlertIcon, CheckIcon, CloseIcon, DownloadIcon, RetryIcon, TrashIcon } from "./icons";

const ACTIVE: JobStatus[] = ["queued", "downloading", "processing"];
const isActive = (job: DownloadJob) => ACTIVE.includes(job.status);

export function Downloads() {
  use(browser("Library data is fetched from the api in the browser."));
  const client = useQueryClient();
  const jobs = useQuery({
    queryKey: queryKeys.downloads,
    queryFn: api.downloads,
    refetchInterval: (query) => (query.state.data?.some(isActive) ? 1500 : false),
  });

  const finished = jobs.data?.filter((job) => job.status === "completed").length ?? 0;
  const seen = useRef(finished);
  useEffect(() => {
    if (finished > seen.current) {
      client.invalidateQueries({ queryKey: queryKeys.allVideos });
      client.invalidateQueries({ queryKey: queryKeys.channels });
    }
    seen.current = finished;
  }, [finished, client]);

  return (
    <div className="mx-auto max-w-[1096px] px-4 pt-6 pb-16 search:px-6">
      <h1 className="text-[36px] leading-[50px] font-bold">Descargas</h1>
      <p className="mt-1 text-sm text-yt-text-secondary">
        Pega el enlace de un video de YouTube para guardarlo en el disco del servidor.
      </p>
      <DownloadForm />

      <h2 className="mt-10 mb-4 text-xl leading-7 font-bold">Historial</h2>
      {jobs.isPending ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="flex gap-4">
              <div className="yt-skeleton aspect-video w-[168px] shrink-0 rounded-lg" />
              <div className="flex-1 space-y-2 pt-1">
                <div className="yt-skeleton h-5 w-[60%] rounded" />
                <div className="yt-skeleton h-4 w-[30%] rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : jobs.data && jobs.data.length > 0 ? (
        <ul className="flex flex-col gap-4">
          {jobs.data.map((job) => (
            <JobRow key={job.id} job={job} />
          ))}
        </ul>
      ) : (
        <p className="py-10 text-center text-sm text-yt-text-secondary">
          Aún no has descargado ningún video.
        </p>
      )}
    </div>
  );
}

const QUALITIES: { label: string; value: number | null }[] = [
  { label: "360p", value: 360 },
  { label: "480p", value: 480 },
  { label: "720p", value: 720 },
  { label: "1080p", value: 1080 },
  { label: "Máxima", value: null },
];

function DownloadForm() {
  const client = useQueryClient();
  const [url, setUrl] = useState("");
  const [maxHeight, setMaxHeight] = useState<number | null>(360);
  const create = useMutation({
    mutationFn: api.createDownload,
    onSuccess: () => {
      setUrl("");
      client.invalidateQueries({ queryKey: queryKeys.downloads });
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (url.trim()) create.mutate({ url: url.trim(), maxHeight });
  }

  const error = create.error;
  const existingVideo =
    error instanceof ApiError &&
    error.status === 409 &&
    typeof error.detail === "object" &&
    error.detail !== null &&
    "video_id" in error.detail
      ? String(error.detail.video_id)
      : null;

  return (
    <form onSubmit={submit} className="mt-6">
      <div className="flex flex-col gap-3 xs:flex-row">
        <div className="flex h-10 flex-1 items-center rounded-full border border-yt-border bg-yt-search-bg pr-1 pl-4 focus-within:border-[#1c62b9]">
          <input
            value={url}
            onChange={(event) => {
              setUrl(event.target.value);
              if (create.isError) create.reset();
            }}
            onPaste={(event) => {
              const pasted = event.clipboardData.getData("text").trim();
              if (pasted && !url) {
                event.preventDefault();
                setUrl(pasted);
                create.mutate({ url: pasted, maxHeight });
              }
            }}
            type="url"
            inputMode="url"
            placeholder="https://www.youtube.com/watch?v=..."
            aria-label="Enlace del video"
            autoFocus
            className="h-full w-full bg-transparent text-base outline-none placeholder:text-[#888]"
          />
          {url && (
            <button
              type="button"
              aria-label="Borrar"
              onClick={() => setUrl("")}
              className="flex size-8 shrink-0 items-center justify-center rounded-full hover:bg-yt-surface"
            >
              <CloseIcon size={20} />
            </button>
          )}
        </div>
        <select
          value={maxHeight ?? "best"}
          onChange={(event) =>
            setMaxHeight(event.target.value === "best" ? null : Number(event.target.value))
          }
          aria-label="Calidad"
          className="h-10 cursor-pointer rounded-full bg-yt-surface px-4 text-sm font-medium outline-none hover:bg-yt-surface-hover [&>option]:bg-yt-menu"
        >
          {QUALITIES.map((quality) => (
            <option key={quality.label} value={quality.value ?? "best"}>
              {quality.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={!url.trim() || create.isPending}
          className="flex h-10 items-center justify-center gap-2 rounded-full bg-yt-cta-bg px-5 text-sm font-medium text-yt-cta-text hover:bg-yt-cta-hover disabled:opacity-50"
        >
          <DownloadIcon />
          {create.isPending ? "Añadiendo…" : "Descargar"}
        </button>
      </div>
      {error && (
        <p className="mt-3 flex items-center gap-2 text-sm text-yt-error">
          <AlertIcon size={20} />
          {error.message}
          {existingVideo && (
            <Link href={`/watch?v=${existingVideo}`} className="font-medium text-yt-link">
              Verlo
            </Link>
          )}
        </p>
      )}
      <p className="mt-3 text-xs text-yt-text-secondary">
        Al pegar un enlace la descarga empieza sola. Los videos se guardan en MP4 (H.264) para que
        se puedan ver en cualquier dispositivo.
      </p>
    </form>
  );
}

const STATUS_LABEL: Record<JobStatus, string> = {
  queued: "En cola",
  downloading: "Descargando",
  processing: "Procesando",
  completed: "Completado",
  failed: "Error",
};

function JobRow({ job }: { job: DownloadJob }) {
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: queryKeys.downloads });
  const retry = useMutation({ mutationFn: api.retryDownload, onSuccess: refresh });
  const remove = useMutation({ mutationFn: api.deleteDownload, onSuccess: refresh });
  const active = isActive(job);
  const watchHref = job.video_id ? `/watch?v=${job.video_id}` : null;

  const thumbnail = (
    <div className="relative aspect-video w-[120px] shrink-0 overflow-hidden rounded-lg bg-yt-surface xs:w-[168px]">
      {job.video_id && job.status === "completed" ? (
        <img
          src={`/api/videos/${job.video_id}/thumbnail`}
          alt=""
          className="absolute inset-0 size-full object-cover"
          onError={(event) => (event.currentTarget.style.display = "none")}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-yt-text-secondary">
          {job.status === "failed" ? <AlertIcon size={32} /> : <DownloadIcon size={32} />}
        </div>
      )}
      {active && (
        <div className="absolute inset-x-0 bottom-0 h-1 bg-[#717171]/60">
          <div
            className="h-full bg-yt-brand transition-[width] duration-500"
            style={{ width: `${job.status === "queued" ? 0 : job.progress}%` }}
          />
        </div>
      )}
    </div>
  );

  const details = [STATUS_LABEL[job.status], job.max_height ? `${job.max_height}p` : "Máxima"];
  if (job.status === "downloading") {
    details.push(`${Math.round(job.progress)}%`);
    if (job.speed) details.push(job.speed);
    if (job.eta) details.push(`${job.eta} restantes`);
  }

  return (
    <li className="group flex items-start gap-3 xs:gap-4">
      {watchHref ? <Link href={watchHref}>{thumbnail}</Link> : thumbnail}
      <div className="min-w-0 flex-1">
        {watchHref ? (
          <Link href={watchHref}>
            <h3 className="line-clamp-2 text-base leading-[22px] font-medium">
              {job.title ?? job.url}
            </h3>
          </Link>
        ) : (
          <h3 className="line-clamp-2 text-base leading-[22px] font-medium break-all">
            {job.title ?? job.url}
          </h3>
        )}
        <p
          className={`mt-1 flex items-center gap-1 text-xs leading-[18px] ${
            job.status === "failed" ? "text-yt-error" : "text-yt-text-secondary"
          }`}
        >
          {job.status === "completed" && <CheckIcon size={16} />}
          {details.join(" · ")}
        </p>
        {job.error && (
          <p className="mt-1 line-clamp-3 text-xs leading-[18px] text-yt-text-secondary">
            {job.error}
          </p>
        )}
        {job.error?.includes("cookies") && (
          <p className="mt-1 text-xs leading-[18px] text-yt-text">
            YouTube pide iniciar sesión. Configura las cookies del navegador en la API (README,
            sección «Cookies de YouTube») y pulsa reintentar.
          </p>
        )}
        <p className="mt-1 text-xs leading-[18px] text-yt-text-secondary">
          {timeAgo(job.created_at)}
        </p>
      </div>
      <div className="flex shrink-0 items-center">
        {job.status === "failed" && (
          <IconButton
            label="Reintentar"
            disabled={retry.isPending}
            onClick={() => retry.mutate(job.id)}
          >
            <RetryIcon />
          </IconButton>
        )}
        {job.status !== "downloading" && job.status !== "processing" && (
          <IconButton
            label="Quitar del historial"
            disabled={remove.isPending}
            onClick={() => remove.mutate(job.id)}
          >
            <TrashIcon />
          </IconButton>
        )}
      </div>
    </li>
  );
}
