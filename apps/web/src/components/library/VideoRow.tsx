import Link from "next/link";
import type { ReactNode } from "react";

import type { Video } from "@/lib/api";
import { channelHref } from "@/lib/format";
import { useWatchedFraction } from "@/lib/watch-progress";

import { Thumbnail } from "../Thumbnail";

/** A video in a vertical list (history, playlist), with its thumbnail on the left. */
export function VideoRow({
  video,
  href,
  index,
  current,
  size = "large",
  actions,
}: {
  video: Video;
  href: string;
  index?: number;
  current?: boolean;
  size?: "large" | "small";
  actions?: ReactNode;
}) {
  const watched = useWatchedFraction(video.id);
  const large = size === "large";
  return (
    <div
      className={`group relative flex items-start gap-2 rounded-xl ${large ? "p-2" : "px-2 py-1"} ${
        current ? "bg-yt-surface" : "hover:bg-yt-surface"
      }`}
    >
      {index != null && (
        <span className="w-6 shrink-0 self-center text-center text-xs text-yt-text-secondary">
          {current ? "▶" : index}
        </span>
      )}
      <Link href={href} className={`shrink-0 ${large ? "w-[160px] mini:w-[246px]" : "w-[100px]"}`}>
        <Thumbnail video={video} rounded="rounded-lg" progress={watched} />
      </Link>
      <div className="min-w-0 flex-1 pr-8">
        <Link href={href}>
          <h3
            className={`line-clamp-2 font-medium ${large ? "text-base leading-[22px] mini:text-lg" : "text-sm leading-5"}`}
          >
            {video.title}
          </h3>
        </Link>
        {video.channel && (
          <Link
            href={channelHref(video)}
            className="mt-1 block truncate text-xs text-yt-text-secondary hover:text-yt-text"
          >
            {video.channel}
          </Link>
        )}
        {large && video.description && (
          <p className="mt-2 line-clamp-2 hidden text-xs text-yt-text-secondary mini:block">
            {video.description}
          </p>
        )}
      </div>
      {actions && <div className="absolute top-1 right-1">{actions}</div>}
    </div>
  );
}
