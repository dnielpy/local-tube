"use client";

import { useEffect, useRef, useState } from "react";

import type { Video } from "@/lib/api";
import { useDeleteVideo } from "@/lib/use-delete-video";
import { useWatchLater } from "@/lib/use-playlists";

import { ConfirmDialog } from "./Dialog";
import { ExternalIcon, MoreIcon, SaveIcon, TrashIcon, WatchLaterIcon } from "./icons";
import { SaveDialog } from "./library/SaveDialog";

export function VideoMenu({ video, className = "" }: { video: Video; className?: string }) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const remove = useDeleteVideo(() => setConfirming(false));

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        aria-label="Menú de acciones"
        aria-expanded={open}
        onClick={(event) => {
          event.preventDefault();
          setOpen((value) => !value);
        }}
        className="flex size-10 items-center justify-center rounded-full hover:bg-yt-surface active:bg-yt-surface-hover"
      >
        <MoreIcon />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute top-10 right-0 z-30 min-w-[220px] rounded-xl bg-yt-menu py-2 shadow-[0_4px_32px_rgba(0,0,0,0.25)]"
        >
          <WatchLaterItem videoId={video.id} onDone={() => setOpen(false)} />
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false);
              setSaving(true);
            }}
            className="flex h-9 w-full items-center gap-4 pr-6 pl-4 text-left text-sm hover:bg-yt-surface"
          >
            <SaveIcon />
            Guardar en una lista
          </button>
          <div className="my-2 border-t border-yt-divider" />
          <a
            role="menuitem"
            href={video.youtube_url}
            target="_blank"
            rel="noreferrer"
            onClick={() => setOpen(false)}
            className="flex h-9 items-center gap-4 pr-6 pl-4 text-sm hover:bg-yt-surface"
          >
            <ExternalIcon />
            Ver en YouTube
          </a>
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false);
              setConfirming(true);
            }}
            className="flex h-9 w-full items-center gap-4 pr-6 pl-4 text-left text-sm hover:bg-yt-surface"
          >
            <TrashIcon />
            Eliminar
          </button>
        </div>
      )}
      {saving && <SaveDialog video={video} onClose={() => setSaving(false)} />}
      <ConfirmDialog
        open={confirming}
        title="¿Eliminar video?"
        confirmLabel="Eliminar"
        busy={remove.isPending}
        onCancel={() => setConfirming(false)}
        onConfirm={() => remove.mutate(video.id)}
      >
        «{video.title}» se borrará del disco y de la biblioteca. Esta acción no se puede deshacer.
      </ConfirmDialog>
    </div>
  );
}

function WatchLaterItem({ videoId, onDone }: { videoId: string; onDone: () => void }) {
  const watchLater = useWatchLater(videoId);
  return (
    <button
      role="menuitem"
      type="button"
      disabled={!watchLater.ready}
      onClick={() => {
        watchLater.toggle();
        onDone();
      }}
      className="flex h-9 w-full items-center gap-4 pr-6 pl-4 text-left text-sm hover:bg-yt-surface disabled:opacity-50"
    >
      <WatchLaterIcon />
      {watchLater.saved ? "Quitar de Ver más tarde" : "Guardar en Ver más tarde"}
    </button>
  );
}
