"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { use, type ReactNode } from "react";
import { browser } from "react-dom";

import { api, ApiError, queryKeys } from "@/lib/api";
import { setProgressProfile } from "@/lib/watch-progress";

import { CreateProfile } from "./CreateProfile";
import { ProfilePicker } from "./ProfilePicker";

/** Shows the profile picker until a profile is unlocked, and the app after. */
export function ProfileGate({ children }: { children: ReactNode }) {
  use(browser("The profile session lives in a cookie only the api can read."));
  const client = useQueryClient();
  const session = useQuery({
    queryKey: queryKeys.session,
    queryFn: api.session,
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  if (session.isPending) return <div className="min-h-dvh bg-yt-bg" />;
  if (session.isError) {
    if (session.error instanceof ApiError && session.error.status === 401) return <ProfilePicker />;
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-yt-text-secondary">
          No se pudo conectar con LocalTube. Comprueba que la API está en marcha.
        </p>
        <button
          type="button"
          onClick={() => session.refetch()}
          className="h-9 rounded-full bg-yt-surface px-4 text-sm font-medium hover:bg-yt-surface-hover"
        >
          Reintentar
        </button>
      </div>
    );
  }
  if (session.data.status === "pending") {
    return (
      <CreateProfile
        pending={session.data}
        onCancel={() => client.invalidateQueries({ queryKey: queryKeys.session })}
      />
    );
  }

  setProgressProfile(session.data.id);
  return children;
}

export function ProfileGateFallback() {
  return <div className="min-h-dvh bg-yt-bg" />;
}
