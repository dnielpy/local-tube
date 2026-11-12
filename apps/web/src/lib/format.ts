export function formatDuration(totalSeconds: number | null | undefined): string {
  if (totalSeconds == null || !Number.isFinite(totalSeconds)) return "0:00";
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

const relative = new Intl.RelativeTimeFormat("es", { numeric: "always" });
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31536000],
  ["month", 2592000],
  ["week", 604800],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
];

export function timeAgo(iso: string, now: number = Date.now()): string {
  const seconds = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  for (const [unit, size] of UNITS) {
    if (seconds >= size) return relative.format(-Math.floor(seconds / size), unit);
  }
  return "hace unos segundos";
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const compact = new Intl.NumberFormat("es", {
  notation: "compact",
  maximumFractionDigits: 2,
});

export function formatCount(value: number | null | undefined, noun: string): string | null {
  if (value == null) return null;
  return `${compact.format(value)} de ${noun}`;
}

export function channelHref(channel: { channel_id?: string | null; channel?: string | null }) {
  if (channel.channel_id) return `/channel/${channel.channel_id}`;
  return `/?channel=${encodeURIComponent(channel.channel ?? "")}`;
}

export function formatBytes(bytes: number | null | undefined): string | null {
  if (!bytes) return null;
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export function channelColor(name: string | null | undefined): string {
  let hash = 0;
  for (const char of name ?? "") hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return `hsl(${Math.abs(hash) % 360} 45% 42%)`;
}

export function channelInitial(name: string | null | undefined): string {
  return (name?.trim()[0] ?? "?").toUpperCase();
}
