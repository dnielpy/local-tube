"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

import { api, queryKeys, type Profile } from "@/lib/api";

import { BackIcon, Logo } from "../icons";
import { PinPad } from "./PinPad";
import { ProfileAvatar } from "./ProfileAvatar";
import { YoutubeLogin } from "./YoutubeLogin";

type Step = { name: "name" } | { name: "pin" } | { name: "confirm"; pin: string };

/** Name, PIN, and then the YouTube sign-in, which every profile needs. */
export function CreateProfile({
  onCancel,
  pending,
}: {
  onCancel: () => void;
  /** A profile created earlier whose YouTube sign-in did not finish. */
  pending?: Profile;
}) {
  const client = useQueryClient();
  const [step, setStep] = useState<Step>({ name: "name" });
  const [name, setName] = useState("");
  const [failures, setFailures] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: (pin: string) => api.createProfile({ name: name.trim(), pin }),
    onSuccess: (profile) => client.setQueryData(queryKeys.session, profile),
    onError: (failure) => setError(failure.message),
  });
  const profile = pending ?? create.data;

  async function cancel() {
    if (profile) {
      await api.deleteProfile(profile.id).catch(() => undefined);
      client.setQueryData(queryKeys.session, undefined);
      client.invalidateQueries({ queryKey: queryKeys.session });
    }
    onCancel();
  }

  if (profile) {
    return (
      <YoutubeLogin
        profile={profile}
        onCancel={cancel}
        onDone={(ready) => {
          client.clear();
          client.setQueryData(queryKeys.session, ready);
        }}
      />
    );
  }

  function submitName(event: FormEvent) {
    event.preventDefault();
    if (name.trim()) setStep({ name: "pin" });
  }

  const back = () => {
    setError(null);
    if (step.name === "name") onCancel();
    else setStep(step.name === "confirm" ? { name: "pin" } : { name: "name" });
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
        {step.name === "name" ? (
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
        ) : (
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
                disabled={create.isPending}
                onComplete={(pin) => {
                  setError(null);
                  if (step.name === "pin") {
                    setStep({ name: "confirm", pin });
                  } else if (pin !== step.pin) {
                    setError("Los PIN no coinciden. Elige uno de nuevo.");
                    setFailures((value) => value + 1);
                    setStep({ name: "pin" });
                  } else {
                    create.mutate(pin);
                  }
                }}
              />
            </div>
            {create.isPending && (
              <p className="text-sm text-yt-text-secondary">Abriendo el navegador…</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
