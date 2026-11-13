"use client";

import { useEffect, useState, type ComponentType, type ReactNode } from "react";

import type { ChannelChoice } from "@/lib/api";

import { ChannelPhoto } from "../ChannelPhoto";
import { AlertIcon, BackIcon, ChevronRightIcon, CloseIcon, SearchIcon } from "../icons";

/**
 * The frame of a settings module: what it does on the side, and its options with Guardar and
 * Cancelar on the other. With `onBack`, a sub-view is open and Escape goes back to the options.
 */
export function SettingsDialog({
  title,
  icon: Icon,
  intro,
  heading,
  onBack,
  onClose,
  loading,
  failed,
  saveFailed,
  saving,
  onSave,
  children,
}: {
  title: string;
  icon: ComponentType<{ size?: number }>;
  intro: ReactNode;
  heading: string;
  onBack?: () => void;
  onClose: () => void;
  loading: boolean;
  failed: boolean;
  saveFailed: boolean;
  saving: boolean;
  onSave: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (onBack) onBack();
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onBack]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[calc(100vh-32px)] w-full max-w-[860px] flex-col overflow-hidden rounded-2xl border border-yt-border bg-yt-bg shadow-[0_8px_40px_rgba(0,0,0,0.6)] watch:h-[560px] watch:flex-row"
      >
        <aside className="relative flex shrink-0 items-center gap-4 overflow-hidden border-b border-yt-divider px-6 py-5 watch:w-[280px] watch:flex-col watch:items-start watch:justify-between watch:border-r watch:border-b-0 watch:py-8">
          <div className="pointer-events-none absolute -top-24 -left-24 size-64 rounded-full bg-yt-brand/20 blur-3xl" />
          <span className="relative flex size-12 shrink-0 items-center justify-center rounded-full bg-yt-brand text-white shadow-[0_0_24px_2px_color-mix(in_srgb,var(--yt-brand)_45%,transparent)] watch:size-16">
            <Icon size={28} />
          </span>
          <div className="relative min-w-0 flex-1 watch:flex-none">
            <h2 className="text-xl leading-7 font-bold watch:text-2xl">{title}</h2>
            <p className="mt-1 text-sm text-yt-text-secondary watch:mt-3">{intro}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="relative flex size-10 shrink-0 items-center justify-center self-start rounded-full hover:bg-yt-surface watch:hidden"
          >
            <CloseIcon />
          </button>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="flex h-16 shrink-0 items-center gap-2 border-b border-yt-divider pr-3 pl-4">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                aria-label="Volver"
                className="flex size-10 items-center justify-center rounded-full hover:bg-yt-surface"
              >
                <BackIcon />
              </button>
            )}
            <h3 className="flex-1 pl-2 text-base font-medium">{heading}</h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="hidden size-10 items-center justify-center rounded-full hover:bg-yt-surface watch:flex"
            >
              <CloseIcon />
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {failed ? (
              <p className="flex gap-3 px-6 py-6 text-sm text-yt-error">
                <AlertIcon className="shrink-0" />
                No se pudieron cargar los ajustes.
              </p>
            ) : loading ? (
              <div className="flex justify-center py-16">
                <div className="size-9 rounded-full border-[3px] border-yt-surface border-t-yt-brand [animation:yt-spin_0.9s_linear_infinite]" />
              </div>
            ) : (
              children
            )}
          </div>

          <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-yt-divider px-6 py-3">
            {saveFailed && (
              <span className="mr-auto text-sm text-yt-error">No se pudo guardar.</span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-full px-4 text-sm font-medium hover:bg-yt-surface"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={loading || failed || saving}
              onClick={onSave}
              className="h-9 rounded-full bg-yt-cta-bg px-4 text-sm font-medium text-yt-cta-text hover:bg-yt-cta-hover disabled:opacity-40"
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </footer>
        </section>
      </div>
    </div>
  );
}

export function Option({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 px-6 py-5 mini:flex-row mini:items-center mini:gap-6">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 text-xs leading-5 text-yt-text-secondary">{description}</p>
      </div>
      {children}
    </div>
  );
}

