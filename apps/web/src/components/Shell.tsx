"use client";

import { usePathname } from "next/navigation";
import { Suspense, useCallback, useEffect, useState, type ReactNode } from "react";

import { Drawer, FullGuide, MiniGuide } from "./Guide";
import { Header } from "./Header";

const onWatchPage = () => document.querySelector("[data-watch]") !== null;

export function Shell({ children }: { children: ReactNode }) {
  const [expanded, setExpanded] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const toggleGuide = useCallback(() => {
    const wide = window.matchMedia("(min-width: 1313px)").matches;
    if (!onWatchPage() && wide) setExpanded((value) => !value);
    else setDrawerOpen((value) => !value);
  }, []);

  return (
    <div className="group/shell" data-guide={expanded ? "expanded" : "mini"}>
      <Suspense fallback={<div className="h-14" />}>
        <Header onMenu={toggleGuide} />
      </Suspense>
      <Suspense>
        <FullGuide className="hidden guide:group-data-[guide=expanded]/shell:block group-has-[[data-watch]]/shell:hidden!" />
      </Suspense>
      <Suspense>
        <MiniGuide className="hidden mini:flex guide:group-data-[guide=expanded]/shell:hidden group-has-[[data-watch]]/shell:hidden!" />
      </Suspense>
      <Suspense>
        <RouteDrawer open={drawerOpen} onClose={closeDrawer} />
      </Suspense>
      <main className="pt-14 mini:pl-[72px] guide:group-data-[guide=expanded]/shell:pl-[240px] group-has-[[data-watch]]/shell:pl-0!">
        {children}
      </main>
    </div>
  );
}

function RouteDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  useEffect(() => onClose(), [pathname, onClose]);
  return <Drawer open={open} onClose={onClose} />;
}
