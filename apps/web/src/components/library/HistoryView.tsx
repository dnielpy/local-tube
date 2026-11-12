"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { use, useState, type FormEvent } from "react";
import { browser } from "react-dom";

import { api, queryKeys, type HistoryEntry } from "@/lib/api";

import { ConfirmDialog } from "../Dialog";
import { CloseIcon, SearchIcon, TrashIcon } from "../icons";
import { VideoRow } from "./VideoRow";

const DAY = 24 * 60 * 60 * 1000;

function dayLabel(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  if (day === today) return "Hoy";
  if (day === today - DAY) return "Ayer";
  if (today - day < 7 * DAY) {
    const weekday = date.toLocaleDateString("es", { weekday: "long" });
    return weekday.charAt(0).toUpperCase() + weekday.slice(1);
  }
  return date.toLocaleDateString("es", {
    day: "numeric",
    month: "short",
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });
}

function byDay(entries: HistoryEntry[]): [string, HistoryEntry[]][] {
  const groups = new Map<string, HistoryEntry[]>();
  for (const entry of entries) {
    const label = dayLabel(entry.watched_at);
    groups.set(label, [...(groups.get(label) ?? []), entry]);
  }
  return [...groups];
}

/** The watch history, like youtube.com/feed/history. */
export function HistoryView() {
  use(browser("The history of the profile is fetched from the api in the browser."));
  const client = useQueryClient();
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [confirming, setConfirming] = useState(false);
  const history = useQuery({
    queryKey: queryKeys.history(query, 200),
    queryFn: () => api.history({ q: query, limit: 200 }),
    staleTime: 0,
  });
  const refresh = () => {
    client.invalidateQueries({ queryKey: queryKeys.allHistory });
    client.invalidateQueries({ queryKey: queryKeys.watchProgress });
  };
  const forget = useMutation({ mutationFn: api.forgetWatch, onSuccess: refresh });
  const clear = useMutation({
    mutationFn: api.clearHistory,
    onSuccess: () => {
      setConfirming(false);
      refresh();
    },
  });

  function search(event: FormEvent) {
    event.preventDefault();
    setQuery(draft.trim());
  }

  const entries = history.data?.items ?? [];

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col-reverse gap-6 px-4 pt-6 pb-10 search:px-6 watch:flex-row">
      <div className="min-w-0 flex-1">
        <h1 className="mb-4 text-3xl font-bold mini:text-4xl">Historial de reproducciones</h1>
        {history.isPending ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="flex gap-2 p-2">
                <div className="yt-skeleton aspect-video w-[246px] shrink-0 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="yt-skeleton h-5 w-[80%] rounded" />
                  <div className="yt-skeleton h-4 w-[40%] rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <p className="py-16 text-center text-sm text-yt-text-secondary">
            {query
              ? `No hay videos de tu historial que coincidan con «${query}».`
              : "Esta lista no tiene videos. Los que veas aparecerán aquí."}
          </p>
        ) : (
          byDay(entries).map(([label, group]) => (
            <section key={label} className="mb-6">
              <h2 className="mb-2 text-xl font-bold">{label}</h2>
              <div className="flex flex-col">
                {group.map((entry) => (
                  <VideoRow
                    key={entry.video.id}
                    video={entry.video}
                    href={`/watch?v=${entry.video.id}`}
                    actions={
                      <button
                        type="button"
                        aria-label="Quitar del historial"
                        title="Quitar del historial"
                        onClick={() => forget.mutate(entry.video.id)}
                        className="flex size-10 items-center justify-center rounded-full opacity-0 group-hover:opacity-100 hover:bg-yt-surface-hover focus-visible:opacity-100 max-mini:opacity-100"
                      >
                        <CloseIcon />
                      </button>
                    }
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </div>

      <aside className="shrink-0 watch:sticky watch:top-20 watch:w-[300px] watch:self-start watch:pt-16">
        <form
          onSubmit={search}
          className="flex h-10 items-center gap-3 border-b border-yt-text-secondary focus-within:border-yt-text"
        >
          <button type="submit" aria-label="Buscar en el historial">
            <SearchIcon />
          </button>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Buscar en el historial"
            aria-label="Buscar en el historial"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-yt-text-secondary"
          />
          {draft && (
            <button
              type="button"
              aria-label="Borrar búsqueda"
              onClick={() => {
                setDraft("");
                setQuery("");
              }}
            >
              <CloseIcon />
            </button>
          )}
        </form>
        <button
          type="button"
          disabled={(history.data?.total ?? 0) === 0 && !query}
          onClick={() => setConfirming(true)}
          className="mt-4 flex h-9 items-center gap-3 rounded-full px-3 text-sm font-medium hover:bg-yt-surface disabled:opacity-50"
        >
          <TrashIcon />
          Borrar todo el historial de reproducciones
        </button>
      </aside>

      <ConfirmDialog
        open={confirming}
        title="¿Borrar el historial de reproducciones?"
        confirmLabel="Borrar historial"
        busy={clear.isPending}
        onCancel={() => setConfirming(false)}
        onConfirm={() => clear.mutate()}
      >
        Se borra el historial de este perfil y dónde te quedaste en cada video. Los videos siguen en
        tu biblioteca.
      </ConfirmDialog>
    </div>
  );
}
