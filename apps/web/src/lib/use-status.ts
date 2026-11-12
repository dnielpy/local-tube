"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { api, queryKeys } from "./api";

export function useStatus() {
  return useQuery({
    queryKey: queryKeys.status,
    queryFn: api.status,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    staleTime: 10_000,
  });
}

export function useOnline(): boolean {
  return useStatus().data?.online ?? false;
}

export function useSetForcedOffline() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: api.setForcedOffline,
    onSuccess: (status) => client.setQueryData(queryKeys.status, status),
  });
}

export function useRefetchOnStatusChange() {
  const client = useQueryClient();
  const online = useStatus().data?.online;
  const previous = useRef(online);
  useEffect(() => {
    if (previous.current !== undefined && previous.current !== online) {
      client.invalidateQueries({ queryKey: queryKeys.channels });
      client.invalidateQueries({ queryKey: queryKeys.allChannels });
    }
    previous.current = online;
  }, [online, client]);
}
