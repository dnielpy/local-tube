"use client";

import { useRouter } from "next/navigation";

import { useFeed, useRefreshFeed } from "@/lib/use-feed";
import { useOnline } from "@/lib/use-status";

import { RetryIcon } from "./icons";
import { IconButton } from "./IconButton";

export function FeedButton() {
  const router = useRouter();
  const online = useOnline();
  const feed = useFeed();
  const refresh = useRefreshFeed();
  const refreshing = feed.data?.refreshing || refresh.isPending;
  const empty = feed.data?.channel_count === 0;

  const label = !online
    ? "Actualizar el feed (sin conexión)"
    : empty
      ? "Elegir los canales del feed"
      : refreshing
        ? "Actualizando el feed…"
        : "Actualizar el feed";

  return (
    <IconButton
      label={label}
      disabled={!online || !feed.data || refreshing}
      onClick={() => (empty ? router.push("/settings?open=feed") : refresh.mutate())}
    >
      <RetryIcon className={refreshing ? "animate-spin" : ""} />
    </IconButton>
  );
}
