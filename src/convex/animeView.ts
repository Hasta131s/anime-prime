/**
 * Shared contract between the Convex backend and the React app.
 *
 * This module is intentionally dependency-free (Convex types are imported with
 * `import type`, so nothing is pulled in at runtime) which lets both the server
 * functions and the UI import the same view types, feed definitions and mappers.
 */

import type { Doc } from "./_generated/dataModel";

// ---------------------------------------------------------------------------
// Feeds
// ---------------------------------------------------------------------------

export type FeedKey = "trending" | "airing" | "popular" | "top";

export const FEED_ORDER: FeedKey[] = ["trending", "airing", "popular", "top"];

type FeedDefinition = {
  label: string;
  blurb: string;
  /** AniList `MediaSort` values. */
  sort: string[];
  /** AniList `MediaStatus` filter. */
  status?: string;
  perPage: number;
};

export const FEED_DEFINITIONS: Record<FeedKey, FeedDefinition> = {
  trending: {
    label: "Şu an trend",
    blurb: "AniList trend sıralamasında bu aralar en çok öne çıkanlar.",
    sort: ["TRENDING_DESC"],
    perPage: 40,
  },
  airing: {
    label: "Bu sezon yayında",
    blurb: "Yeni bölümleriyle devam eden, şu anda yayında olan yapımlar.",
    sort: ["POPULARITY_DESC"],
    status: "RELEASING",
    perPage: 40,
  },
  popular: {
    label: "Tüm zamanların en popüleri",
    blurb: "İzleyicilerin en çok takip ettiği animeler.",
    sort: ["POPULARITY_DESC"],
    perPage: 40,
  },
  top: {
    label: "En yüksek puanlılar",
    blurb: "AniList ortalaması en yüksek olan yapımlar.",
    sort: ["SCORE_DESC"],
    perPage: 40,
  },
};

export function isFeedKey(value: string | null | undefined): value is FeedKey {
  return (
    value === "trending" ||
    value === "airing" ||
    value === "popular" ||
    value === "top"
  );
}

/** Where each rail links to on the browse page. */
export const FEED_SORT_PARAM: Record<FeedKey, string> = {
  trending: "popular",
  airing: "popular",
  popular: "popular",
  top: "score",
};

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

export type AnimeCardView = {
  anilistId: number;
  idMal?: number;
  title: string;
  titleEnglish?: string;
  titleNative?: string;
  synopsis?: string;
  cover?: string;
  coverColor?: string;
  banner?: string;
  genres: string[];
  score?: number;
  popularity?: number;
  favourites?: number;
  format?: string;
  status?: string;
  episodes?: number;
  duration?: number;
  season?: string;
  seasonYear?: number;
  year?: number;
  studios: string[];
  trailerId?: string;
  trailerSite?: string;
  nextEpisode?: number;
  nextEpisodeAt?: number;
  siteUrl?: string;
  detailSyncedAt?: number;
  updatedAt: number;
};

export type TitleRefView = {
  anilistId: number;
  title: string;
  cover?: string;
  format?: string;
  score?: number;
  relationType?: string;
};

export type CharacterView = {
  name: string;
  image?: string;
  role?: string;
  voiceActor?: string;
  voiceImage?: string;
};

export type EpisodeView = {
  title: string;
  thumbnail?: string;
  url: string;
  site?: string;
};

export type StreamView = {
  site: string;
  url: string;
  icon?: string;
};

export type AnimeDetailView = AnimeCardView & {
  characters?: CharacterView[];
  relations?: TitleRefView[];
  recommendations?: TitleRefView[];
  streamEpisodes?: EpisodeView[];
  streams?: StreamView[];
};

export type SyncStatus = "ready" | "syncing" | "error";

export type FeedResult = {
  status: SyncStatus;
  message?: string;
  syncedAt?: number;
  items: AnimeCardView[];
  /**
   * True when the cache is missing/stale and a sync should be requested.
   * Queries cannot schedule work, so they report it and the UI kicks off the
   * guarded sync action (`useFeed` in `@/hooks/use-anime`).
   */
  needsSync: boolean;
};

export type DetailResult = {
  status: SyncStatus;
  message?: string;
  anime: AnimeDetailView | null;
  needsSync: boolean;
};

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

export function toCardView(doc: Doc<"anime">): AnimeCardView {
  const {
    _id,
    _creationTime,
    characters: _characters,
    relations: _relations,
    recommendations: _recommendations,
    streamEpisodes: _streamEpisodes,
    streams: _streams,
    searchText: _searchText,
    ...card
  } = doc;
  return card;
}

export function toDetailView(doc: Doc<"anime">): AnimeDetailView {
  return {
    ...toCardView(doc),
    characters: doc.characters,
    relations: doc.relations,
    recommendations: doc.recommendations,
    streamEpisodes: doc.streamEpisodes,
    streams: doc.streams,
  };
}
