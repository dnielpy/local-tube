import Link from "next/link";

import type { Playlist } from "@/lib/api";
import { timeAgo } from "@/lib/format";

import { PlaylistIcon } from "../icons";
import { playlistIcon } from "./SaveDialog";

export function playlistHref(playlist: Pick<Playlist, "id">) {
  return `/playlist?list=${playlist.id}`;
}

/** A playlist as YouTube shows it: stacked thumbnails with the video count over them. */
export function PlaylistCard({ playlist }: { playlist: Playlist }) {
  const href = playlistHref(playlist);
  return (
    <div className="flex flex-col">
      <Link href={href} className="group relative block pt-2">
        <div className="absolute inset-x-4 top-0 h-2 rounded-t-lg bg-yt-surface-hover" />
        <div className="absolute inset-x-2 top-1 h-2 rounded-t-lg bg-yt-surface" />
        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-yt-skeleton">
          {playlist.thumbnail_url ? (
            <img
              src={playlist.thumbnail_url}
              alt=""
              loading="lazy"
              className="absolute inset-0 size-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-yt-text-secondary">
              {playlistIcon(playlist, 40)}
            </div>
          )}
          <span className="absolute right-1 bottom-1 flex items-center gap-1 rounded bg-black/60 px-1 py-[1px] text-xs leading-[18px] font-medium text-white">
            <PlaylistIcon size={16} />
            {playlist.count} {playlist.count === 1 ? "video" : "videos"}
          </span>
          <span className="absolute inset-0 flex items-center justify-center bg-black/60 text-sm font-medium tracking-wide text-white uppercase opacity-0 transition-opacity group-hover:opacity-100">
            Reproducir todo
          </span>
        </div>
      </Link>
      <Link href={href} className="mt-3">
        <h3 className="line-clamp-2 text-sm leading-5 font-medium">{playlist.name}</h3>
      </Link>
      <p className="mt-1 text-xs text-yt-text-secondary">
        {playlist.kind === "custom" ? "Privada" : "Lista automática"} · Actualizada{" "}
        {timeAgo(playlist.updated_at)}
      </p>
      <Link
        href={href}
        className="mt-1 text-xs font-medium text-yt-text-secondary hover:text-yt-text"
      >
        Ver lista completa
      </Link>
    </div>
  );
}
