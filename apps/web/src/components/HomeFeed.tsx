"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { use } from "react";
import { browser } from "react-dom";

import { api, queryKeys } from "@/lib/api";

import { LibraryIcon } from "./icons";
import { VideoCard, VideoCardSkeleton } from "./VideoCard";

export const GRID =
  "grid grid-cols-1 gap-x-4 gap-y-10 xs:grid-cols-2 grid3:grid-cols-3 grid4:grid-cols-4 grid5:grid-cols-5";

export function HomeFeed() {
  use(browser("Library data is fetched from the api in the browser."));
  const channel = useSearchParams().get("channel") ?? undefined;
  const channels = useQuery({
    queryKey: queryKeys.downloadedChannels,
    queryFn: api.downloadedChannels,
  });
  const videos = useQuery({
    queryKey: queryKeys.videos({ channel }),
    queryFn: () => api.videos({ channel, limit: 200 }),
  });

  return (
    <div>
      <ChipBar channels={channels.data ?? []} active={channel} />
      <div className="px-4 pt-6 pb-10 search:px-6">
        {videos.isPending ? (
          <GridSkeleton />
        ) : videos.isError ? (
          <p className="py-20 text-center text-yt-text-secondary">
            No se pudo cargar la biblioteca. Comprueba que la API está en marcha.
          </p>
        ) : videos.data.items.length === 0 ? (
          <EmptyLibrary />
        ) : (
          <div className={GRID}>
            {videos.data.items.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function GridSkeleton() {
  return (
    <div className={GRID}>
      {Array.from({ length: 12 }, (_, index) => (
        <VideoCardSkeleton key={index} />
      ))}
    </div>
  );
}

export function HomeFeedSkeleton() {
  return (
    <div>
      <div className="h-14" />
      <div className="px-4 pt-6 pb-10 search:px-6">
        <GridSkeleton />
      </div>
    </div>
  );
}

function ChipBar({ channels, active }: { channels: string[]; active?: string }) {
  const chips = [{ label: "Todos", href: "/", selected: !active }].concat(
    channels.map((name) => ({
      label: name,
      href: `/?channel=${encodeURIComponent(name)}`,
      selected: active === name,
    })),
  );
  return (
    <div className="sticky top-14 z-10 bg-yt-bg">
      <div className="flex h-14 items-center gap-3 overflow-x-auto px-4 [scrollbar-width:none] search:px-6">
        {chips.map((chip) => (
          <Link
            key={chip.href}
            href={chip.href}
            className={`flex h-8 shrink-0 items-center rounded-lg px-3 text-sm font-medium whitespace-nowrap ${
              chip.selected
                ? "bg-yt-chip-active-bg text-yt-chip-active-text"
                : "bg-yt-surface hover:bg-yt-surface-hover"
            }`}
          >
            {chip.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

function EmptyLibrary() {
  return (
    <div className="flex flex-col items-center py-24 text-center">
      <LibraryIcon size={120} className="text-yt-text-secondary" />
      <h2 className="mt-6 text-2xl">Todavía no hay videos</h2>
      <p className="mt-2 text-sm text-yt-text-secondary">
        Descarga videos de YouTube para verlos aquí desde cualquier dispositivo de tu red.
      </p>
      <Link
        href="/downloads"
        className="mt-6 flex h-9 items-center rounded-full bg-yt-cta-bg px-4 text-sm font-medium text-yt-cta-text hover:bg-yt-cta-hover"
      >
        Descargar un video
      </Link>
    </div>
  );
}
