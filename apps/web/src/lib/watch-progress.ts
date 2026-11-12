"use client";

import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { api, queryKeys, type WatchProgress } from "./api";

// Near the end a video counts as watched: its bar is full and it starts again from the top.
const FINISHED_MARGIN = 10;

function useProgressList() {
  return useQuery({
    queryKey: queryKeys.watchProgress,
    queryFn: api.watchProgress,
    staleTime: 60_000,
  });
}

function fraction(entry: WatchProgress | undefined): number | undefined {
  if (!entry?.duration || entry.position <= 0) return undefined;
  if (entry.position >= entry.duration - FINISHED_MARGIN) return 1;
  return entry.position / entry.duration;
}

/** How much of a video the profile has watched, for the red bar under its thumbnail. */
export function useWatchedFraction(id: string): number | undefined {
  const progress = useProgressList();
  return fraction(progress.data?.find((entry) => entry.video_id === id));
}

/** Where to start a video: where the profile left it, or the top when it was finished. */
export async function resumePosition(client: QueryClient, id: string): Promise<number> {
  const progress = await client
    .fetchQuery({ queryKey: queryKeys.watchProgress, queryFn: api.watchProgress, staleTime: 0 })
    .catch(() => []);
  const entry = progress.find((item) => item.video_id === id);
  if (!entry?.duration || entry.position >= entry.duration - FINISHED_MARGIN) return 0;
  return entry.position;
}

/** Saves where a video is in the profile's history, and updates the red bars right away. */
export function useRecordWatch() {
  const client = useQueryClient();
  return useCallback(
    (id: string, position: number, duration: number) => {
      if (!Number.isFinite(duration) || duration <= 0) return;
      client.setQueryData<WatchProgress[]>(queryKeys.watchProgress, (current = []) => [
        { video_id: id, position, duration },
        ...current.filter((entry) => entry.video_id !== id),
      ]);
      api.recordWatch(id, position, duration).catch(() => undefined);
    },
    [client],
  );
}
