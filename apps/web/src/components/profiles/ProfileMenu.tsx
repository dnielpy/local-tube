"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { api, queryKeys, type Profile } from "@/lib/api";
import { useOnline } from "@/lib/use-status";

import { RetryIcon } from "../icons";
import { ProfileAvatar } from "./ProfileAvatar";
import { YoutubeLogin } from "./YoutubeLogin";

export function ProfileMenu() {
  const client = useQueryClient();
  const session = useQuery({ queryKey: queryKeys.session, queryFn: api.session, enabled: false });
  const online = useOnline();
  const [open, setOpen] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const profile = session.data;
  if (!profile) return null;

  async function switchProfile() {
    setOpen(false);
    await api.logout().catch(() => undefined);
    client.clear();
  }

  async function signInAgain(current: Profile) {
    setOpen(false);
    setError(null);
    try {
      await api.startYoutubeLogin(current.id);
      client.removeQueries({ queryKey: queryKeys.youtubeLogin(current.id) });
      setSigningIn(true);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "No se pudo abrir el navegador.");
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={`Perfil de ${profile.name}`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex size-10 items-center justify-center rounded-full"
      >
        <ProfileAvatar profile={profile} size={32} rounded="rounded-full" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute top-11 right-0 z-50 w-[300px] rounded-xl bg-yt-menu py-2 shadow-[0_4px_32px_rgba(0,0,0,0.25)]"
        >
          <div className="flex gap-4 border-b border-yt-divider px-4 pt-2 pb-4">
            <ProfileAvatar profile={profile} size={40} rounded="rounded-full" />
            <div className="min-w-0">
              <p className="truncate text-base">{profile.name}</p>
              {profile.youtube_name && (
                <p className="truncate text-sm text-yt-text-secondary">{profile.youtube_name}</p>
              )}
            </div>
          </div>
          <button
            role="menuitem"
            type="button"
            onClick={switchProfile}
            className="mt-2 flex h-10 w-full items-center gap-4 px-4 text-sm hover:bg-yt-surface"
          >
            <SwitchIcon />
            Cambiar de perfil
          </button>
          <button
            role="menuitem"
            type="button"
            disabled={!online}
            onClick={() => signInAgain(profile)}
            className="flex h-10 w-full items-center gap-4 px-4 text-sm hover:bg-yt-surface disabled:opacity-50"
          >
            <RetryIcon />
            Volver a iniciar sesión en YouTube
          </button>
        </div>
      )}
      {error && (
        <p
          role="alert"
          className="absolute top-12 right-0 z-50 w-[260px] rounded-lg bg-yt-menu p-3 text-sm text-yt-error shadow-[0_4px_32px_rgba(0,0,0,0.25)]"
        >
          {error}
        </p>
      )}
      {signingIn && (
        <div className="fixed inset-0 z-[70]">
          <YoutubeLogin
            profile={profile}
            onCancel={() => {
              api.cancelYoutubeLogin(profile.id).catch(() => undefined);
              setSigningIn(false);
            }}
            onDone={(ready) => {
              client.setQueryData(queryKeys.session, ready);
              client.invalidateQueries({ queryKey: queryKeys.channels });
              setSigningIn(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

function SwitchIcon() {
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} fill="currentColor" aria-hidden>
      <path d="M15 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm0 1a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm0 8c3.31 0 6 1.79 6 4v2H9v-2c0-2.21 2.69-4 6-4zm0 1c-2.76 0-5 1.34-5 3v1h10v-1c0-1.66-2.24-3-5-3zM6 7v3h3v1H6v3H5v-3H2v-1h3V7h1z" />
    </svg>
  );
}
