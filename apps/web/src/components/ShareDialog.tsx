"use client";

import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { api, type Video } from "@/lib/api";

import { CloseIcon } from "./icons";

/** Copies text where `navigator.clipboard` is missing: LocalTube runs on plain http in the LAN. */
function copyText(input: HTMLInputElement): Promise<void> {
  if (navigator.clipboard) return navigator.clipboard.writeText(input.value);
  input.select();
  return document.execCommand("copy") ? Promise.resolve() : Promise.reject();
}

/** "Compartir": a link that offers the video to the other profiles. */
export function ShareDialog({ video, onClose }: { video: Video; onClose: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const share = useMutation({ mutationFn: () => api.shareVideo(video.id) });
  const { mutate } = share;
  const link = share.data ? `${window.location.origin}${share.data.url}` : "";

  useEffect(() => mutate(), [mutate]);

  useEffect(() => {
    if (link) input.current?.select();
  }, [link]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function copy() {
    if (!input.current) return;
    copyText(input.current).then(
      () => setCopied(true),
      () => input.current?.select(),
    );
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Compartir"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-[480px] rounded-xl bg-yt-menu pb-6 shadow-[0_4px_32px_rgba(0,0,0,0.25)]"
      >
        <div className="flex items-center justify-between py-2 pr-2 pl-6">
          <h2 className="text-base">Compartir</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex size-10 items-center justify-center rounded-full hover:bg-yt-surface"
          >
            <CloseIcon />
          </button>
        </div>
        <p className="px-6 text-sm text-yt-text-secondary">
          Cualquier perfil de LocalTube que abra este link podrá guardar el video en su biblioteca.
        </p>
        {share.isError ? (
          <p className="mt-4 px-6 text-sm text-yt-error">No se pudo crear el link.</p>
        ) : (
          <div className="mx-6 mt-4 flex items-center gap-2 rounded-xl border border-yt-border bg-yt-bg p-2 pl-3">
            <input
              ref={input}
              readOnly
              value={link}
              placeholder="Creando link..."
              aria-label="Link para compartir"
              onFocus={(event) => event.target.select()}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
            <button
              type="button"
              disabled={!link}
              onClick={copy}
              className="h-9 shrink-0 rounded-full bg-yt-cta-bg px-4 text-sm font-medium text-yt-cta-text hover:bg-yt-cta-hover disabled:opacity-50"
            >
              {copied ? "Link copiado" : "Copiar"}
            </button>
          </div>
        )}
        {link && typeof navigator.share === "function" && (
          <div className="mt-3 px-6">
            <button
              type="button"
              onClick={() => navigator.share({ title: video.title, url: link }).catch(() => {})}
              className="h-9 rounded-full px-4 text-sm font-medium text-yt-link hover:bg-yt-surface"
            >
              Compartir con otra app
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
