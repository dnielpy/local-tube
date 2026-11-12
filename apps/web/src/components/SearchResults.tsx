"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { use } from "react";
import { browser } from "react-dom";

import { api, queryKeys, type Video } from "@/lib/api";
import { channelHref, timeAgo } from "@/lib/format";
import { useWatchedFraction } from "@/lib/watch-progress";

import { ChannelPhoto } from "./ChannelPhoto";
import { SearchIcon } from "./icons";
import { Thumbnail } from "./Thumbnail";
import { VideoMenu } from "./VideoMenu";

export function SearchResults() {
  use(browser("Library data is fetched from the api in the browser."));
  const query = useSearchParams().get("search_query") ?? "";
  const results = useQuery({
    queryKey: queryKeys.videos({ q: query }),
    queryFn: () => api.videos({ q: query, limit: 100 }),
    enabled: query.length > 0,
  });

  return (
    <div className="mx-auto max-w-[1096px] px-4 pt-4 pb-10 search:px-6">
      {results.isPending && query ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="flex flex-col gap-4 xs:flex-row">
              <div className="yt-skeleton aspect-video w-full rounded-xl xs:max-w-[360px]" />
              <div className="flex-1 space-y-3 pt-1">
                <div className="yt-skeleton h-6 w-[80%] rounded" />
                <div className="yt-skeleton h-4 w-[40%] rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : !results.data || results.data.items.length === 0 ? (
        <div className="flex flex-col items-center py-24 text-center">
          <SearchIcon size={120} className="text-yt-text-secondary" />
          <h2 className="mt-6 text-2xl">No se han encontrado resultados</h2>
          <p className="mt-2 text-sm text-yt-text-secondary">
            Prueba con otras palabras clave o descarga el video primero.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {results.data.items.map((video) => (
            <ResultRow key={video.id} video={video} />
          ))}
        </div>
      )}
    </div>
  );
}

function ResultRow({ video }: { video: Video }) {
  const watched = useWatchedFraction(video.id);
  const href = `/watch?v=${video.id}`;
  return (
    <div className="group flex flex-col gap-3 xs:flex-row xs:gap-4">
      <Link href={href} className="block w-full shrink-0 xs:max-w-[360px] xs:basis-[45%]">
        <Thumbnail video={video} progress={watched} />
      </Link>
      <div className="relative min-w-0 flex-1 pr-8">
        <Link href={href}>
          <h3 className="line-clamp-2 text-lg leading-[26px] text-yt-text">{video.title}</h3>
        </Link>
        <p className="text-xs leading-[18px] text-yt-text-secondary">{timeAgo(video.created_at)}</p>
        {video.channel && (
          <Link
            href={channelHref(video)}
            className="flex items-center gap-2 py-3 text-xs text-yt-text-secondary hover:text-yt-text"
          >
            <ChannelPhoto src={video.channel_avatar_url} name={video.channel} size={24} />
            {video.channel}
          </Link>
        )}
        {video.description && (
          <p className="line-clamp-2 text-xs leading-[18px] text-yt-text-secondary">
            {video.description}
          </p>
        )}
        <VideoMenu
          video={video}
          className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 has-[[aria-expanded=true]]:opacity-100 max-mini:opacity-100"
        />
      </div>
    </div>
  );
}
