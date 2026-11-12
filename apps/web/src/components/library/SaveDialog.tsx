"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";

import { api, queryKeys, type Playlist, type Video } from "@/lib/api";
import { usePlaylistsFor, useTogglePlaylist } from "@/lib/use-playlists";

import { CloseIcon, LikeIcon, PlaylistIcon, PlusIcon, WatchLaterIcon } from "../icons";

export function playlistIcon(playlist: Pick<Playlist, "kind">, size = 24) {
  if (playlist.kind === "watch_later") return <WatchLaterIcon size={size} />;
  if (playlist.kind === "liked") return <LikeIcon size={size} />;
  return <PlaylistIcon size={size} />;
}

/** "Guardar video en...": tick the playlists that should hold the video, or make a new one. */
export function SaveDialog({ video, onClose }: { video: Video; onClose: () => void }) {
  const client = useQueryClient();
  const playlists = usePlaylistsFor(video.id);
  const toggle = useTogglePlaylist(video.id);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const create = useMutation({
    mutationFn: async () => {
      const playlist = await api.createPlaylist(name.trim());
      await api.addToPlaylist(playlist.id, video.id);
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: queryKeys.allPlaylists });
      onClose();
    },
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (name.trim()) create.mutate();
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Guardar video en"
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-full w-full max-w-[300px] flex-col rounded-xl bg-yt-menu shadow-[0_4px_32px_rgba(0,0,0,0.25)]"
      >
        <div className="flex items-center justify-between py-2 pr-2 pl-6">
          <h2 className="text-base">Guardar video en...</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex size-10 items-center justify-center rounded-full hover:bg-yt-surface"
          >
            <CloseIcon />
          </button>
        </div>
        <ul className="overflow-y-auto pb-2">
          {(playlists.data ?? []).map((playlist) => (
            <li key={playlist.id}>
              <label className="flex h-10 cursor-pointer items-center gap-4 px-6 hover:bg-yt-surface">
                <input
                  type="checkbox"
                  checked={playlist.contains ?? false}
                  onChange={(event) => toggle.mutate({ playlist, add: event.target.checked })}
                  className="size-5 accent-yt-text"
                />
                <span className="min-w-0 flex-1 truncate text-sm">{playlist.name}</span>
                <span className="text-yt-text-secondary">{playlistIcon(playlist, 20)}</span>
              </label>
            </li>
          ))}
        </ul>
        <div className="border-t border-yt-divider">
          {creating ? (
            <form onSubmit={submit} className="px-6 py-4">
              <label className="block text-xs text-yt-text-secondary" htmlFor="new-playlist">
                Nombre
              </label>
              <input
                id="new-playlist"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={150}
                autoFocus
                placeholder="Escribe el nombre de la lista..."
                className="mt-1 w-full border-b border-yt-text-secondary bg-transparent py-1 text-sm outline-none focus:border-yt-text"
              />
              <div className="mt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={!name.trim() || create.isPending}
                  className="h-9 rounded-full px-4 text-sm font-medium text-yt-link hover:bg-[#263850] disabled:opacity-50"
                >
                  Crear
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="flex h-12 w-full items-center gap-4 px-6 text-sm hover:bg-yt-surface"
            >
              <PlusIcon />
              Crear una lista nueva
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
