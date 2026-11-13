"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { api, queryKeys, type Channel, type DownloadJob, type RemoteVideo } from "@/lib/api";
import { channelHref, formatCount, formatDuration, timeAgo } from "@/lib/format";
import { isActiveJob, useDownloadJobs } from "@/lib/use-downloads";

import { ChannelPhoto } from "./ChannelPhoto";
import { CheckIcon, DownloadIcon, ExternalIcon, RetryIcon, StopFilledIcon } from "./icons";
import { QualityDialog } from "./QualityDialog";

function jobLabel(job: DownloadJob): string {
  if (job.status === "queued") return "En cola";
  if (job.status === "processing") return "Procesando…";
  return `Descargando ${Math.round(job.progress)}%`;
}

/** A video on YouTube; with `channel`, the card shows whose it is, for lists of many channels. */
export function RemoteVideoCard({
  video,
  channelId,
  channel,
}: {
  video: RemoteVideo;
  channelId: string;
  channel?: Channel;
}) {
  const client = useQueryClient();
  const jobs = useDownloadJobs();
  const job = jobs.data?.find((item) => item.youtube_id === video.youtube_id);
  const localId = video.video_id ?? (job?.status === "completed" ? job.video_id : null);
  const active = job && isActiveJob(job);

  const [choosing, setChoosing] = useState(false);
  const retry = useMutation({
    mutationFn: (id: string) => api.retryDownload(id),
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.downloads }),
  });
  const cancel = useMutation({
    mutationFn: (id: string) => api.cancelDownload(id),
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.downloads }),
  });

  const thumbnail = (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-yt-skeleton">
      {video.thumbnail_url && (
        <img
          src={video.thumbnail_url}
          alt=""
          loading="lazy"
          className="absolute inset-0 size-full object-cover"
        />
      )}
      {video.duration_seconds != null && (
        <span className="absolute right-1 bottom-1 rounded bg-black/60 px-1 py-[1px] text-xs leading-[18px] font-medium text-white">
          {formatDuration(video.duration_seconds)}
        </span>
      )}
      {localId && (
        <span className="absolute top-1 left-1 flex items-center gap-1 rounded bg-black/60 py-[1px] pr-[6px] pl-1 text-xs leading-[18px] font-medium text-white">
          <CheckIcon size={14} />
          Descargado
        </span>
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

  const meta = [
    formatCount(video.view_count, "visualizaciones"),
    video.published_at ? timeAgo(video.published_at) : null,
  ].filter(Boolean);

  const pill = "flex h-8 items-center gap-1 rounded-full px-3 text-sm font-medium";

  return (
    <div className="flex flex-col">
      {localId ? (
        <Link href={`/watch?v=${localId}`}>{thumbnail}</Link>
      ) : (
        <a href={video.youtube_url} target="_blank" rel="noreferrer">
          {thumbnail}
        </a>
      )}
      <div className="mt-3 flex gap-3">
        {channel && (
          <Link href={channelHref({ channel_id: channelId })} aria-label={channel.name}>
            <ChannelPhoto src={channel.avatar_url} name={channel.name} />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-base leading-[22px] font-medium" title={video.title}>
            {video.title}
          </h3>
          {channel && (
            <Link
              href={channelHref({ channel_id: channelId })}
              className="mt-1 block truncate text-sm leading-5 text-yt-text-secondary hover:text-yt-text"
            >
              {channel.name}
            </Link>
          )}
          {meta.length > 0 && (
            <p className="mt-1 text-sm leading-5 text-yt-text-secondary">{meta.join(" · ")}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            {localId ? (
              <Link
                href={`/watch?v=${localId}`}
                className={`${pill} bg-yt-cta-bg text-yt-cta-text hover:bg-yt-cta-hover`}
              >
                Reproducir
              </Link>
            ) : (
              <>
                <a
                  href={video.youtube_url}
                  target="_blank"
                  rel="noreferrer"
                  className={`${pill} bg-yt-surface hover:bg-yt-surface-hover`}
                >
                  <ExternalIcon size={18} />
                  Ver
                </a>
                {active ? (
                  <>
                    <span className={`${pill} bg-yt-surface text-yt-text-secondary`}>
                      {cancel.isPending || cancel.isSuccess ? "Parando…" : jobLabel(job)}
                    </span>
                    <button
                      type="button"
                      disabled={cancel.isPending || cancel.isSuccess}
                      onClick={() => cancel.mutate(job.id)}
                      className={`${pill} bg-yt-surface hover:bg-yt-surface-hover disabled:opacity-50`}
                    >
                      <StopFilledIcon size={16} />
                      Parar
                    </button>
                  </>
                ) : job?.status === "failed" ? (
                  <button
                    type="button"
                    disabled={retry.isPending}
                    onClick={() => retry.mutate(job.id)}
                    title={job.error ?? undefined}
                    className={`${pill} bg-yt-surface text-yt-error hover:bg-yt-surface-hover`}
                  >
                    <RetryIcon size={18} />
                    Reintentar
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setChoosing(true)}
                    className={`${pill} bg-yt-cta-bg text-yt-cta-text hover:bg-yt-cta-hover`}
                  >
                    <DownloadIcon size={18} />
                    Descargar
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      <QualityDialog
        url={choosing ? video.youtube_url : null}
        onClose={() => setChoosing(false)}
        onQueued={() => {
          client.invalidateQueries({ queryKey: queryKeys.channel(channelId) });
          client.invalidateQueries({ queryKey: queryKeys.feed });
        }}
      />
    </div>
  );
}
