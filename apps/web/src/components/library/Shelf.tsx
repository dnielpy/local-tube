import Link from "next/link";
import type { ReactNode } from "react";

/** A titled row of the "Tú" page, like YouTube's: one line of cards and "Ver todo". */
export function Shelf({
  title,
  href,
  icon,
  empty,
  children,
}: {
  title: string;
  href?: string;
  icon: ReactNode;
  empty?: string;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-yt-divider py-6 last:border-0">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="flex items-center gap-3 text-xl font-bold">
          {icon}
          {href ? <Link href={href}>{title}</Link> : title}
        </h2>
        {href && (
          <Link
            href={href}
            className="flex h-9 items-center rounded-full border border-yt-border px-4 text-sm font-medium hover:bg-yt-surface"
          >
            Ver todo
          </Link>
        )}
      </div>
      {empty ? (
        <p className="text-sm text-yt-text-secondary">{empty}</p>
      ) : (
        <div className="grid auto-cols-[minmax(200px,1fr)] grid-flow-col gap-x-4 overflow-x-auto pb-2 [scrollbar-width:thin] xs:auto-cols-[minmax(210px,calc((100%-3rem)/4))]">
          {children}
        </div>
      )}
    </section>
  );
}
