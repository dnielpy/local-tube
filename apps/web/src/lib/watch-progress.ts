const key = (id: string) => `localtube:position:${id}`;

export function readPosition(id: string): { time: number; duration: number } | null {
  try {
    const raw = localStorage.getItem(key(id));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function savePosition(id: string, time: number, duration: number) {
  try {
    if (duration && time > 5 && time < duration - 10) {
      localStorage.setItem(key(id), JSON.stringify({ time, duration }));
    } else {
      localStorage.removeItem(key(id));
    }
  } catch {
    // Storage can be unavailable (private mode); resuming is only a convenience.
  }
}

export function watchedFraction(id: string): number | undefined {
  const saved = readPosition(id);
  return saved ? saved.time / saved.duration : undefined;
}
