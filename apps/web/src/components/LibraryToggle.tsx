"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useFeed } from "@/lib/use-feed";
import { useOnline } from "@/lib/use-status";

import { WifiIcon, WifiOffIcon } from "./icons";
import { IconButton } from "./IconButton";

/**
 * Switches the home page between the feed and the downloaded videos, without touching offline
 * mode, so the downloads keep going.
 */
export function LibraryToggle() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const online = useOnline();
  const feed = useFeed();
  const hasFeed = online && (feed.data?.channel_count ?? 0) > 0;
  const library = pathname === "/" && params.get("view") === "library";

  return (
    <IconButton
      label={library ? "Ver el feed" : "Ver solo los videos descargados"}
      aria-pressed={library}
      disabled={!library && !hasFeed}
      onClick={() => router.push(library ? "/" : "/?view=library")}
    >
      {library ? <WifiOffIcon /> : <WifiIcon />}
    </IconButton>
  );
}
