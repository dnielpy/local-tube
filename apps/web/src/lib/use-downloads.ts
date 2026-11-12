"use client";

import { useQuery } from "@tanstack/react-query";

import { api, queryKeys, type DownloadJob } from "./api";

const ACTIVE = new Set<DownloadJob["status"]>(["queued", "downloading", "processing"]);

export const isActiveJob = (job: DownloadJob) => ACTIVE.has(job.status);

export function useDownloadJobs() {
  return useQuery({
    queryKey: queryKeys.downloads,
    queryFn: api.downloads,
    refetchInterval: (query) => (query.state.data?.some(isActiveJob) ? 1500 : 15_000),
  });
}
