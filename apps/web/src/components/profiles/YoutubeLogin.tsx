"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { api, queryKeys, type Profile } from "@/lib/api";

import { CloseIcon, ExternalIcon, RetryIcon } from "../icons";
import { ProfileAvatar } from "./ProfileAvatar";

const BROWSER_URL = process.env.NEXT_PUBLIC_BROWSER_URL ?? "/browser/";

/**
 * Shows the Chromium of the browser container so the profile signs in to YouTube there,
 * and waits until the api has picked up the cookies and the account photo.
 */
export function YoutubeLogin({
  profile,
  onDone,
  onCancel,
}: {
  profile: Profile;
  onDone: (profile: Profile) => void;
  onCancel: () => void;
}) {
  const client = useQueryClient();
  const login = useQuery({
    queryKey: queryKeys.youtubeLogin(profile.id),
    queryFn: () => api.youtubeLogin(profile.id),
    refetchInterval: (query) => (query.state.data?.state === "waiting" ? 2000 : false),
    refetchOnWindowFocus: false,
    staleTime: 0,
  });
  const reopen = useMutation({
    mutationFn: () => api.startYoutubeLogin(profile.id),
    onSuccess: (data) => client.setQueryData(queryKeys.youtubeLogin(profile.id), data),
  });

  const state = login.data?.state;
  const signedIn = state === "ready" && login.data?.profile ? login.data.profile : null;

  useEffect(() => {
    if (signedIn) client.invalidateQueries({ queryKey: queryKeys.profiles });
  }, [signedIn, client]);

  if (signedIn) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-yt-bg px-4 text-center">
        <ProfileAvatar profile={signedIn} size={120} />
        <h1 className="mt-6 text-2xl mini:text-3xl">¡Listo, {signedIn.name}!</h1>
        <p className="mt-2 text-yt-text-secondary">
          {signedIn.youtube_name
            ? `Conectado a YouTube como ${signedIn.youtube_name}.`
            : "Conectado a tu cuenta de YouTube."}
        </p>
        <button
          type="button"
          onClick={() => onDone(signedIn)}
          className="mt-8 h-10 rounded-full bg-yt-cta-bg px-8 text-sm font-medium text-yt-cta-text hover:bg-yt-cta-hover"
        >
          Empezar
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-yt-bg">
      <header className="flex shrink-0 items-center gap-3 border-b border-yt-divider px-4 py-2">
        <ProfileAvatar profile={profile} size={32} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-medium">Inicia sesión con tu cuenta de YouTube</h1>
          <p className="truncate text-xs text-yt-text-secondary">
            {state === "idle"
              ? "El navegador se cerró antes de terminar."
              : "LocalTube guarda la sesión y tu foto en cuanto termines. No cierres esta página."}
          </p>
        </div>
        <a
          href={BROWSER_URL}
          target="_blank"
          rel="noreferrer"
          className="hidden h-9 items-center gap-2 rounded-full px-3 text-sm font-medium hover:bg-yt-surface mini:flex"
        >
          <ExternalIcon size={20} />
          Abrir en otra pestaña
        </a>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancelar"
          title="Cancelar"
          className="flex size-10 items-center justify-center rounded-full hover:bg-yt-surface"
        >
          <CloseIcon />
        </button>
      </header>
      {state === "idle" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
          <p className="text-yt-text-secondary">Vuelve a abrir el navegador para iniciar sesión.</p>
          <button
            type="button"
            disabled={reopen.isPending}
            onClick={() => reopen.mutate()}
            className="flex h-9 items-center gap-2 rounded-full bg-yt-surface px-4 text-sm font-medium hover:bg-yt-surface-hover disabled:opacity-50"
          >
            <RetryIcon size={20} />
            Abrir el navegador
          </button>
        </div>
      ) : login.isError ? (
        <div className="flex flex-1 items-center justify-center px-4 text-center text-yt-text-secondary">
          {login.error.message}
        </div>
      ) : (
        <iframe
          src={BROWSER_URL}
          title="Navegador para iniciar sesión en YouTube"
          allow="clipboard-read; clipboard-write; fullscreen"
          className="w-full flex-1 border-0 bg-black"
        />
      )}
    </div>
  );
}
