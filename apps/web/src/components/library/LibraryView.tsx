"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { use, type ReactNode } from "react";
import { browser } from "react-dom";

import { api, queryKeys, type Playlist } from "@/lib/api";

import { HistoryIcon, LikeIcon, PlaylistIcon, PlusIcon, WatchLaterIcon } from "../icons";
import { ProfileAvatar } from "../profiles/ProfileAvatar";
import { VideoCard, VideoCardSkeleton } from "../VideoCard";
import { PlaylistCard, playlistHref } from "./PlaylistCard";
import { Shelf } from "./Shelf";

const SHELF_SIZE = 12;

/** The "Tú" page: the profile, its history and its playlists, like youtube.com/feed/you. */
export function LibraryView() {
  use(browser("The library of the profile is fetched from the api in the browser."));
  const session = useQuery({ queryKey: queryKeys.session, queryFn: api.session, enabled: false });
  const history = useQuery({
    queryKey: queryKeys.history("", SHELF_SIZE),
    queryFn: () => api.history({ limit: SHELF_SIZE }),
    staleTime: 0,
  });
  const playlists = useQuery({ queryKey: queryKeys.playlists(), queryFn: () => api.playlists() });
  const lists = playlists.data ?? [];
  const watchLater = lists.find((list) => list.kind === "watch_later");
  const liked = lists.find((list) => list.kind === "liked");
  const profile = session.data;

  return (
    <div className="mx-auto max-w-[1284px] px-4 pb-10 search:px-6">
      {profile && (
        <header className="flex items-center gap-6 pt-6 pb-2">
          <ProfileAvatar profile={profile} size={120} rounded="rounded-full" />
          <div className="min-w-0">
            <h1 className="truncate text-3xl font-bold mini:text-4xl">{profile.name}</h1>
            {profile.youtube_name && (
              <p className="mt-2 truncate text-sm text-yt-text-secondary">{profile.youtube_name}</p>
            )}
          </div>
        </header>
      )}

      <Shelf
        title="Historial"
        href="/history"
        icon={<HistoryIcon />}
        empty={
          history.data && history.data.items.length === 0
            ? "Los videos que veas aparecerán aquí."
            : undefined
        }
      >
        {history.isPending
          ? Array.from({ length: 4 }, (_, index) => <VideoCardSkeleton key={index} />)
          : history.data?.items.map((entry) => (
              <VideoCard key={entry.video.id} video={entry.video} />
            ))}
      </Shelf>

      {watchLater && (
        <PlaylistShelf
          playlist={watchLater}
          icon={<WatchLaterIcon />}
          empty="Guarda videos para verlos más tarde. Aparecerán aquí."
        />
      )}

      <Shelf title="Listas de reproducción" href="/playlists" icon={<PlaylistIcon />}>
        {lists.map((playlist) => (
          <PlaylistCard key={playlist.id} playlist={playlist} />
        ))}
        <NewPlaylistCard />
      </Shelf>

      {liked && (
        <PlaylistShelf
          playlist={liked}
          icon={<LikeIcon />}
          empty="Los videos que te gusten aparecerán aquí."
        />
      )}
    </div>
  );
}

function PlaylistShelf({
  playlist,
  icon,
  empty,
}: {
  playlist: Playlist;
  icon: ReactNode;
  empty: string;
}) {
  const detail = useQuery({
    queryKey: queryKeys.playlist(playlist.id),
    queryFn: () => api.playlist(playlist.id),
  });
  const items = detail.data?.items ?? [];
  return (
    <Shelf
      title={playlist.name}
      href={playlistHref(playlist)}
      icon={icon}
      empty={detail.data && items.length === 0 ? empty : undefined}
    >
      {items.slice(0, SHELF_SIZE).map((item) => (
        <VideoCard key={item.video.id} video={item.video} />
      ))}
    </Shelf>
  );
}

function NewPlaylistCard() {
  return (
    <Link href="/playlists?new=1" className="group flex flex-col">
      <div className="mt-2 flex aspect-video w-full items-center justify-center rounded-xl border border-dashed border-yt-border text-yt-text-secondary group-hover:bg-yt-surface group-hover:text-yt-text">
        <PlusIcon size={32} />
      </div>
      <span className="mt-3 text-sm font-medium">Nueva lista</span>
    </Link>
  );
}
