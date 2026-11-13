"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { use, useState, type ComponentType, type ReactNode } from "react";
import { browser } from "react-dom";

import { api, queryKeys } from "@/lib/api";

import { BoltIcon, ChevronRightIcon, FeedIcon } from "../icons";
import { AutoDownloadSettingsDialog } from "./AutoDownloadSettingsDialog";
import { FeedSettingsDialog } from "./FeedSettingsDialog";

type Module = "feed" | "auto-download";

export function SettingsView() {
  use(browser("The settings of the profile come from the api."));
  const opened = useSearchParams().get("open");
  const [editing, setEditing] = useState<Module | null>(
    opened === "feed" || opened === "auto-download" ? opened : null,
  );
  const feedChannels = useQuery({ queryKey: queryKeys.feedChannels, queryFn: api.feedChannels });
  const autoChannels = useQuery({
    queryKey: queryKeys.autoDownloadChannels,
    queryFn: api.autoDownloadChannels,
  });
  const inFeed = (feedChannels.data ?? []).filter((channel) => channel.enabled).length;
  const enabled = (autoChannels.data ?? []).filter((channel) => channel.enabled).length;

  return (
    <div className="mx-auto max-w-[800px] px-4 pt-6 pb-10 search:px-6">
      <h1 className="mb-6 text-3xl font-bold mini:text-4xl">Ajustes</h1>
      <section className="divide-y divide-yt-border overflow-hidden rounded-xl border border-yt-border">
        <ModuleRow icon={FeedIcon} title="Feed" onOpen={() => setEditing("feed")}>
          {feedChannels.isPending
            ? "Cargando…"
            : inFeed === 0
              ? "Elige los canales cuyo último video quieres ver al entrar"
              : `${inFeed} ${inFeed === 1 ? "canal" : "canales"} en el feed`}
        </ModuleRow>
        <ModuleRow
          icon={BoltIcon}
          title="Autodescarga de videos"
          onOpen={() => setEditing("auto-download")}
        >
          {autoChannels.isPending
            ? "Cargando…"
            : enabled === 0
              ? "Elige los canales cuyos videos nuevos quieres bajar con el botón ⚡"
              : `${enabled} ${enabled === 1 ? "canal" : "canales"} con autodescarga`}
        </ModuleRow>
      </section>
      {editing === "feed" && <FeedSettingsDialog onClose={() => setEditing(null)} />}
      {editing === "auto-download" && (
        <AutoDownloadSettingsDialog onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function ModuleRow({
  icon: Icon,
  title,
  onOpen,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  onOpen: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-4 px-4 py-4 text-left hover:bg-yt-surface"
    >
      <Icon className="shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block text-base font-medium">{title}</span>
        <span className="mt-1 block text-sm text-yt-text-secondary">{children}</span>
      </span>
      <ChevronRightIcon className="shrink-0 text-yt-text-secondary" />
    </button>
  );
}
