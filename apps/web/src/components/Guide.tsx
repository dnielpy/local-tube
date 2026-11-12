"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Suspense,
  use,
  useEffect,
  useState,
  type ComponentType,
  type ReactNode,
  type SVGProps,
} from "react";
import { browser } from "react-dom";

import { api, queryKeys } from "@/lib/api";
import { channelHref } from "@/lib/format";
import {
  CONNECTION_COLORS,
  useConnection,
  useRefetchOnStatusChange,
  useSetForcedOffline,
  useStatus,
} from "@/lib/use-status";

import { ChannelPhoto } from "./ChannelPhoto";
import { CookiesDialog } from "./profiles/ProfileMenu";
import {
  ChevronRightIcon,
  CollapseIcon,
  DownloadFilledIcon,
  DownloadIcon,
  ExpandIcon,
  HistoryIcon,
  HomeFilledIcon,
  HomeIcon,
  LikeIcon,
  Logo,
  MenuIcon,
  PlaylistIcon,
  WatchLaterIcon,
  YouIcon,
} from "./icons";

type Icon = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;
type Entry = { href: string; label: string; icon: Icon; activeIcon: Icon };

const ENTRIES: Entry[] = [
  { href: "/", label: "Inicio", icon: HomeIcon, activeIcon: HomeFilledIcon },
  { href: "/downloads", label: "Descargas", icon: DownloadIcon, activeIcon: DownloadFilledIcon },
];
const YOU: Entry = { href: "/library", label: "Tú", icon: YouIcon, activeIcon: YouIcon };

function useActive() {
  const pathname = usePathname();
  return (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
}

const VISIBLE_CHANNELS = 7;

function GuideStatus() {
  use(browser("The online status comes from the api."));
  useRefetchOnStatusChange();
  const status = useStatus();
  const connection = useConnection();
  const session = useQuery({ queryKey: queryKeys.session, queryFn: api.session, enabled: false });
  const [updating, setUpdating] = useState(false);
  const setForcedOffline = useSetForcedOffline();
  const forced = status.data?.forced_offline ?? false;
  const expired = connection?.tone === "expired";

  const summary = (
    <>
      <span className="flex size-6 shrink-0 items-center justify-center">
        <span
          className={`size-[10px] rounded-full ${
            connection ? CONNECTION_COLORS[connection.tone] : "bg-[#717171]"
          }`}
        />
      </span>
      <span className="min-w-0 text-left">
        <span className="block text-sm font-medium">{connection?.label ?? "Comprobando…"}</span>
        <span className="block truncate text-xs text-yt-text-secondary">{connection?.detail}</span>
      </span>
    </>
  );

  return (
    <section className="border-b border-yt-divider px-3 py-3">
      {expired && session.data ? (
        <button
          type="button"
          onClick={() => setUpdating(true)}
          title="Actualizar cookies de YouTube"
          className="flex w-full items-center gap-6 rounded-[10px] px-3 py-2 hover:bg-yt-surface"
        >
          {summary}
        </button>
      ) : (
        <div className="flex items-center gap-6 px-3 py-2">{summary}</div>
      )}
      {updating && session.data && (
        <CookiesDialog profile={session.data} onClose={() => setUpdating(false)} />
      )}
      <button
        type="button"
        role="switch"
        aria-checked={forced}
        disabled={!status.data || setForcedOffline.isPending}
        onClick={() => setForcedOffline.mutate(!forced)}
        className="flex h-10 w-full items-center justify-between rounded-[10px] px-3 text-sm hover:bg-yt-surface disabled:opacity-50"
      >
        <span>Modo sin conexión</span>
        <span
          className={`relative h-[14px] w-9 rounded-full transition-colors ${
            forced ? "bg-[#3ea6ff]/50" : "bg-[#717171]"
          }`}
        >
          <span
            className={`absolute top-1/2 size-5 -translate-y-1/2 rounded-full shadow transition-all ${
              forced ? "left-4 bg-[#3ea6ff]" : "left-0 bg-[#f1f1f1]"
            }`}
          />
        </span>
      </button>
    </section>
  );
}

function GuideChannels() {
  use(browser("Channels are fetched from the api in the browser."));
  const [expanded, setExpanded] = useState(false);
  const channels = useQuery({
    queryKey: queryKeys.channels,
    queryFn: api.channels,
    refetchInterval: (query) => (query.state.data?.syncing ? 3000 : false),
  });
  const items = channels.data?.items ?? [];
  if (items.length === 0) return null;
  const visible = expanded ? items : items.slice(0, VISIBLE_CHANNELS);
  const subscriptions = items.some((channel) => channel.subscribed);

  return (
    <section className="border-b border-yt-divider px-3 py-3">
      <h3 className="px-3 pt-[6px] pb-1 text-base font-medium">
        {subscriptions ? "Suscripciones" : "Canales descargados"}
      </h3>
      {visible.map((channel) => (
        <Link
          key={channel.id ?? channel.name}
          href={channelHref({ channel_id: channel.id, channel: channel.name })}
          title={channel.name}
          className="flex h-10 items-center gap-6 rounded-[10px] px-3 hover:bg-yt-surface"
        >
          <ChannelPhoto src={channel.avatar_url} name={channel.name} size={24} />
          <span className="truncate text-sm">{channel.name}</span>
        </Link>
      ))}
      {items.length > VISIBLE_CHANNELS && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="flex h-10 w-full items-center gap-6 rounded-[10px] px-3 text-sm hover:bg-yt-surface"
        >
          {expanded ? <CollapseIcon /> : <ExpandIcon />}
          {expanded ? "Mostrar menos" : `Mostrar ${items.length - VISIBLE_CHANNELS} más`}
        </button>
      )}
    </section>
  );
}