export function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <span className="relative inline-flex shrink-0 self-start mini:self-auto">
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 min-w-[168px] appearance-none rounded-full bg-yt-surface pr-9 pl-4 text-sm font-medium outline-none hover:bg-yt-surface-hover focus-visible:ring-2 focus-visible:ring-yt-brand"
      >
        {options.map(([optionValue, text]) => (
          <option key={optionValue} value={optionValue} className="bg-yt-menu">
            {text}
          </option>
        ))}
      </select>
      <svg
        viewBox="0 0 24 24"
        width={18}
        height={18}
        aria-hidden="true"
        className="pointer-events-none absolute top-[9px] right-3 fill-current"
      >
        <path d="m18 9.28-6.35 6.35-6.37-6.35.72-.71 5.64 5.65 5.65-5.65z" />
      </svg>
    </span>
  );
}

/** The row that opens the channel picker, with how many channels are chosen. */
export function ChannelsOption({
  description,
  count,
  onOpen,
}: {
  description: string;
  count: number;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-4 px-6 py-5 text-left hover:bg-white/5"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">Canales</span>
        <span className="mt-1 block text-xs text-yt-text-secondary">{description}</span>
      </span>
      <span
        className={`rounded-full px-3 py-1 text-xs font-medium ${
          count > 0 ? "bg-yt-brand/15 text-[#ff4e45]" : "bg-yt-surface text-yt-text-secondary"
        }`}
      >
        {count === 0 ? "Ninguno" : `${count} ${count === 1 ? "canal" : "canales"}`}
      </span>
      <ChevronRightIcon className="shrink-0 text-yt-text-secondary" />
    </button>
  );
}

export function ChannelPicker({
  all,
  selected,
  onChange,
}: {
  all: ChannelChoice[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const visible = needle
    ? all.filter((channel) => channel.name.toLowerCase().includes(needle))
    : all;
  const allVisibleSelected = visible.length > 0 && visible.every((c) => selected.has(c.id!));

  function toggle(id: string, on: boolean) {
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    onChange(next);
  }

  function toggleVisible() {
    const next = new Set(selected);
    for (const channel of visible) {
      if (allVisibleSelected) next.delete(channel.id!);
      else next.add(channel.id!);
    }
    onChange(next);
  }

  if (all.length === 0) {
    return (
      <p className="px-6 py-6 text-sm text-yt-text-secondary">
        Todavía no hay suscripciones. Se sincronizan desde YouTube con las cookies de tu perfil:
        ponlas desde el menú de tu foto, arriba a la derecha.
      </p>
    );
  }

  return (
    <>
      <div className="sticky top-0 z-10 flex items-center gap-3 bg-yt-bg px-6 pt-4 pb-2">
        <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-full border border-yt-border px-3 focus-within:border-yt-text-secondary">
          <SearchIcon size={20} className="shrink-0 text-yt-text-secondary" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar canal"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </label>
        <button
          type="button"
          onClick={toggleVisible}
          className="h-9 shrink-0 rounded-full px-3 text-sm font-medium hover:bg-yt-surface"
        >
          {allVisibleSelected ? "Quitar todos" : "Seleccionar todos"}
        </button>
      </div>
      {visible.length === 0 ? (
        <p className="px-6 py-6 text-sm text-yt-text-secondary">Ningún canal coincide.</p>
      ) : (
        <ul className="px-3 pb-3">
          {visible.map((channel) => (
            <li key={channel.id}>
              <label className="flex h-14 cursor-pointer items-center gap-4 rounded-xl px-3 hover:bg-white/5">
                <input
                  type="checkbox"
                  checked={selected.has(channel.id!)}
                  onChange={(event) => toggle(channel.id!, event.target.checked)}
                  className="size-[18px] shrink-0 accent-yt-brand"
                />
                <ChannelPhoto src={channel.avatar_url} name={channel.name} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{channel.name}</span>
                  {!channel.subscribed && (
                    <span className="block text-xs text-yt-text-secondary">
                      Ya no estás suscrito
                    </span>
                  )}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
