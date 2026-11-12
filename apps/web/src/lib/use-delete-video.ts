"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api, queryKeys } from "./api";

export function useDeleteVideo(onDeleted?: () => void) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: api.deleteVideo,
    onSuccess: () => {
      client.invalidateQueries({ queryKey: queryKeys.allVideos });
      client.invalidateQueries({ queryKey: queryKeys.channels });
      client.invalidateQueries({ queryKey: queryKeys.downloadedChannels });
      client.invalidateQueries({ queryKey: queryKeys.allChannels });
      client.invalidateQueries({ queryKey: queryKeys.allHistory });
      client.invalidateQueries({ queryKey: queryKeys.watchProgress });
      client.invalidateQueries({ queryKey: queryKeys.allPlaylists });
      client.invalidateQueries({ queryKey: ["playlist"] });
      onDeleted?.();
    },
  });
}
