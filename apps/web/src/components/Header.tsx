"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";

import { IconButton } from "./IconButton";
import { AutoDownloadButton } from "./AutoDownloadButton";
import { DownloadsButton, DownloadsButtonFallback } from "./DownloadsButton";
import { FeedButton } from "./FeedButton";
import { LibraryToggle } from "./LibraryToggle";
import { BackIcon, CloseIcon, Logo, MenuIcon, SearchIcon } from "./icons";
import { ProfileMenu } from "./profiles/ProfileMenu";

export function Header({ onMenu }: { onMenu: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = pathname === "/results" ? (params.get("search_query") ?? "") : "";
  const [query, setQuery] = useState(current);
  const [synced, setSynced] = useState(current);
  const [mobileSearch, setMobileSearch] = useState(false);

  if (current !== synced) {
    setSynced(current);
    setQuery(current);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;
    setMobileSearch(false);
    router.push(`/results?search_query=${encodeURIComponent(value)}`);
  }

  const searchBox = (
    <form onSubmit={submit} role="search" className="flex h-10 w-full max-w-[640px] items-center">
      <div className="flex h-full flex-1 items-center rounded-l-full border border-yt-border bg-yt-search-bg pr-1 pl-4 shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)] focus-within:ml-0 focus-within:border-[#1c62b9]">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar"
          aria-label="Buscar"
          autoFocus={mobileSearch}
          className="h-full w-full bg-transparent text-base text-yt-text outline-none placeholder:text-[#888]"
        />
        {query && (
          <button
            type="button"
            aria-label="Borrar búsqueda"
            onClick={() => setQuery("")}
            className="flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-yt-surface"
          >
            <CloseIcon />
          </button>
        )}
      </div>
      <button
        type="submit"
        aria-label="Buscar"
        title="Buscar"
        className="flex h-full w-16 items-center justify-center rounded-r-full border border-l-0 border-yt-border bg-yt-search-button hover:bg-yt-search-button-hover"
      >
        <SearchIcon />
      </button>
    </form>
  );

  if (mobileSearch) {
    return (
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-2 bg-yt-bg px-4">
        <IconButton label="Volver" onClick={() => setMobileSearch(false)}>
          <BackIcon />
        </IconButton>
        {searchBox}
      </header>
    );
  }

  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between gap-4 bg-yt-bg px-4">
      <div className="flex shrink-0 items-center">
        <IconButton label="Guía" onClick={onMenu}>
          <MenuIcon />
        </IconButton>
        <Link
          href="/"
          title="Inicio de LocalTube"
          className="flex h-14 items-center pr-[14px] pl-4"
        >
          <Logo />
        </Link>
      </div>

      <div className="hidden min-w-0 flex-1 justify-center search:flex">{searchBox}</div>

      <div className="flex shrink-0 items-center gap-2">
        <IconButton label="Buscar" className="search:hidden" onClick={() => setMobileSearch(true)}>
          <SearchIcon />
        </IconButton>
        <LibraryToggle />
        <FeedButton />
        <AutoDownloadButton />
        <Suspense fallback={<DownloadsButtonFallback />}>
          <DownloadsButton />
        </Suspense>
        <ProfileMenu />
      </div>
    </header>
  );
}
