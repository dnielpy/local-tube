"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { use, useState, type FormEvent } from "react";
import { browser } from "react-dom";

import { api, queryKeys } from "@/lib/api";

import { GRID } from "../HomeFeed";
import { PlusIcon } from "../icons";
import { PlaylistCard, playlistHref } from "./PlaylistCard";

/** Every playlist of the profile, like youtube.com/feed/playlists. */
export function PlaylistsView() {
  use(browser("The playlists of the profile are fetched from the api in the browser."));
  const router = useRouter();
  const params = useSearchParams();
  const playlists = useQuery({ queryKey: queryKeys.playlists(), queryFn: () => api.playlists() });
  const [creating, setCreating] = useState(params.get("new") === "1");

  return (
    <div className="px-4 pt-6 pb-10 search:px-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold mini:text-4xl">Listas de reproducción</h1>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex h-9 items-center gap-2 rounded-full bg-yt-surface px-4 text-sm font-medium hover:bg-yt-surface-hover"
        >
          <PlusIcon />
          Nueva lista
        </button>
      </div>
      <div className={GRID}>
        {(playlists.data ?? []).map((playlist) => (
          <PlaylistCard key={playlist.id} playlist={playlist} />
        ))}
      </div>
      {creating && (
        <NameDialog
          title="Nueva lista de reproducción"
          confirmLabel="Crear"
          onClose={() => setCreating(false)}
          onSaved={(id) => router.push(playlistHref({ id }))}
        />
      )}
    </div>
  );
}

/** Asks for a playlist name, to create a playlist or rename one. */
export function NameDialog({
  title,
  confirmLabel,
  initial = "",
  playlistId,
  onClose,
  onSaved,
}: {
  title: string;
  confirmLabel: string;
  initial?: string;
  playlistId?: string;
  onClose: () => void;
  onSaved?: (id: string) => void;
}) {
  const client = useQueryClient();
  const [name, setName] = useState(initial);
  const save = useMutation({
    mutationFn: () =>
      playlistId ? api.renamePlaylist(playlistId, name.trim()) : api.createPlaylist(name.trim()),
    onSuccess: (playlist) => {
      client.invalidateQueries({ queryKey: queryKeys.allPlaylists });
      client.invalidateQueries({ queryKey: queryKeys.playlist(playlist.id) });
      onClose();
      onSaved?.(playlist.id);
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (name.trim()) save.mutate();
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onSubmit={submit}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-[400px] rounded-xl bg-yt-menu p-6 shadow-[0_4px_32px_rgba(0,0,0,0.25)]"
      >
        <h2 className="text-base font-medium">{title}</h2>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => event.key === "Escape" && onClose()}
          maxLength={150}
          autoFocus
          placeholder="Nombre"
          aria-label="Nombre de la lista"
          className="mt-4 w-full border-b border-yt-text-secondary bg-transparent py-1 text-sm outline-none focus:border-yt-text"
        />
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-full px-4 text-sm font-medium hover:bg-yt-surface"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!name.trim() || save.isPending}
            className="h-9 rounded-full px-4 text-sm font-medium text-yt-link hover:bg-[#263850] disabled:opacity-50"
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
