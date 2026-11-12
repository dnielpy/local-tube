"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { api, queryKeys, type Profile } from "@/lib/api";

import { RetryIcon } from "../icons";
import { cookiesError } from "./CreateProfile";
import { CookiesField } from "./CookiesField";
import { ProfileAvatar } from "./ProfileAvatar";

export function ProfileMenu() {
  const client = useQueryClient();
  const session = useQuery({ queryKey: queryKeys.session, queryFn: api.session, enabled: false });
  const [open, setOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
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
            onClick={() => {
              setOpen(false);
              setUpdating(true);
            }}
            className="flex h-10 w-full items-center gap-4 px-4 text-sm hover:bg-yt-surface"
          >
            <RetryIcon />
            Actualizar cookies de YouTube
          </button>
        </div>
      )}
      {updating && <CookiesDialog profile={profile} onClose={() => setUpdating(false)} />}
    </div>
  );
}

function CookiesDialog({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const client = useQueryClient();
  const [cookies, setCookies] = useState("");
  const [error, setError] = useState<string | null>(null);
  const update = useMutation({
    mutationFn: () => api.updateCookies(profile.id, cookies),
    onSuccess: (updated) => {
      client.setQueryData(queryKeys.session, updated);
      client.invalidateQueries({ queryKey: queryKeys.profiles });
      client.invalidateQueries({ queryKey: queryKeys.channels });
      onClose();
    },
    onError: (failure) => setError(cookiesError(failure)),
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (cookies.trim()) update.mutate();
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-label="Actualizar cookies de YouTube"
        onSubmit={submit}
        onClick={(event) => event.stopPropagation()}
        className="max-h-full w-full max-w-[560px] overflow-y-auto rounded-xl bg-yt-menu p-6 shadow-[0_4px_32px_rgba(0,0,0,0.1)]"
      >
        <h2 className="text-base font-medium">Actualizar cookies de YouTube</h2>
        <p className="mt-2 mb-4 text-sm text-yt-text-secondary">
          Hazlo cuando las descargas fallen con &quot;Sign in to confirm you&apos;re not a bot&quot;
          o cuando quieras cambiar la cuenta de YouTube de {profile.name}.
        </p>
        <CookiesField
          value={cookies}
          onChange={(value) => {
            setCookies(value);
            setError(null);
          }}
          error={error}
        />
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-full px-4 text-sm font-medium hover:bg-yt-surface"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!cookies.trim() || update.isPending}
            className="h-9 rounded-full px-4 text-sm font-medium text-yt-link hover:bg-[#263850] disabled:opacity-50"
          >
            {update.isPending ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </form>
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
