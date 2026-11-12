import type { ButtonHTMLAttributes, ReactNode } from "react";

/** The round 40px icon button used across the youtube.com header and menus. */
export function IconButton({
  label,
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`flex size-10 shrink-0 items-center justify-center rounded-full text-yt-text hover:bg-yt-surface active:bg-yt-surface-hover disabled:opacity-40 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
