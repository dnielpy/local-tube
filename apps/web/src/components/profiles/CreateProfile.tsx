"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

import { api, ApiError, type Profile } from "@/lib/api";
import { openProfile } from "@/lib/profile-session";

import { BackIcon, Logo } from "../icons";
import { CookiesField } from "./CookiesField";
import { PinPad } from "./PinPad";
import { ProfileAvatar } from "./ProfileAvatar";

type Step =
  | { name: "name" }
  | { name: "pin" }
  | { name: "confirm"; pin: string }
  | { name: "cookies"; pin: string };

export function cookiesError(error: unknown): string {
  if (error instanceof ApiError && error.status === 422) {
    const detail = error.detail as { message?: string } | unknown[];
    if (!Array.isArray(detail) && detail?.message) return detail.message;
    return "Revisa las cookies: el archivo es demasiado grande o está vacío.";
  }
  return error instanceof Error ? error.message : "No se pudo guardar el perfil.";
}

/** Name, PIN, and the YouTube cookies the profile downloads with. */
export function CreateProfile({ onCancel }: { onCancel: () => void }) {
  const [step, setStep] = useState<Step>({ name: "name" });
  const [name, setName] = useState("");
  const [cookies, setCookies] = useState("");
  const [failures, setFailures] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: (pin: string) => api.createProfile({ name: name.trim(), pin, cookies }),
    onError: (failure) => setError(cookiesError(failure)),
  });
  const created = create.data;

  if (created) return <Welcome profile={created} />;

  function submitName(event: FormEvent) {
    event.preventDefault();
    if (name.trim()) setStep({ name: "pin" });
  }

  function submitCookies(event: FormEvent) {
    event.preventDefault();
    if (step.name === "cookies" && cookies.trim()) create.mutate(step.pin);
  }

  const back = () => {
    setError(null);
    if (step.name === "name") onCancel();
    else if (step.name === "pin") setStep({ name: "name" });
    else setStep({ name: "pin" });
  };

  return (
    <div className="flex min-h-dvh flex-col bg-yt-bg">
      <div className="flex h-14 items-center gap-4 px-4">
        <button
          type="button"
          onClick={back}
          aria-label="Volver"
          className="flex size-10 items-center justify-center rounded-full hover:bg-yt-surface"
        >
          <BackIcon />
        </button>
        <Logo />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center px-4 pb-24 text-center">
        {step.name === "name" && (
          <form onSubmit={submitName} className="flex w-full max-w-[400px] flex-col items-center">
            <h1 className="text-3xl mini:text-4xl">Agregar perfil</h1>
            <p className="mt-3 text-yt-text-secondary">
              Cada perfil tiene su biblioteca, sus descargas y sus suscripciones de YouTube.
            </p>
            <div className="mt-8 flex w-full items-center gap-4">
              <ProfileAvatar profile={{ name: name.trim() || "?", avatar_url: null }} size={64} />
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={40}
                autoFocus
                placeholder="Nombre"
                aria-label="Nombre del perfil"
                className="h-12 min-w-0 flex-1 rounded-md border border-yt-border bg-yt-search-bg px-4 text-base outline-none focus:border-yt-text"
              />
            </div>
            <button
              type="submit"
              disabled={!name.trim()}
              className="mt-8 h-10 rounded-full bg-yt-cta-bg px-8 text-sm font-medium text-yt-cta-text hover:bg-yt-cta-hover disabled:opacity-40"
            >
              Continuar
            </button>
          </form>
        )}

        {(step.name === "pin" || step.name === "confirm") && (
          <div key={step.name}>
            <h1 className="text-2xl mini:text-3xl">
              {step.name === "pin" ? "Elige un PIN de 4 dígitos" : "Repite el PIN"}
            </h1>
            <p className="mt-2 text-yt-text-secondary">
              {step.name === "pin"
                ? `Se pedirá cada vez que alguien abra el perfil de ${name.trim()}.`
                : "Para asegurarnos de que lo recuerdas."}
            </p>
            <div className="mt-8">
              <PinPad
                failures={failures}
                error={error}
                onComplete={(pin) => {
                  setError(null);
                  if (step.name === "pin") {
                    setStep({ name: "confirm", pin });
                  } else if (pin !== step.pin) {
                    setError("Los PIN no coinciden. Elige uno de nuevo.");
                    setFailures((value) => value + 1);
                    setStep({ name: "pin" });
                  } else {
                    setStep({ name: "cookies", pin });
                  }
                }}
              />
            </div>
          </div>
        )}

        {step.name === "cookies" && (
          <form
            onSubmit={submitCookies}
            className="flex w-full max-w-[560px] flex-col items-center"
          >
            <h1 className="text-2xl mini:text-3xl">Conecta tu cuenta de YouTube</h1>
            <p className="mt-2 mb-6 text-yt-text-secondary">
              Pega tus cookies de YouTube. Con ellas el perfil descarga videos y ve tus
              suscripciones, y tu foto de YouTube pasa a ser la del perfil.
            </p>
            <CookiesField
              value={cookies}
              onChange={(value) => {
                setCookies(value);
                setError(null);
              }}
              error={error}
            />
            <button
              type="submit"
              disabled={!cookies.trim() || create.isPending}
              className="mt-6 h-10 rounded-full bg-yt-cta-bg px-8 text-sm font-medium text-yt-cta-text hover:bg-yt-cta-hover disabled:opacity-40"
            >
              {create.isPending ? "Creando perfil…" : "Crear perfil"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function Welcome({ profile }: { profile: Profile }) {
  const client = useQueryClient();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-yt-bg px-4 text-center">
      <ProfileAvatar profile={profile} size={120} />
      <h1 className="mt-6 text-2xl mini:text-3xl">¡Listo, {profile.name}!</h1>
      <p className="mt-2 text-yt-text-secondary">
        {profile.youtube_name
          ? `Conectado a YouTube como ${profile.youtube_name}.`
          : "Tus cookies de YouTube están guardadas."}
      </p>
      <button
        type="button"
        onClick={() => openProfile(client, profile)}
        className="mt-8 h-10 rounded-full bg-yt-cta-bg px-8 text-sm font-medium text-yt-cta-text hover:bg-yt-cta-hover"
      >
        Empezar
      </button>
    </div>
  );
}
