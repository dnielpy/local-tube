"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { api, ApiError, queryKeys, type Profile } from "@/lib/api";
import { useOnline } from "@/lib/use-status";

import { BackIcon, Logo, TrashIcon } from "../icons";
import { CreateProfile } from "./CreateProfile";
import { PinPad } from "./PinPad";
import { ProfileAvatar } from "./ProfileAvatar";

type Detail = { message?: string; remaining?: number; retry_after?: number };

function pinError(error: unknown): { message: string; retryAfter: number } {
  if (!(error instanceof ApiError))
    return { message: "No se pudo comprobar el PIN.", retryAfter: 0 };
  const detail = (error.detail ?? {}) as Detail;
  if (error.status === 429) {
    return { message: "Demasiados intentos.", retryAfter: detail.retry_after ?? 60 };
  }
  if (error.status === 403) {
    const left = detail.remaining;
    return {
      message:
        left === 1
          ? "PIN incorrecto. Te queda 1 intento."
          : `PIN incorrecto. Te quedan ${left} intentos.`,
      retryAfter: 0,
    };
  }
  return { message: error.message, retryAfter: 0 };
}

export function ProfilePicker() {
  const profiles = useQuery({ queryKey: queryKeys.profiles, queryFn: api.profiles });
  const online = useOnline();
  const [selected, setSelected] = useState<{ profile: Profile; action: "unlock" | "delete" }>();
  const [managing, setManaging] = useState(false);
  const [creating, setCreating] = useState(false);

  if (creating) return <CreateProfile onCancel={() => setCreating(false)} />;
  if (selected) {
    return (
      <PinScreen
        profile={selected.profile}
        action={selected.action}
        onBack={() => setSelected(undefined)}
      />
    );
  }

  const items = profiles.data ?? [];
  return (
    <div className="flex min-h-dvh flex-col bg-yt-bg">
      <div className="flex h-14 items-center px-6">
        <Logo />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center px-4 pb-16">
        <h1 className="text-center text-3xl font-medium mini:text-5xl">
          {managing ? "Administrar perfiles" : "¿Quién está viendo?"}
        </h1>
        {profiles.isError ? (
          <p className="mt-8 text-yt-text-secondary">
            No se pudo conectar con LocalTube. Comprueba que la API está en marcha.
          </p>
        ) : (
          <ul className="mt-10 flex max-w-[880px] flex-wrap justify-center gap-6 mini:gap-8">
            {items.map((profile) => (
              <li key={profile.id}>
                <button
                  type="button"
                  onClick={() => setSelected({ profile, action: managing ? "delete" : "unlock" })}
                  className="group flex w-[104px] flex-col items-center gap-3 mini:w-[150px]"
                >
                  <span className="relative overflow-hidden rounded-md outline-3 outline-transparent transition-[outline-color] group-hover:outline-yt-text group-focus-visible:outline-yt-text">
                    <span className="hidden mini:block">
                      <ProfileAvatar profile={profile} size={150} />
                    </span>
                    <span className="mini:hidden">
                      <ProfileAvatar profile={profile} size={104} />
                    </span>
                    {managing && (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/60 text-white">
                        <TrashIcon size={36} />
                      </span>
                    )}
                  </span>
                  <span className="w-full truncate text-center text-base text-yt-text-secondary group-hover:text-yt-text">
                    {profile.name}
                  </span>
                </button>
              </li>
            ))}
            {!managing && (
              <li>
                <button
                  type="button"
                  disabled={!online}
                  onClick={() => setCreating(true)}
                  title={online ? undefined : "Necesitas conexión para iniciar sesión en YouTube"}
                  className="group flex w-[104px] flex-col items-center gap-3 disabled:opacity-40 mini:w-[150px]"
                >
                  <span className="flex size-[104px] items-center justify-center rounded-md text-7xl font-light text-yt-text-secondary transition-colors group-enabled:group-hover:bg-yt-surface group-enabled:group-hover:text-yt-text mini:size-[150px]">
                    +
                  </span>
                  <span className="text-center text-base text-yt-text-secondary group-enabled:group-hover:text-yt-text">
                    Agregar perfil
                  </span>
                </button>
              </li>
            )}
          </ul>
        )}
        {!online && !managing && (
          <p className="mt-6 max-w-[420px] text-center text-sm text-yt-text-secondary">
            Sin conexión no se pueden crear perfiles, porque cada perfil inicia sesión en YouTube.
          </p>
        )}
        {items.length > 0 && (
          <button
            type="button"
            onClick={() => setManaging((value) => !value)}
            className={`mt-12 h-10 border px-6 text-sm tracking-widest uppercase ${
              managing
                ? "border-yt-text bg-yt-text text-yt-bg"
                : "border-yt-text-secondary text-yt-text-secondary hover:border-yt-text hover:text-yt-text"
            }`}
          >
            {managing ? "Listo" : "Administrar perfiles"}
          </button>
        )}
      </div>
    </div>
  );
}

function PinScreen({
  profile,
  action,
  onBack,
}: {
  profile: Profile;
  action: "unlock" | "delete";
  onBack: () => void;
}) {
  const client = useQueryClient();
  const [failures, setFailures] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const locked = lockedUntil > now;

  useEffect(() => {
    if (!lockedUntil) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [lockedUntil]);

  const submit = useMutation({
    mutationFn: (pin: string) =>
      action === "unlock"
        ? api.unlockProfile(profile.id, pin)
        : api.deleteProfile(profile.id, pin).then(() => null),
    onSuccess: (unlocked) => {
      if (unlocked) {
        client.clear();
        client.setQueryData(queryKeys.session, unlocked);
      } else {
        client.invalidateQueries({ queryKey: queryKeys.profiles });
        onBack();
      }
    },
    onError: (failure) => {
      const { message, retryAfter } = pinError(failure);
      setError(message);
      setFailures((value) => value + 1);
      if (retryAfter) {
        setNow(Date.now());
        setLockedUntil(Date.now() + retryAfter * 1000);
      }
    },
  });

  const seconds = Math.ceil((lockedUntil - now) / 1000);
  return (
    <div className="flex min-h-dvh flex-col bg-yt-bg">
      <div className="flex h-14 items-center px-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="Volver a los perfiles"
          className="flex size-10 items-center justify-center rounded-full hover:bg-yt-surface"
        >
          <BackIcon />
        </button>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center px-4 pb-24 text-center">
        <ProfileAvatar profile={profile} size={96} />
        <p className="mt-3 text-lg">{profile.name}</p>
        <h1 className="mt-8 text-xl mini:text-2xl">
          {action === "unlock"
            ? "Introduce tu PIN para acceder a este perfil."
            : "Introduce el PIN para eliminar este perfil."}
        </h1>
        {action === "delete" && (
          <p className="mt-2 max-w-[420px] text-sm text-yt-text-secondary">
            Se borran su biblioteca, sus descargas y su sesión de YouTube. Los videos que otros
            perfiles también tienen se conservan.
          </p>
        )}
        <div className="mt-8">
          <PinPad
            onComplete={(pin) => submit.mutate(pin)}
            failures={failures}
            disabled={submit.isPending || locked}
            error={locked ? `Demasiados intentos. Prueba de nuevo en ${seconds} s.` : error}
          />
        </div>
      </div>
    </div>
  );
}
