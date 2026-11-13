"use client";

import { useEffect, useState } from "react";

export type Chapter = { start: number; title: string };

/** A timestamp like 4:05 or 1:02:03 that is not part of a longer number. */
export const TIMESTAMP = /(?<![\w:])(?:\d{1,2}:)?\d{1,2}:[0-5]\d(?![\w:])/;
const SEPARATORS = /^[\s\-–—:|•·.,)\]]+|[\s\-–—:|•·(\[]+$/g;
const MIN_LENGTH = 10;
const MIN_CHAPTERS = 3;

export function parseTimestamp(text: string): number {
  return text.split(":").reduce((total, part) => total * 60 + Number(part), 0);
}

/**
 * The chapters YouTube would show for a description: lines with a timestamp,
 * starting at 0:00, at least three of them, in ascending order and at least
 * ten seconds long each. Anything else gives no chapters, as on YouTube.
 */
export function parseChapters(description: string, duration?: number | null): Chapter[] {
  const chapters: Chapter[] = [];
  for (const line of description.split("\n")) {
    const match = line.match(TIMESTAMP);
    if (!match) continue;
    const start = parseTimestamp(match[0]);
    if (chapters.length === 0 && start !== 0) continue;
    const previous = chapters.at(-1);
    if (previous && start <= previous.start) break;
    if (duration && start >= duration) break;
    const index = match.index ?? 0;
    // "(1:30) Title" and "[1:30] Title" lose their brackets too.
    const before = line.slice(0, index).replace(/[([]\s*$/, "");
    const after = line.slice(index + match[0].length).replace(/^\s*[)\]]/, "");
    const title = `${before} ${after}`.replace(SEPARATORS, "").trim();
    chapters.push({ start, title });
  }
  if (chapters.length < MIN_CHAPTERS) return [];
  const ends = [...chapters.slice(1).map((chapter) => chapter.start), duration ?? Infinity];
  if (chapters.some((chapter, index) => ends[index] - chapter.start < MIN_LENGTH)) return [];
  return chapters;
}

/** The index of the chapter playing at `time`, or -1 without chapters. */
export function chapterAt(chapters: Chapter[], time: number): number {
  for (let index = chapters.length - 1; index >= 0; index--) {
    if (time >= chapters[index].start) return index;
  }
  return chapters.length > 0 ? 0 : -1;
}

const frameCache = new Map<string, string>();

/**
 * A frame from the start of each chapter, read from the video itself since
 * there are no storyboards, for the chapter thumbnails YouTube shows.
 */
export function useChapterFrames(src: string, chapters: Chapter[], enabled: boolean) {
  const [, setLoaded] = useState(0);

  useEffect(() => {
    if (!enabled || chapters.length === 0) return;
    const missing = chapters.filter((chapter) => !frameCache.has(`${src}#${chapter.start}`));
    if (missing.length === 0) return;

    let cancelled = false;
    const video = document.createElement("video");
    video.muted = true;
    video.preload = "auto";
    video.src = src;
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 180;
    const context = canvas.getContext("2d");

    const seek = (time: number) =>
      new Promise<void>((resolve, reject) => {
        video.addEventListener("seeked", () => resolve(), { once: true });
        video.addEventListener("error", () => reject(video.error), { once: true });
        video.currentTime = time;
      });

    video.addEventListener(
      "loadedmetadata",
      async () => {
        for (const chapter of missing) {
          if (cancelled || !context) return;
          try {
            // A second in, past the black frame many chapters start with.
            await seek(Math.min(chapter.start + 1, Math.max(video.duration - 0.1, 0)));
          } catch {
            return;
          }
          if (cancelled) return;
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          frameCache.set(`${src}#${chapter.start}`, canvas.toDataURL("image/jpeg", 0.7));
          setLoaded((count) => count + 1);
        }
      },
      { once: true },
    );

    return () => {
      cancelled = true;
      video.removeAttribute("src");
      video.load();
    };
  }, [src, chapters, enabled]);

  return cachedFrames(src, chapters);
}

function cachedFrames(src: string, chapters: Chapter[]) {
  const frames: Record<number, string> = {};
  for (const chapter of chapters) {
    const frame = frameCache.get(`${src}#${chapter.start}`);
    if (frame) frames[chapter.start] = frame;
  }
  return cachedFrames(src, chapters);
}
