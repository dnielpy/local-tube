"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, use, useEffect, type ComponentType, type SVGProps } from "react";
import { browser } from "react-dom";

import { api, queryKeys } from "@/lib/api";

import { ChannelAvatar } from "./ChannelAvatar";
import {
  DownloadFilledIcon,
  DownloadIcon,
  HomeFilledIcon,
  HomeIcon,
  Logo,
  MenuIcon,
} from "./icons";

type Icon = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;
type Entry = { href: string; label: string; icon: Icon; activeIcon: Icon };

const ENTRIES: Entry[] = [
  { href: "/", label: "Inicio", icon: HomeIcon, activeIcon: HomeFilledIcon },
  { href: "/downloads", label: "Descargas", icon: DownloadIcon, activeIcon: DownloadFilledIcon },
];

function useActive() {
  const pathname = usePathname();
  return (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
}

function GuideChannels() {
  use(browser("Channels are fetched from the api in the browser."));
  const channels = useQuery({ queryKey: queryKeys.channels, queryFn: api.channels });
  if (!channels.data || channels.data.length === 0) return null;
  return (
    <section className="border-b border-yt-divider px-3 py-3">
      <h3 className="px-3 pt-[6px] pb-1 text-base font-medium">Canales</h3>
      {channels.data.map((channel) => (
        <Link
          key={channel}
          href={`/?channel=${encodeURIComponent(channel)}`}
          className="flex h-10 items-center gap-6 rounded-[10px] px-3 hover:bg-yt-surface"
        >
          <ChannelAvatar name={channel} size={24} />
          <span className="truncate text-sm">{channel}</span>
        </Link>
      ))}
    </section>
  );
}

function GuideContents() {
  const isActive = useActive();

  return (
    <nav className="flex flex-col">
      <section className="border-b border-yt-divider px-3 py-3">
        {ENTRIES.map(({ href, label, icon: Icon, activeIcon: ActiveIcon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex h-10 items-center gap-6 rounded-[10px] px-3 ${
                active
                  ? "bg-yt-surface font-medium hover:bg-yt-surface-hover"
                  : "hover:bg-yt-surface"
              }`}
            >
              {active ? <ActiveIcon /> : <Icon />}
              <span className="truncate text-sm">{label}</span>
            </Link>
          );
        })}
      </section>
      <Suspense>
        <GuideChannels />
      </Suspense>
      <footer className="px-6 py-4 text-xs text-yt-text-secondary">
        <p className="font-medium">LocalTube</p>
        <p className="mt-3 text-[#717171]">Tu biblioteca de videos en la red local</p>
      </footer>
    </nav>
  );
}

export function FullGuide({ className = "" }: { className?: string }) {
  return (
    <aside
      className={`fixed top-14 bottom-0 left-0 z-20 w-60 overflow-y-auto bg-yt-bg hover:[scrollbar-color:#717171_transparent] ${className}`}
    >
      <GuideContents />
    </aside>
  );
}

export function MiniGuide({ className = "" }: { className?: string }) {
  const isActive = useActive();
  return (
    <aside
      className={`fixed top-14 bottom-0 left-0 z-20 w-[72px] flex-col bg-yt-bg px-1 pt-1 ${className}`}
    >
      {ENTRIES.map(({ href, label, icon: Icon, activeIcon: ActiveIcon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            className="flex h-[74px] w-16 flex-col items-center justify-center gap-[6px] rounded-[10px] pt-4 pb-[14px] hover:bg-yt-surface"
          >
            {active ? <ActiveIcon /> : <Icon />}
            <span className="max-w-full truncate text-[10px] leading-[14px]">{label}</span>
          </Link>
        );
      })}
    </aside>
  );
}

export function Drawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
      <div
        className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />
      <div
        className={`absolute top-0 bottom-0 left-0 flex w-60 flex-col bg-yt-bg transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-14 shrink-0 items-center gap-4 px-4">
          <button
            type="button"
            aria-label="Guía"
            onClick={onClose}
            className="flex size-10 items-center justify-center rounded-full hover:bg-yt-surface"
          >
            <MenuIcon />
          </button>
          <Link href="/" className="flex h-14 items-center pl-1">
            <Logo />
          </Link>
        </div>
        <div className="overflow-y-auto">
          <GuideContents />
        </div>
      </div>
    </div>
  );
}