function MiniStatusDot() {
  use(browser("The online status comes from the api."));
  const connection = useConnection();
  return (
    <span
      title={connection?.label}
      className={`absolute top-3 right-4 size-2 rounded-full ring-2 ring-yt-bg ${
        connection ? CONNECTION_COLORS[connection.tone] : "bg-[#717171]"
      }`}
    />
  );
}

function GuideLink({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex h-10 items-center gap-6 rounded-[10px] px-3 ${
        active ? "bg-yt-surface font-medium hover:bg-yt-surface-hover" : "hover:bg-yt-surface"
      }`}
    >
      {icon}
      <span className="truncate text-sm">{label}</span>
    </Link>
  );
}

/** The "Tú" section of YouTube's guide: history and playlists of the profile. */
function GuideYou() {
  use(browser("The playlists of the profile come from the api."));
  const pathname = usePathname();
  const list = useSearchParams().get("list");
  const playlists = useQuery({ queryKey: queryKeys.playlists(), queryFn: () => api.playlists() });
  const system = (kind: string) => playlists.data?.find((playlist) => playlist.kind === kind);
  const watchLater = system("watch_later");
  const liked = system("liked");

  return (
    <section className="border-b border-yt-divider px-3 py-3">
      <Link
        href="/library"
        className={`flex h-10 items-center gap-2 rounded-[10px] px-3 text-base font-medium ${
          pathname === "/library"
            ? "bg-yt-surface hover:bg-yt-surface-hover"
            : "hover:bg-yt-surface"
        }`}
      >
        Tú
        <ChevronRightIcon size={20} />
      </Link>
      <GuideLink
        href="/history"
        label="Historial"
        icon={<HistoryIcon />}
        active={pathname === "/history"}
      />
      <GuideLink
        href="/playlists"
        label="Listas de reproducción"
        icon={<PlaylistIcon />}
        active={pathname === "/playlists"}
      />
      {watchLater && (
        <GuideLink
          href={`/playlist?list=${watchLater.id}`}
          label="Ver más tarde"
          icon={<WatchLaterIcon />}
          active={pathname === "/playlist" && list === watchLater.id}
        />
      )}
      {liked && (
        <GuideLink
          href={`/playlist?list=${liked.id}`}
          label="Videos que me gustan"
          icon={<LikeIcon />}
          active={pathname === "/playlist" && list === liked.id}
        />
      )}
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
        <GuideYou />
      </Suspense>
      <Suspense>
        <GuideStatus />
      </Suspense>
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
      {[...ENTRIES, YOU].map(({ href, label, icon: Icon, activeIcon: ActiveIcon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            className="relative flex h-[74px] w-16 flex-col items-center justify-center gap-[6px] rounded-[10px] pt-4 pb-[14px] hover:bg-yt-surface"
          >
            {href === "/" && (
              <Suspense>
                <MiniStatusDot />
              </Suspense>
            )}
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
