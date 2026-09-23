/**
 * Shared contract for playable sources between Convex and the player.
 * Pure module: safe to import from both the backend and the browser bundle.
 */

import type { Id } from "./_generated/dataModel";

export type SourceKind = "hls" | "mp4" | "auto";

export type PlaybackSourceView = {
  id: Id<"playbackSources">;
  anilistId: number;
  /** 1-based episode number; 0 means a film / single-part title. */
  episode: number;
  label: string;
  url: string;
  kind: SourceKind;
  language?: string;
  note?: string;
  createdAt: number;
};

export const KIND_LABELS: Record<SourceKind, string> = {
  hls: "HLS akışı (m3u8)",
  mp4: "MP4 dosyası",
  auto: "Otomatik algılanır",
};

const VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov", ".m4v", ".ogv"];

/** Guesses the container from the URL path; `auto` lets the player decide. */
export function inferKind(url: string): SourceKind {
  const path = url.split(/[?#]/)[0]?.toLowerCase() ?? "";
  if (path.endsWith(".m3u8") || path.endsWith(".m3u")) return "hls";
  if (VIDEO_EXTENSIONS.some((extension) => path.endsWith(extension))) return "mp4";
  return "auto";
}

export function isHlsUrl(url: string, kind: SourceKind = "auto") {
  return kind === "hls" || (kind === "auto" && inferKind(url) === "hls");
}

/** Host label used in the UI without leaking the full path. */
export function hostLabel(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
