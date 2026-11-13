"use client";

import { useQuery } from "@tanstack/react-query";
import { use, useState } from "react";
import { browser } from "react-dom";

import { api, queryKeys } from "@/lib/api";

import { BoltIcon, ChevronRightIcon } from "../icons";
import { AutoDownloadSettingsDialog } from "./AutoDownloadSettingsDialog";

export function SettingsView() {
  use(browser("The settings of the profile come from the api."));
  const [editing, setEditing] = useState(false);
  const channels = useQuery({
    queryKey: queryKeys.autoDownloadChannels,
    queryFn: api.autoDownloadChannels,
  });
  const enabled = (channels.data ?? []).filter((channel) => channel.enabled).length;

  return (
    <div className="mx-auto max-w-[800px] px-4 pt-6 pb-10 search:px-6">
      <h1 className="mb-6 text-3xl font-bold mini:text-4xl">Ajustes</h1>
      <section className="overflow-hidden rounded-xl border border-yt-border">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex w-full items-center gap-4 px-4 py-4 text-left hover:bg-yt-surface"
        >
          <BoltIcon className="shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block text-base font-medium">Autodescarga de videos</span>
            <span className="mt-1 block text-sm text-yt-text-secondary">
              {channels.isPending
                ? "Cargando…"
                : enabled === 0
                  ? "Elige los canales cuyos videos nuevos quieres bajar con el botón ⚡"
                  : `${enabled} ${enabled === 1 ? "canal" : "canales"} con autodescarga`}
            </span>
          </span>
          <ChevronRightIcon className="shrink-0 text-yt-text-secondary" />
        </button>
      </section>
      {editing && <AutoDownloadSettingsDialog onClose={() => setEditing(false)} />}
    </div>
  );
}
