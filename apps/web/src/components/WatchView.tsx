"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { api, queryKeys, type Video } from "@/lib/api";
import { useDeleteVideo } from "@/lib/use-delete-video";

import { ChannelAvatar } from "./ChannelAvatar";
import { Description } from "./Description";
import { ConfirmDialog } from "./Dialog";
import { DownloadIcon, ExternalIcon, TrashIcon } from "./icons";
import { Player } from "./player/Player";
import { WatchNext, WatchNextSkeleton } from "./WatchNext";

const THEATER_KEY = "localtube:theater";

export function WatchView() {
  const id = useSearchParams().get("v") ?? "";
  const router = useRouter();
  const video = useQuery({
    queryKey: queryKeys.video(id),
    queryFn: () => api.video(id),
    enabled: id.length > 0,
  });
  const library = useQuery({
    queryKey: queryKeys.videos({ limit: 200 }),
    queryFn: () => api.videos({ limit: 200 }),
  });
  const [theater, setTheater] = useState(false);

  useEffect(() => {
    try {
      // Restoring a saved preference from storage after hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTheater(localStorage.getItem(THEATER_KEY) === "1");
    } catch {}
  }, []);

  useEffect(() => {
    if (video.data) document.title = `${video.data.title} - LocalTube`;
  }, [video.data]);

  function toggleTheater() {
    setTheater((value) => {
      try {
        localStorage.setItem(THEATER_KEY, value ? "0" : "1");
      } catch {}
      return !value;
    });
  }

  const others = (library.data?.items ?? []).filter((item) => item.id !== id);
  const next = others[0];

  if (!id || video.isError) {
    return (
      <div className="flex flex-col items-center px-4 py-24 text-center">
        <h1 className="text-2xl">Este video no está disponible</h1>
        <p className="mt-2 text-yt-text-secondary">Puede que se haya eliminado de la biblioteca.</p>
        <Link
          href="/"
          className="mt-6 flex h-9 items-center rounded-full bg-yt-cta-bg px-4 text-sm font-medium text-yt-cta-text"
        >
          Ir al inicio
        </Link>
      </div>
    );
  }

  const player = video.data ? (
    <Player
      key={video.data.id}
      video={video.data}
      theater={theater}
      onToggleTheater={toggleTheater}
      onNext={next ? () => router.push(`/watch?v=${next.id}`) : undefined}
    />
  ) : (
    <div className="aspect-video w-full bg-black search:rounded-xl" />
  );

  const secondary = library.isPending ? <WatchNextSkeleton /> : <WatchNext videos={others} />;

  return (
    <div className="mx-auto w-full">
      {theater && (
        <div className="hidden h-[min(calc(100vh-169px),56.25vw)] max-h-[calc(100vh-56px)] min-h-[480px] w-full bg-black watch:block">
          {player}
        </div>
      )}
      <div className="mx-auto flex max-w-[1754px] flex-col gap-6 search:px-6 search:pt-6 watch:flex-row">
        <div className="min-w-0 flex-1">
          <div className={theater ? "watch:hidden" : ""}>{player}</div>
          <div className="px-3 search:px-0">
            {video.data ? <VideoInfo video={video.data} /> : <InfoSkeleton />}
          </div>
        </div>
        <aside className="w-full shrink-0 px-3 pb-6 search:px-0 watch:w-[402px]">{secondary}</aside>
      </div>
    </div>
  );
}

function VideoInfo({ video }: { video: Video }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const remove = useDeleteVideo(() => router.push("/"));
  const pill =
    "flex h-9 shrink-0 items-center gap-[6px] rounded-full bg-yt-surface px-4 text-sm font-medium hover:bg-yt-surface-hover";

  return (
    <div className="pb-6">
      <h1 className="mt-3 line-clamp-2 text-xl leading-7 font-bold break-words">{video.title}</h1>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/?channel=${encodeURIComponent(video.channel ?? "")}`}
          className="flex min-w-0 items-center gap-3"
        >
          <ChannelAvatar name={video.channel} size={40} />
          <span className="truncate text-base font-medium">{video.channel ?? "Desconocido"}</span>
        </Link>
        <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none]">
          <a href={video.youtube_url} target="_blank" rel="noreferrer" className={pill}>
            <ExternalIcon />
            YouTube
          </a>
          <a href={video.stream_url} download={`${video.title}.mp4`} className={pill}>
            <DownloadIcon />
            Descargar
          </a>
          <button type="button" onClick={() => setConfirming(true)} className={pill}>
            <TrashIcon />
            Eliminar
          </button>
        </div>
      </div>
      <Description video={video} />
      <ConfirmDialog
        open={confirming}
        title="¿Eliminar video?"
        confirmLabel="Eliminar"
        busy={remove.isPending}
        onCancel={() => setConfirming(false)}
        onConfirm={() => remove.mutate(video.id)}
      >
        «{video.title}» se borrará del disco y de la biblioteca. Esta acción no se puede deshacer.
      </ConfirmDialog>
    </div>
  );
}

function InfoSkeleton() {
  return (
    <div className="space-y-3 pt-3 pb-6">
      <div className="yt-skeleton h-7 w-[70%] rounded" />
      <div className="flex items-center gap-3">
        <div className="yt-skeleton size-10 rounded-full" />
        <div className="yt-skeleton h-5 w-40 rounded" />
      </div>
      <div className="yt-skeleton h-24 w-full rounded-xl" />
    </div>
  );
}
