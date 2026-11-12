"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

import type { Video } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { watchedFraction } from "@/lib/watch-progress";

import { ChannelAvatar } from "./ChannelAvatar";
import { Thumbnail } from "./Thumbnail";
import { VideoMenu } from "./VideoMenu";

const noSubscribe = () => () => {};

/** Read the saved playback position only in the browser, so the server render stays stable. */
export function useWatchedFraction(id: string) {
  return useSyncExternalStore(
    noSubscribe,
    () => watchedFraction(id),
    () => undefined,
  );
}

/** A tile of the home grid, laid out like youtube.com's rich grid item. */
export function VideoCard({ video }: { video: Video }) {
  const watched = useWatchedFraction(video.id);
  const href = `/watch?v=${video.id}`;
  return (
    <div className="group relative flex flex-col">
      <Link href={href} className="block">
        <Thumbnail video={video} progress={watched} />
      </Link>
      <div className="relative mt-3 flex gap-3 pr-6">
        <Link
          href={`/?channel=${encodeURIComponent(video.channel ?? "")}`}
          aria-label={video.channel ?? undefined}
        >
          <ChannelAvatar name={video.channel} />
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={href}>
            <h3
              className="line-clamp-2 text-base leading-[22px] font-medium text-yt-text"
              title={video.title}
            >
              {video.title}
            </h3>
          </Link>
          <div className="mt-1 text-sm leading-5 text-yt-text-secondary">
            {video.channel && (
              <Link
                href={`/?channel=${encodeURIComponent(video.channel)}`}
                className="block truncate hover:text-yt-text"
              >
                {video.channel}
              </Link>
            )}
            <span>{timeAgo(video.created_at)}</span>
          </div>
        </div>
        <VideoMenu
          video={video}
          className="absolute -top-2 -right-4 opacity-0 group-hover:opacity-100 focus-within:opacity-100 has-[[aria-expanded=true]]:opacity-100 max-mini:opacity-100"
        />
      </div>
    </div>
  );
}

export function VideoCardSkeleton() {
  return (
    <div className="flex flex-col">
      <div className="yt-skeleton aspect-video w-full rounded-xl" />
      <div className="mt-3 flex gap-3">
        <div className="yt-skeleton size-9 shrink-0 rounded-full" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="yt-skeleton h-5 w-[90%] rounded" />
          <div className="yt-skeleton h-5 w-[60%] rounded" />
        </div>
      </div>
    </div>
  );
}
