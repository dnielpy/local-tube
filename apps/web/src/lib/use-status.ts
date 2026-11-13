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
      client.invalidateQueries({ queryKey: queryKeys.feed });
    }
    previous.current = online;
  }, [online, client]);
}

export type Connection = {
  tone: "online" | "expired" | "offline";
  label: string;
  detail: string;
};

export const CONNECTION_COLORS: Record<Connection["tone"], string> = {
  online: "bg-[#2ba640]",
  expired: "bg-[#f2b600]",
  offline: "bg-[#ff4e45]",
};

/**
 * Green when YouTube answers and the profile's cookies work, yellow when YouTube answers but no
 * longer accepts the cookies, red when there is no connection or offline mode is on.
 */
export function useConnection(): Connection | undefined {
  const status = useStatus();
  const online = status.data?.online ?? false;
  const cookies = useQuery({
    queryKey: queryKeys.cookieStatus,
    queryFn: api.cookieStatus,
    enabled: online,
    // The api only asks YouTube again every 30 minutes; this picks up downloads that hit the
    // bot check in between.
    refetchInterval: 60_000,
  });

  if (!status.data) return undefined;
  if (status.data.forced_offline) {
    return { tone: "offline", label: "Sin conexión", detail: "Modo sin conexión activado" };
  }
  if (!online) return { tone: "offline", label: "Sin conexión", detail: "YouTube no responde" };
  if (cookies.data?.cookies_valid === false) {
    return { tone: "expired", label: "Cookies vencidas", detail: "Actualízalas para descargar" };
  }
  return { tone: "online", label: "En línea", detail: "Conectado a YouTube" };
}
