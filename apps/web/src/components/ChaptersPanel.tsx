"use client";

import { useEffect, useRef } from "react";

import type { Chapter } from "@/lib/chapters";
import { formatDuration } from "@/lib/format";

import { CloseIcon } from "./icons";

/** The chapters, each with a frame from its start, in a row (description) or a column (panel). */
export function ChapterList({
  chapters,
  frames,
  thumbnail,
  current,
  layout,
  onSeek,
}: {
  chapters: Chapter[];
  frames: Record<number, string>;
  thumbnail: string | null;
  current?: number;
  layout: "row" | "column";
  onSeek: (time: number) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  // The panel follows the chapter playing, as YouTube's does.
  useEffect(() => {
    if (layout !== "column" || current == null || current < 0) return;
    const list = listRef.current;
    const scroller = list?.parentElement;
    const item = list?.children[current] as HTMLElement | undefined;
    if (!scroller || !item) return;
    // Scrolls only the panel; scrollIntoView would move the page too.
    const top =
      item.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
    if (
      top < scroller.scrollTop ||
      top + item.offsetHeight > scroller.scrollTop + scroller.clientHeight
    ) {
      scroller.scrollTop = top;
    }
  }, [current, layout]);

  return (
    <div
      ref={listRef}
      className={
        layout === "row"
          ? "mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]"
          : "flex flex-col py-2"
      }
    >
      {chapters.map((chapter, index) => {
        const active = index === current;
        const frame = frames[chapter.start] ?? thumbnail;
        return (
          <button
            key={chapter.start}
            type="button"
            onClick={() => onSeek(chapter.start)}
            className={`flex shrink-0 items-start gap-3 rounded-lg text-left ${
              layout === "row" ? "w-[260px] p-2 hover:bg-yt-surface-hover" : "w-full px-4 py-2"
            } ${layout === "column" ? (active ? "bg-yt-surface" : "hover:bg-yt-surface") : ""}`}
          >
            <span className="relative block aspect-video w-[88px] shrink-0 overflow-hidden rounded-md bg-yt-skeleton">
              {frame && <img src={frame} alt="" className="size-full object-cover" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 text-sm leading-5 font-medium break-words">
                {chapter.title || `Capítulo ${index + 1}`}
              </span>
              <span className="mt-1 inline-block rounded bg-[rgba(62,166,255,0.15)] px-1 py-px text-xs font-medium text-yt-link">
                {formatDuration(chapter.start)}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** The panel the chapter chip opens next to the player, like YouTube's "Capítulos". */
export function ChaptersPanel({
  chapters,
  frames,
  thumbnail,
  current,
  onSeek,
  onClose,
}: {
  chapters: Chapter[];
  frames: Record<number, string>;
  thumbnail: string | null;
  current: number;
  onSeek: (time: number) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLElement>(null);

  // Below 1017px the panel sits under the description, out of sight.
  useEffect(() => {
    if (!window.matchMedia("(min-width: 1017px)").matches) {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  return (
    <section
      ref={ref}
      className="mb-4 flex max-h-[min(560px,calc(100vh-120px))] flex-col overflow-hidden rounded-xl border border-yt-border"
    >
      <header className="flex items-center justify-between border-b border-yt-border py-1 pr-2 pl-4">
        <h2 className="text-xl font-bold">Capítulos</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="flex size-10 items-center justify-center rounded-full hover:bg-yt-surface"
        >
          <CloseIcon />
        </button>
      </header>
      <div className="overflow-y-auto">
        <ChapterList
          chapters={chapters}
          frames={frames}
          thumbnail={thumbnail}
          current={current}
          layout="column"
          onSeek={onSeek}
        />
      </div>
    </section>
  );
}
