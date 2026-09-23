/**
 * Watch progress.
 *
 * Playback positions live in localStorage so "kaldığın yerden devam et" works
 * without requiring an account. Nothing is sent anywhere.
 */

export type WatchProgress = {
  animeId: number;
  episode: number;
  position: number;
  duration: number;
  updatedAt: number;
};

const STORAGE_KEY = "anime-prime:progress:v1";
/** Ignore the first seconds so brief peeks do not create a resume point. */
const MIN_POSITION_SECONDS = 20;
/** Near the end we treat the episode as finished and clear the pointer. */
const COMPLETED_RATIO = 0.95;

function storageKey(animeId: number, episode: number) {
  return `${animeId}:${episode}`;
}

function readStore(): Record<string, WatchProgress> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, WatchProgress>;
  } catch {
    return {};
  }
}

function writeStore(store: Record<string, WatchProgress>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Private browsing / full storage: progress is a nice-to-have.
  }
}

export function getProgress(animeId: number, episode: number) {
  const entry = readStore()[storageKey(animeId, episode)];
  return entry && entry.position > 0 ? entry : null;
}

export function saveProgress(
  animeId: number,
  episode: number,
  position: number,
  duration: number,
) {
  if (!Number.isFinite(position) || !Number.isFinite(duration) || duration <= 0) {
    return;
  }

  const store = readStore();
  const key = storageKey(animeId, episode);

  if (
    position < MIN_POSITION_SECONDS ||
    position / duration >= COMPLETED_RATIO
  ) {
    delete store[key];
    writeStore(store);
    return;
  }

  store[key] = {
    animeId,
    episode,
    position,
    duration,
    updatedAt: Date.now(),
  };
  writeStore(store);
}

export function clearProgress(animeId: number, episode: number) {
  const store = readStore();
  delete store[storageKey(animeId, episode)];
  writeStore(store);
}

/** Most recently watched episode of a title, if any. */
export function latestProgressFor(animeId: number): WatchProgress | null {
  const entries = Object.values(readStore()).filter(
    (entry) => entry.animeId === animeId,
  );
  if (entries.length === 0) return null;
  return entries.sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null;
}

/** "12:34" / "1:02:03" */
export function formatClock(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}
