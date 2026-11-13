"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { api, queryKeys } from "@/lib/api";

import { ChannelPhoto } from "../ChannelPhoto";
import { AlertIcon, CloseIcon, SearchIcon } from "../icons";

/** Choose which subscriptions get their new videos offered by the ⚡ button. */
export function AutoDownloadSettingsDialog({ onClose }: { onClose: () => void }) {
  const client = useQueryClient();
  const channels = useQuery({
    queryKey: queryKeys.autoDownloadChannels,
    queryFn: api.autoDownloadChannels,
  });
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const [query, setQuery] = useState("");
  const save = useMutation({
    mutationFn: (ids: string[]) => api.setAutoDownloadChannels(ids),
    onSuccess: (saved) => {
      client.setQueryData(queryKeys.autoDownloadChannels, saved);
      onClose();
    },
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const all = (channels.data ?? []).filter((channel) => channel.id);
  const selected =
    picked ?? new Set(all.filter((channel) => channel.enabled).map((channel) => channel.id!));
  const needle = query.trim().toLowerCase();
  const visible = needle
    ? all.filter((channel) => channel.name.toLowerCase().includes(needle))
    : all;
  const allVisibleSelected = visible.length > 0 && visible.every((c) => selected.has(c.id!));

  function toggle(id: string, on: boolean) {
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    setPicked(next);
  }

  function toggleVisible() {
    const next = new Set(selected);
    for (const channel of visible) {
      if (allVisibleSelected) next.delete(channel.id!);
      else next.add(channel.id!);
    }
    setPicked(next);
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Autodescarga de videos"
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[calc(100vh-32px)] w-full max-w-[480px] flex-col rounded-xl bg-yt-menu shadow-[0_4px_32px_rgba(0,0,0,0.25)]"
      >
        <div className="flex items-start justify-between gap-2 pt-4 pr-2 pl-6">
          <div className="pt-2">
            <h2 className="text-xl leading-7 font-bold">Autodescarga de videos</h2>
            <p className="mt-1 text-sm text-yt-text-secondary">
              El botón ⚡ te propondrá los videos nuevos de estos canales.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-yt-surface"
          >
            <CloseIcon />
          </button>
        </div>

        {all.length > 0 && (
          <div className="flex items-center gap-3 px-6 pt-4 pb-2">
            <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-full border border-yt-border px-3">
              <SearchIcon size={20} className="shrink-0 text-yt-text-secondary" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar canal"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
            </label>
            <button
              type="button"
              onClick={toggleVisible}
              className="h-9 shrink-0 rounded-full px-3 text-sm font-medium text-yt-link hover:bg-yt-surface"
            >
              {allVisibleSelected ? "Quitar todos" : "Seleccionar todos"}
            </button>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto py-2">
          {channels.isPending ? (
            <div className="flex justify-center py-10">
              <div className="size-9 rounded-full border-[3px] border-yt-surface border-t-yt-link [animation:yt-spin_0.9s_linear_infinite]" />
            </div>
          ) : channels.isError ? (
            <p className="flex gap-3 px-6 py-4 text-sm text-yt-error">
              <AlertIcon className="shrink-0" />
              No se pudieron cargar tus suscripciones.
            </p>
          ) : all.length === 0 ? (
            <p className="px-6 py-6 text-sm text-yt-text-secondary">
              Todavía no hay suscripciones. Se sincronizan desde YouTube con las cookies de tu
              perfil: ponlas desde el menú de tu foto, arriba a la derecha.
            </p>
          ) : visible.length === 0 ? (
            <p className="px-6 py-6 text-sm text-yt-text-secondary">Ningún canal coincide.</p>
          ) : (
            <ul>
              {visible.map((channel) => (
                <li key={channel.id}>
                  <label className="flex h-14 cursor-pointer items-center gap-4 px-6 hover:bg-yt-surface">
                    <input
                      type="checkbox"
                      checked={selected.has(channel.id!)}
                      onChange={(event) => toggle(channel.id!, event.target.checked)}
                      className="size-5 shrink-0 accent-yt-text"
                    />
                    <ChannelPhoto src={channel.avatar_url} name={channel.name} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{channel.name}</span>
                      {!channel.subscribed && (
                        <span className="block text-xs text-yt-text-secondary">
                          Ya no estás suscrito
                        </span>
                      )}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        {save.isError && (
          <p className="flex gap-3 px-6 pt-2 text-sm text-yt-error">
            <AlertIcon className="shrink-0" />
            No se pudo guardar. Inténtalo de nuevo.
          </p>
        )}
        <div className="flex items-center justify-between gap-2 border-t border-yt-divider px-6 py-4">
          <span className="text-sm text-yt-text-secondary">
            {selected.size} {selected.size === 1 ? "seleccionado" : "seleccionados"}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-full px-4 text-sm font-medium hover:bg-yt-surface"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={channels.isPending || save.isPending}
              onClick={() => save.mutate([...selected])}
              className="h-9 rounded-full bg-yt-cta-bg px-4 text-sm font-medium text-yt-cta-text hover:bg-yt-cta-hover disabled:opacity-40"
            >
              {save.isPending ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
