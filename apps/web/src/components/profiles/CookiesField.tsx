"use client";

import { useRef, type ChangeEvent } from "react";

/** Paste or upload the cookies.txt of a browser signed in to YouTube. */
export function CookiesField({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
}) {
  const file = useRef<HTMLInputElement>(null);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0];
    if (chosen) onChange(await chosen.text());
    event.target.value = "";
  }

  return (
    <div className="w-full text-left">
      <ol className="list-decimal space-y-1 pl-5 text-sm text-yt-text-secondary">
        <li>Abre una ventana privada e inicia sesión en youtube.com con tu cuenta.</li>
        <li>
          Exporta las cookies de youtube.com en formato Netscape, por ejemplo con la extensión
          &quot;Get cookies.txt LOCALLY&quot;.
        </li>
        <li>Cierra la ventana privada sin cerrar sesión, para que YouTube no las cambie.</li>
      </ol>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        autoComplete="off"
        rows={7}
        placeholder={"# Netscape HTTP Cookie File\n.youtube.com\tTRUE\t/\tTRUE\t…"}
        aria-label="Cookies de YouTube"
        className={`mt-4 w-full resize-y rounded-md border bg-yt-search-bg p-3 font-mono text-xs text-yt-text outline-none focus:border-yt-text ${
          error ? "border-yt-error" : "border-yt-border"
        }`}
      />
      <div className="mt-2 flex items-center justify-between gap-4">
        <p role="alert" className="min-h-5 text-sm text-yt-error">
          {error}
        </p>
        <button
          type="button"
          onClick={() => file.current?.click()}
          className="h-9 shrink-0 rounded-full bg-yt-surface px-4 text-sm font-medium hover:bg-yt-surface-hover"
        >
          Elegir archivo
        </button>
        <input
          ref={file}
          type="file"
          accept=".txt,text/plain"
          onChange={upload}
          className="hidden"
        />
      </div>
    </div>
  );
}
