"use client";

import { usePathname } from "next/navigation";
import { Suspense, useCallback, useState, type ReactNode } from "react";

import { Drawer, FullGuide, MiniGuide } from "./Guide";
import { Header } from "./Header";

/**
 * youtube.com layout: a 56px header, a 240px guide from 1313px wide (collapsible to the 72px
 * mini guide), the mini guide from 792px, and an overlay drawer below that or on the watch page.
 */
export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isWatch = pathname.startsWith("/watch");
  const [expanded, setExpanded] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerPath, setDrawerPath] = useState(pathname);

  const toggleGuide = useCallback(() => {
    const wide = window.matchMedia("(min-width: 1313px)").matches;
    if (!isWatch && wide) setExpanded((value) => !value);
    else setDrawerOpen((value) => !value);
  }, [isWatch]);

  // Close the drawer after navigating from it.
  if (drawerPath !== pathname) {
    setDrawerPath(pathname);
    setDrawerOpen(false);
  }

  return (
    <div className="group/shell" data-guide={expanded ? "expanded" : "mini"}>
      <Suspense fallback={<div className="h-14" />}>
        <Header onMenu={toggleGuide} />
      </Suspense>
      {!isWatch && (
        <>
          <FullGuide className="hidden guide:group-data-[guide=expanded]/shell:block" />
          <MiniGuide className="hidden mini:flex guide:group-data-[guide=expanded]/shell:hidden" />
        </>
      )}
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <main
        className={
          isWatch
            ? "pt-14"
            : "pt-14 mini:pl-[72px] guide:group-data-[guide=expanded]/shell:pl-[240px]"
        }
      >
        {children}
      </main>
    </div>
  );
}
