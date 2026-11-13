"use client";

import { useRef, useState, type PointerEvent } from "react";

import { chapterAt, type Chapter } from "@/lib/chapters";
import { formatDuration } from "@/lib/format";

/** The gap YouTube leaves between chapters on the bar. */
const GAP_PX = 2;

export function ProgressBar({
  current,
  duration,
  buffered,
  chapters,
  onSeek,
}: {
  current: number;
  duration: number;
  buffered: number;
  chapters: Chapter[];
  onSeek: (time: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [width, setWidth] = useState(0);

  function fractionAt(clientX: number) {
    const rect = ref.current!.getBoundingClientRect();
    setWidth(rect.width);
    return Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(fractionAt(event.clientX));
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const fraction = fractionAt(event.clientX);
    setHover(fraction);
    if (dragging !== null) setDragging(fraction);
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (dragging === null) return;
    onSeek(fractionAt(event.clientX) * duration);
    setDragging(null);
  }

  const played = dragging ?? (duration ? current / duration : 0);
  const bufferedFraction = duration ? buffered / duration : 0;
  const bubble = dragging ?? hover;
  const bubbleChapter =
    bubble !== null && chapters.length > 0
      ? chapters[chapterAt(chapters, bubble * duration)]
      : null;
  // Keeps the bubble, and the chapter title above it, inside the player.
  const margin = bubbleChapter?.title ? 120 : 24;
  const bubbleLeft = Math.min(
    Math.max((bubble ?? 0) * width, margin),
    Math.max(width - margin, margin),
  );

  // Without chapters the bar is a single segment, so it grows the same way.
  const segments = (chapters.length > 0 && duration ? chapters : [{ start: 0, title: "" }]).map(
    (chapter, index, all) => {
      const start = duration ? chapter.start / duration : 0;
      const end = index + 1 < all.length && duration ? all[index + 1].start / duration : 1;
      return { start, end, last: index + 1 === all.length };
    },
  );
  const fill = (value: number, start: number, end: number) =>
    `${Math.min(Math.max((value - start) / (end - start), 0), 1) * 100}%`;

  return (
    <div
      ref={ref}
      role="slider"
      aria-label="Barra de búsqueda"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(current)}
      aria-valuetext={`${formatDuration(current)} de ${formatDuration(duration)}`}
      tabIndex={-1}
      className="group/progress relative h-[5px] cursor-pointer touch-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={() => setHover(null)}
    >
      <div className="absolute inset-x-0 -top-2 -bottom-1" />
      {segments.map(({ start, end, last }) => {
        const active = bubble !== null && bubble >= start && (bubble < end || last);
        return (
          <div
            key={start}
            className={`absolute bottom-0 bg-white/20 transition-[height] duration-100 ${
              active ? "h-[5px]" : "h-[3px]"
            }`}
            style={{
              left: `${start * 100}%`,
              width: last
                ? `${(end - start) * 100}%`
                : `calc(${(end - start) * 100}% - ${GAP_PX}px)`,
            }}
          >
            <div
              className="absolute inset-y-0 left-0 bg-white/40"
              style={{ width: fill(bufferedFraction, start, end) }}
            />
            {hover !== null && (
              <div
                className="absolute inset-y-0 left-0 bg-white/50"
                style={{ width: fill(hover, start, end) }}
              />
            )}
            <div
              className="absolute inset-y-0 left-0 bg-[#f00]"
              style={{ width: fill(played, start, end) }}
            />
          </div>
        );
      })}
      <div
        className={`absolute bottom-[-4px] size-[13px] -translate-x-1/2 rounded-full bg-[#f00] transition-transform duration-100 ${
          dragging !== null ? "scale-100" : "scale-0 group-hover/progress:scale-100"
        }`}
        style={{ left: `${played * 100}%` }}
      />
      {bubble !== null && (
        <div
          className="pointer-events-none absolute bottom-5 flex -translate-x-1/2 flex-col items-center gap-1"
          style={{ left: bubbleLeft }}
        >
          {bubbleChapter?.title && (
            <span className="max-w-[240px] truncate text-[13px] font-medium text-white [text-shadow:0_0_4px_rgba(0,0,0,.75)]">
              {bubbleChapter.title}
            </span>
          )}
          <span className="rounded bg-[rgba(28,28,28,0.9)] px-2 py-[3px] text-xs font-medium text-white">
            {formatDuration(bubble * duration)}
          </span>
        </div>
      )}
    </div>
  );
}
