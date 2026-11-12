"use client";

import Link from "next/link";

import type { Video } from "@/lib/api";
import { timeAgo } from "@/lib/format";

import { Thumbnail } from "./Thumbnail";
import { useWatchedFraction } from "./VideoCard";

/** The compact list beside the player on youtube.com's watch page. */
export function WatchNext({ videos }: { videos: Video[] }) {
  if (videos.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {videos.map((video) => (
        <CompactVideo key={video.id} video={video} />
      ))}
    </div>
  );
}

function CompactVideo({ video }: { video: Video }) {
  const watched = useWatchedFraction(video.id);
  return (
    <Link href={`/watch?v=${video.id}`} className="group flex gap-2">
      <div className="w-[168px] shrink-0">
        <Thumbnail video={video} rounded="rounded-lg" progress={watched} />
      </div>
      <div className="min-w-0 flex-1 pr-6">
        <h3 className="line-clamp-2 text-sm leading-5 font-medium">{video.title}</h3>
        <p className="mt-1 truncate text-xs leading-[18px] text-yt-text-secondary">
          {video.channel}
        </p>
        <p className="text-xs leading-[18px] text-yt-text-secondary">{timeAgo(video.created_at)}</p>
      </div>
    </Link>
  );
}

export function WatchNextSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 8 }, (_, index) => (
        <div key={index} className="flex gap-2">
          <div className="yt-skeleton aspect-video w-[168px] shrink-0 rounded-lg" />
          <div className="flex-1 space-y-2">
            <div className="yt-skeleton h-4 w-[90%] rounded" />
            <div className="yt-skeleton h-3 w-[50%] rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
