"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { use, useEffect, useState } from "react";
import { browser } from "react-dom";

import { api, ApiError, queryKeys, type PlaylistDetail } from "@/lib/api";
import { formatDuration } from "@/lib/format";

import { ConfirmDialog } from "../Dialog";
import { CloseIcon, EditIcon, PlaySmallIcon, TrashIcon } from "../icons";
import { NameDialog } from "./PlaylistsView";
import { playlistIcon } from "./SaveDialog";
import { VideoRow } from "./VideoRow";

export function playHref(playlistId: string, videoId: string) {
  return `/watch?v=${videoId}&list=${playlistId}`;
}

function totalTime(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return hours ? `${hours} h ${minutes} min` : `${minutes} min`;
}

/** One playlist, like youtube.com/playlist: its card on the left and its videos on the right. */
export function PlaylistView() {
  use(browser("The playlist is fetched from the api in the browser."));
  const id = useSearchParams().get("list") ?? "";
  const playlist = useQuery({
    queryKey: queryKeys.playlist(id),
    queryFn: () => api.playlist(id),
    enabled: id.length > 0,
  });

  useEffect(() => {
    if (playlist.data) document.title = `${playlist.data.name} - LocalTube`;
  }, [playlist.data]);

  if (!id || playlist.isError) {
    const missing = playlist.error instanceof ApiError && playlist.error.status === 404;
    return (
      <div className="flex flex-col items-center px-4 py-24 text-center">
        <h1 className="text-2xl">Esta lista no está disponible</h1>
        <p className="mt-2 text-yt-text-secondary">
          {missing || !id ? "Puede que se haya eliminado." : "No se pudo cargar la lista."}
        </p>
        <Link
          href="/playlists"
          className="mt-6 flex h-9 items-center rounded-full bg-yt-cta-bg px-4 text-sm font-medium text-yt-cta-text"
        >
          Ver tus listas
        </Link>
      </div>
    );
  }
  if (!playlist.data) return <div className="min-h-[60vh]" />;
  return <PlaylistPage playlist={playlist.data} />;
}

function PlaylistPage({ playlist }: { playlist: PlaylistDetail }) {
  const client = useQueryClient();
  const router = useRouter();
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const first = playlist.items[0]?.video;
  const custom = playlist.kind === "custom";
  const refresh = () => {
    client.invalidateQueries({ queryKey: queryKeys.playlist(playlist.id) });
    client.invalidateQueries({ queryKey: queryKeys.allPlaylists });
  };
  const remove = useMutation({
    mutationFn: (videoId: string) => api.removeFromPlaylist(playlist.id, videoId),
    onSuccess: refresh,
  });
  const destroy = useMutation({
    mutationFn: () => api.deletePlaylist(playlist.id),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: queryKeys.allPlaylists });
      router.push("/playlists");
    },
  });

  return (
    <div className="flex flex-col gap-6 px-4 pt-6 pb-10 search:px-6 watch:flex-row watch:items-start">
      <section className="relative shrink-0 overflow-hidden rounded-2xl p-6 watch:sticky watch:top-20 watch:w-[360px]">
        {playlist.thumbnail_url && (
          <img
            src={playlist.thumbnail_url}
            alt=""
            aria-hidden
            className="absolute inset-0 size-full scale-125 object-cover opacity-60 blur-2xl"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-yt-bg/95" />
        <div className="relative">
          <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-yt-skeleton">
            {playlist.thumbnail_url ? (
              <img
                src={playlist.thumbnail_url}
                alt=""
                className="absolute inset-0 size-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-yt-text-secondary">
                {playlistIcon(playlist, 48)}
              </div>
            )}
          </div>
          <h1 className="mt-4 text-2xl leading-8 font-bold break-words text-white">
            {playlist.name}
          </h1>
          <p className="mt-3 text-xs text-white/70">
            {playlist.kind === "custom" ? "Privada" : "Lista automática"}
          </p>
          <p className="mt-1 text-xs text-white/70">
            {playlist.count} {playlist.count === 1 ? "video" : "videos"}
            {playlist.duration_seconds > 0 && ` · ${totalTime(playlist.duration_seconds)}`}
          </p>
          {custom && (
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                aria-label="Cambiar nombre"
                title="Cambiar nombre"
                onClick={() => setRenaming(true)}
                className="flex size-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
              >
                <EditIcon />
              </button>
              <button
                type="button"
                aria-label="Eliminar lista"
                title="Eliminar lista"
                onClick={() => setDeleting(true)}
                className="flex size-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
              >
                <TrashIcon />
              </button>
            </div>
          )}
          {first && (
            <Link
              href={playHref(playlist.id, first.id)}
              className="mt-5 flex h-9 w-full items-center justify-center gap-2 rounded-full bg-white text-sm font-medium text-black hover:bg-white/90"
            >
              <PlaySmallIcon />
              Reproducir todo
            </Link>
          )}
        </div>
      </section>

      <div className="min-w-0 flex-1">
        {playlist.items.length === 0 ? (
          <p className="py-16 text-center text-sm text-yt-text-secondary">
            Esta lista todavía no tiene videos. Usa «Guardar» en un video para añadirlo.
          </p>
        ) : (
          playlist.items.map((item, index) => (
            <VideoRow
              key={item.video.id}
              video={item.video}
              href={playHref(playlist.id, item.video.id)}
              index={index + 1}
              actions={
                <button
                  type="button"
                  aria-label={`Quitar de ${playlist.name}`}
                  title={`Quitar de ${playlist.name}`}
                  onClick={() => remove.mutate(item.video.id)}
                  className="flex size-10 items-center justify-center rounded-full opacity-0 group-hover:opacity-100 hover:bg-yt-surface-hover focus-visible:opacity-100 max-mini:opacity-100"
                >
                  <CloseIcon />
                </button>
              }
            />
          ))
        )}
        {playlist.items.length > 0 && (
          <p className="mt-4 px-2 text-xs text-yt-text-secondary">
            Duración total: {formatDuration(playlist.duration_seconds)}
          </p>
        )}
      </div>

      {renaming && (
        <NameDialog
          title="Cambiar nombre"
          confirmLabel="Guardar"
          initial={playlist.name}
          playlistId={playlist.id}
          onClose={() => setRenaming(false)}
        />
      )}
      <ConfirmDialog
        open={deleting}
        title="¿Eliminar lista?"
        confirmLabel="Eliminar"
        busy={destroy.isPending}
        onCancel={() => setDeleting(false)}
        onConfirm={() => destroy.mutate()}
      >
        «{playlist.name}» se eliminará. Los videos siguen en tu biblioteca.
      </ConfirmDialog>
    </div>
  );
}
