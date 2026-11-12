"use client";

import { useState } from "react";

import type { Video } from "@/lib/api";
import { formatBytes, formatDate, timeAgo } from "@/lib/format";

const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

function Linkified({ text }: { text: string }) {
  return (
    <>
      {text.split(URL_PATTERN).map((part, index) =>
        index % 2 === 1 ? (
          <a key={index} href={part} target="_blank" rel="noreferrer" className="text-yt-link">
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </>
  );
}

/** The grey description box under the player, collapsed to a few lines with "...más". */
export function Description({ video }: { video: Video }) {
  const [expanded, setExpanded] = useState(false);
  const size = formatBytes(video.file_size);
  const meta = (
    <p className="font-medium">
      <span title={formatDate(video.created_at)}>Descargado {timeAgo(video.created_at)}</span>
      {size && <span className="ml-2">{size}</span>}
    </p>
  );

  if (!expanded) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded(true)}
        onKeyDown={(event) => event.key === "Enter" && setExpanded(true)}
        className="mt-3 cursor-pointer rounded-xl bg-yt-surface p-3 text-sm leading-5 hover:bg-yt-surface-hover"
      >
        {meta}
        <div className="relative">
          <p className="line-clamp-3 whitespace-pre-wrap">
            {video.description || "Sin descripción."}
          </p>
          <span className="font-medium">...más</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl bg-yt-surface p-3 text-sm leading-5">
      {meta}
      <p className="whitespace-pre-wrap break-words">
        <Linkified text={video.description || "Sin descripción."} />
      </p>
      <p className="mt-4 text-yt-text-secondary">
        Original:{" "}
        <a href={video.youtube_url} target="_blank" rel="noreferrer" className="text-yt-link">
          {video.youtube_url}
        </a>
      </p>
      <button type="button" onClick={() => setExpanded(false)} className="mt-4 font-medium">
        Mostrar menos
      </button>
    </div>
  );
}
