"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useFeed, useRefreshFeed } from "@/lib/use-feed";
import { useOnline } from "@/lib/use-status";

import { RetryIcon } from "./icons";
import { IconButton } from "./IconButton";

/**
 * Turns the feed on: refreshes it and shows it on the home page. While it is on, it stays lit, and
 * a second press turns it off and goes back to the downloaded videos.
 */
export function FeedButton() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const online = useOnline();
  const feed = useFeed();
  const refresh = useRefreshFeed();
  const refreshing = feed.data?.refreshing || refresh.isPending;
  const empty = feed.data?.channel_count === 0;
  const active = pathname === "/" && params.get("view") === "feed";

  const label = active
    ? "Ver los videos descargados"
    : !online
      ? "Actualizar el feed (sin conexión)"
      : empty
        ? "Elegir los canales del feed"
        : refreshing
          ? "Actualizando el feed…"
          : "Actualizar el feed";

  function toggle() {
    if (active) return router.push("/");
    if (empty) return router.push("/settings?open=feed");
    refresh.mutate();
    router.push("/?view=feed");
  }

  return (
    <IconButton
      label={label}
      aria-pressed={active}
      disabled={!active && (!online || !feed.data || refreshing)}
      onClick={toggle}
      className="aria-pressed:bg-yt-chip-active-bg aria-pressed:text-yt-chip-active-text aria-pressed:hover:bg-yt-chip-active-bg"
    >
      <RetryIcon className={refreshing ? "animate-spin" : ""} />
    </IconButton>
  );
}
