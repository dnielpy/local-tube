"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { use } from "react";
import { browser } from "react-dom";

import { api, ApiError, queryKeys } from "@/lib/api";
import { formatDuration } from "@/lib/format";

import { ChannelPhoto } from "./ChannelPhoto";
import { ProfileAvatar } from "./profiles/ProfileAvatar";

const CARD = "mx-auto mt-6 w-full max-w-[480px] rounded-xl bg-yt-menu p-6 sm:mt-16";
const BUTTON = "h-9 rounded-full px-4 text-sm font-medium";

/** What opens from a share link: who shared the video, the video, and whether to keep it. */
export function SharedVideoView() {
  use(browser("Share data is fetched from the api in the browser."));
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const client = useQueryClient();
  const share = useQuery({ queryKey: queryKeys.share(id), queryFn: () => api.share(id) });
  const save = useMutation({
    mutationFn: () => api.saveShare(id),
    onSuccess: (video) => {
      client.invalidateQueries({ queryKey: queryKeys.allVideos });
      client.invalidateQueries({ queryKey: queryKeys.channels });
      client.invalidateQueries({ queryKey: queryKeys.downloadedChannels });
      client.invalidateQueries({ queryKey: queryKeys.share(id) });
      router.push(`/watch?v=${video.id}`);
    },
  });

  if (share.isPending) return <SharedVideoSkeleton />;
  if (share.isError) {
    const gone = share.error instanceof ApiError && share.error.status === 404;
    return (
      <div className="flex flex-col items-center px-4 py-24 text-center">
        <h1 className="text-2xl">Este video ya no está disponible</h1>
        <p className="mt-2 text-yt-text-secondary">
          {gone
            ? "Quien lo compartió lo eliminó de LocalTube."
            : "No se pudo cargar el video compartido."}
        </p>
        <Link href="/" className={`${BUTTON} mt-6 flex items-center bg-yt-surface`}>
          Ir al inicio
        </Link>
      </div>
    );
  }

  const { shared_by: sharedBy, video, thumbnail_url: thumbnail, in_library: saved } = share.data;
  return (
    <div className="px-4">
      <div className={CARD}>
        <div className="flex items-center gap-3">
          <ProfileAvatar profile={sharedBy} size={40} />
          <h1 className="text-base">
            <span className="font-medium">{sharedBy.name}</span> ha compartido este video contigo
          </h1>
        </div>
        <div className="relative mt-5 aspect-video w-full overflow-hidden rounded-xl bg-yt-skeleton">
          {thumbnail && (
            <img src={thumbnail} alt="" className="absolute inset-0 size-full object-cover" />
          )}
          {video.duration_seconds != null && (
            <span className="absolute right-1 bottom-1 rounded bg-black/60 px-1 py-[1px] text-xs leading-[18px] font-medium text-white">
              {formatDuration(video.duration_seconds)}
            </span>
          )}
        </div>
        <h2 className="mt-3 line-clamp-2 text-base leading-[22px] font-medium break-words">
          {video.title}
        </h2>
        <div className="mt-2 flex items-center gap-2 text-sm text-yt-text-secondary">
          <ChannelPhoto src={video.channel_avatar_url} name={video.channel} size={24} />
          <span className="truncate">{video.channel ?? "Desconocido"}</span>
        </div>
        {saved && <p className="mt-4 text-sm text-yt-text-secondary">Ya está en tu biblioteca.</p>}
        {save.isError && <p className="mt-4 text-sm text-yt-error">No se pudo guardar el video.</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => router.push("/")}
            className={`${BUTTON} hover:bg-yt-surface`}
          >
            Cancelar
          </button>
          {saved ? (
            <Link
              href={`/watch?v=${video.id}`}
              className={`${BUTTON} flex items-center bg-yt-cta-bg text-yt-cta-text hover:bg-yt-cta-hover`}
            >
              Ver video
            </Link>
          ) : (
            <button
              type="button"
              disabled={save.isPending}
              onClick={() => save.mutate()}
              className={`${BUTTON} bg-yt-cta-bg text-yt-cta-text hover:bg-yt-cta-hover disabled:opacity-50`}
            >
              Guardar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function SharedVideoSkeleton() {
  return (
    <div className="px-4">
      <div className={CARD}>
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-md bg-yt-skeleton" />
          <div className="h-4 w-2/3 rounded bg-yt-skeleton" />
        </div>
        <div className="mt-5 aspect-video w-full rounded-xl bg-yt-skeleton" />
        <div className="mt-3 h-5 w-4/5 rounded bg-yt-skeleton" />
        <div className="mt-2 h-4 w-1/3 rounded bg-yt-skeleton" />
      </div>
    </div>
  );
}
