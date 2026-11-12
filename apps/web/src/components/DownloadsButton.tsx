"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { browser } from "react-dom";

import { isActiveJob, useDownloadJobs } from "@/lib/use-downloads";

import { DownloadIcon } from "./icons";

const SIZE = 40;
const STROKE = 2.5;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function ButtonFrame({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <Link
      href="/downloads"
      aria-label={label}
      title={label}
      className={`relative flex size-10 shrink-0 items-center justify-center rounded-full text-yt-text hover:bg-yt-surface active:bg-yt-surface-hover ${className}`}
    >
      {children ?? <DownloadIcon />}
    </Link>
  );
}

export function DownloadsButtonFallback() {
  return <ButtonFrame label="Descargas" />;
}

export function DownloadsButton() {
  use(browser("Download progress comes from the api."));
  const jobs = useDownloadJobs().data;

  const [batch, setBatch] = useState<string[]>([]);
  const [seen, setSeen] = useState<string[] | null>(null);
  const [pulse, setPulse] = useState(0);

  const active = (jobs ?? []).filter(isActiveJob);
  const ids = (jobs ?? []).map((job) => job.id);

  if (jobs) {
    if (seen === null) {
      setSeen(ids);
    } else if (ids.some((id) => !seen.includes(id))) {
      setSeen(ids);
      setPulse((value) => value + 1);
    }
    const joined = active.filter((job) => !batch.includes(job.id)).map((job) => job.id);
    if (joined.length > 0) setBatch([...batch, ...joined]);
  }

  const finished = batch.length > 0 && active.length === 0;
  useEffect(() => {
    if (!finished) return;
    const timer = setTimeout(() => setBatch([]), 1200);
    return () => clearTimeout(timer);
  }, [finished]);

  const progress =
    batch.length === 0
      ? 0
      : batch.reduce((sum, id) => {
          const job = jobs?.find((item) => item.id === id);
          if (!job || !isActiveJob(job)) return sum + 100;
          return sum + (job.status === "queued" ? 0 : job.progress);
        }, 0) / batch.length;
  const showRing = batch.length > 0;
  const waiting = showRing && !finished && progress === 0;

  const label = active.length
    ? `Descargas: ${active.length} en curso, ${Math.round(progress)}%`
    : "Descargas";

  return (
    <ButtonFrame label={label}>
      {pulse > 0 && (
        <span
          key={`ping-${pulse}`}
          className="pointer-events-none absolute inset-0 rounded-full border-2 border-yt-brand animate-lt-ping"
        />
      )}
      {showRing && (
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className={`pointer-events-none absolute inset-0 -rotate-90 ${
            waiting ? "[animation:yt-spin_1.2s_linear_infinite]" : ""
          }`}
          aria-hidden="true"
        >
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
            className="stroke-yt-surface"
          />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
            strokeLinecap="round"
            className="stroke-yt-brand transition-[stroke-dashoffset] duration-500"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={
              waiting ? CIRCUMFERENCE * 0.75 : CIRCUMFERENCE * (1 - Math.min(progress, 100) / 100)
            }
          />
        </svg>
      )}
      <span key={`icon-${pulse}`} className={pulse > 0 ? "animate-lt-bounce" : ""}>
        <span className={`block ${pulse > 0 ? "animate-lt-drop" : ""}`}>
          <DownloadIcon />
        </span>
      </span>
      {active.length > 1 && (
        <span className="pointer-events-none absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-yt-brand px-1 text-[10px] leading-none font-medium text-white">
          {active.length}
        </span>
      )}
    </ButtonFrame>
  );
}
