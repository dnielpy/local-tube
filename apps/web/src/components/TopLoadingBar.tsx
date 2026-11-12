"use client";

import { useIsFetching } from "@tanstack/react-query";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// Navigations that never commit (a link to a page that fails) must not leave the bar running.
const GIVE_UP_MS = 15_000;

type Phase = "idle" | "loading" | "done";

/**
 * YouTube's red line at the top of the page: it grows while a page opens and loads its data for
 * the first time, then fills up and fades out. Background refreshes do not show it.
 */
export function TopLoadingBar() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [navigating, setNavigating] = useState(false);
  const firstLoads = useIsFetching({
    predicate: (query) => query.state.status === "pending" && query.state.data === undefined,
  });
  const loading = navigating || firstLoads > 0;
  const [phase, setPhase] = useState<Phase>("idle");
  const route = `${pathname}?${search}`;
  const [lastRoute, setLastRoute] = useState(route);
  const giveUp = useRef<ReturnType<typeof setTimeout>>(undefined);

  if (route !== lastRoute) {
    setLastRoute(route);
    setNavigating(false);
  }

  // A click on a link to another page of LocalTube starts the bar before the route changes.
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest("a");
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname.startsWith("/api/")) return;
      if (url.pathname + url.search === window.location.pathname + window.location.search) return;
      setNavigating(true);
      clearTimeout(giveUp.current);
      giveUp.current = setTimeout(() => setNavigating(false), GIVE_UP_MS);
    }
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      clearTimeout(giveUp.current);
    };
  }, []);

  if (loading && phase !== "loading") setPhase("loading");
  if (!loading && phase === "loading") setPhase("done");

  useEffect(() => {
    if (phase !== "done") return;
    const timer = setTimeout(() => setPhase("idle"), 400);
    return () => clearTimeout(timer);
  }, [phase]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[2px] mini:h-[3px]"
    >
      <div
        className="h-full bg-yt-brand"
        style={{
          width: phase === "idle" ? "0%" : phase === "loading" ? "85%" : "100%",
          opacity: phase === "idle" ? 0 : 1,
          // Grows quickly at first and slows down while waiting, then finishes fast.
          transition:
            phase === "loading"
              ? "width 8s cubic-bezier(0.1, 0.7, 0.3, 1), opacity 0.1s"
              : phase === "done"
                ? "width 0.2s ease-out, opacity 0.3s 0.2s"
                : "none",
        }}
      />
    </div>
  );
}
