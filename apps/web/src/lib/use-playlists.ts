"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, queryKeys, type Playlist } from "./api";

/** The profile's playlists, each saying whether it holds `videoId`. */
export function usePlaylistsFor(videoId: string) {
  return useQuery({
    queryKey: queryKeys.playlists(videoId),
    queryFn: () => api.playlists(videoId),
  });
}

/** Adds a video to a playlist or takes it out, and refreshes every list that shows it. */
export function useTogglePlaylist(videoId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ playlist, add }: { playlist: Playlist; add: boolean }) =>
      add ? api.addToPlaylist(playlist.id, videoId) : api.removeFromPlaylist(playlist.id, videoId),
    onMutate: ({ playlist, add }) => {
      client.setQueryData<Playlist[]>(queryKeys.playlists(videoId), (current) =>
        current?.map((item) => (item.id === playlist.id ? { ...item, contains: add } : item)),
      );
    },
    onSettled: (_data, _error, { playlist }) => {
      client.invalidateQueries({ queryKey: queryKeys.allPlaylists });
      client.invalidateQueries({ queryKey: queryKeys.playlist(playlist.id) });
    },
  });
}

/** Saves a video in "Ver más tarde" (or takes it out) in one click. */
export function useWatchLater(videoId: string) {
  const playlists = usePlaylistsFor(videoId);
  const toggle = useTogglePlaylist(videoId);
  const list = playlists.data?.find((playlist) => playlist.kind === "watch_later");
  return {
    saved: list?.contains ?? false,
    ready: Boolean(list),
    toggle: () => list && toggle.mutate({ playlist: list, add: !list.contains }),
  };
}

/** The "Me gusta" button: membership in the "Videos que me gustan" playlist. */
export function useLike(videoId: string) {
  const playlists = usePlaylistsFor(videoId);
  const toggle = useTogglePlaylist(videoId);
  const list = playlists.data?.find((playlist) => playlist.kind === "liked");
  return {
    liked: list?.contains ?? false,
    ready: Boolean(list),
    toggle: () => list && toggle.mutate({ playlist: list, add: !list.contains }),
  };
}
