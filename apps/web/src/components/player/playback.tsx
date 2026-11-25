"use client";

import { createContext, use, useEffect, useState, type ReactNode } from "react";

import type { Video } from "@/lib/api";

export type PlaybackState = {
  /** The video loaded in the shared element, or null when nothing is playing. */
  video: Video | null;
  /** The watch page of that video, to expand the mini player back into it. */
  href: string;
  /** Whether a watch page shows the element. When none does, the mini player shows it. */
  owned: boolean;
};

const EMPTY: PlaybackState = { video: null, href: "/", owned: false };

/**
 * The one <video> element of the app. The watch page's player and the mini player move this same
 * element between them, so leaving the watch page does not stop or reload the video, as on YouTube.
 */
export class Playback {
  readonly element: HTMLVideoElement;
  private state = EMPTY;
  private owners = 0;
  private listeners = new Set<() => void>();
  /** The last page outside the watch page, where the mini player button goes back to. */
  lastPage = "/";
  /** Whether the video was playing when the watch page let it go, to keep it playing. */
  wasPlaying = false;

  constructor() {
    const element = document.createElement("video");
    element.preload = "metadata";
    element.playsInline = true;
    element.className = "absolute inset-0 size-full object-contain";
    this.element = element;
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.state;

  private set(next: Partial<PlaybackState>) {
    this.state = { ...this.state, ...next };
    this.listeners.forEach((listener) => listener());
  }

  /**
   * A watch page takes the element for a video. Returns true when the video had to be loaded, and
   * false when it was already playing in the mini player and carries on where it was.
   */
  take(video: Video): boolean {
    this.owners += 1;
    const url = new URL(window.location.href);
    url.searchParams.delete("t");
    const href = url.pathname + url.search;
    const fresh = this.state.video?.id !== video.id || !this.element.getAttribute("src");
    if (fresh) {
      this.element.poster = video.thumbnail_url ?? "";
      this.element.src = video.stream_url;
    }
    this.set({ video, href, owned: true });
    return fresh;
  }

  /** The watch page lets the element go: the mini player takes it, unless the video ended. */
  release() {
    this.owners = Math.max(this.owners - 1, 0);
    if (this.owners > 0) return;
    this.wasPlaying = !this.element.paused && !this.element.ended;
    if (this.element.ended || this.element.error) this.close();
    else this.set({ owned: false });
  }

  setLastPage(page: string) {
    this.lastPage = page;
  }

  resetRate() {
    this.element.playbackRate = 1;
  }

  /** Stops the video and hides the mini player. */
  close() {
    this.element.pause();
    this.element.remove();
    this.element.removeAttribute("src");
    this.element.removeAttribute("poster");
    this.element.load();
    this.wasPlaying = false;
    this.set({ video: null, owned: this.owners > 0 });
  }
}

const PlaybackContext = createContext<Playback | null>(null);

/** Holds the shared video element while a profile is signed in. */
export function PlaybackProvider({ children }: { children: ReactNode }) {
  const [playback] = useState(() => (typeof document === "undefined" ? null : new Playback()));
  // Switching profile unmounts the app: the video stops with it.
  useEffect(() => () => playback?.close(), [playback]);
  return <PlaybackContext value={playback}>{children}</PlaybackContext>;
}

export function usePlayback(): Playback {
  const playback = use(PlaybackContext);
  if (!playback) throw new Error("usePlayback needs a PlaybackProvider in the browser");
  return playback;
}

export function useOptionalPlayback(): Playback | null {
  return use(PlaybackContext);
}
