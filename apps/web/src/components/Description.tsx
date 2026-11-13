"use client";

import { useState } from "react";

import type { Video } from "@/lib/api";
import { parseTimestamp, TIMESTAMP, type Chapter } from "@/lib/chapters";
import { formatBytes, formatDate, timeAgo } from "@/lib/format";

import { ChapterList } from "./ChaptersPanel";

const LINK_PATTERN = new RegExp(`(https?:\\/\\/[^\\s]+|${TIMESTAMP.source})`, "g");

/** The description with its links and, as on YouTube, timestamps that jump the player there. */
function Linkified({
  text,
  videoId,
  duration,
  onSeek,
}: {
  text: string;
  videoId: string;
  duration: number | null;
  onSeek: (time: number) => void;
}) {
  return (
    <>
      {text.split(LINK_PATTERN).map((part, index) => {
        if (index % 2 === 0) return part;
        if (/^https?:/.test(part)) {
          return (
            <a key={index} href={part} target="_blank" rel="noreferrer" className="text-yt-link">
              {part}
            </a>
          );
        }
        const time = parseTimestamp(part);
        if (duration != null && time > duration) return part;
        return (
          <a
            key={index}
            href={`/watch?v=${videoId}&t=${time}s`}
            onClick={(event) => {
              event.preventDefault();
              onSeek(time);
            }}
            className="text-yt-link"
          >
            {part}
          </a>
        );
      })}
    </>
  );
}

export function Description({
  video,
  chapters,
  frames,
  onExpand,
  onSeek,
  onShowChapters,
}: {
  video: Video;
  chapters: Chapter[];
  frames: Record<number, string>;
  onExpand: () => void;
  onSeek: (time: number) => void;
  onShowChapters: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  function expand() {
    setExpanded(true);
    onExpand();
  }
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
        onClick={expand}
        onKeyDown={(event) => event.key === "Enter" && expand()}
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
        <Linkified
          text={video.description || "Sin descripción."}
          videoId={video.id}
          duration={video.duration_seconds}
          onSeek={onSeek}
        />
      </p>
      {chapters.length > 0 && (
        <section className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold">Capítulos</h2>
            <button
              type="button"
              onClick={onShowChapters}
              className="h-9 rounded-full border border-yt-border px-4 text-sm font-medium text-yt-link hover:bg-yt-surface"
            >
              Ver todos
            </button>
          </div>
          <ChapterList
            chapters={chapters}
            frames={frames}
            thumbnail={video.thumbnail_url}
            onSeek={onSeek}
            layout="row"
          />
        </section>
      )}
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
