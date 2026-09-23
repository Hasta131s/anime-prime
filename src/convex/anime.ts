/**
 * Anime catalogue — Convex queries, mutations and AniList sync actions.
 *
 * Design notes
 * ------------
 * • Every card the UI renders comes from AniList's public API. There is no seed
 *   data and nothing is invented, so posters, banners, characters, scores and
 *   streaming links are all real. When artwork is missing the UI renders a
 *   typographic placeholder built from the real title rather than a fake image.
 * • Reads are reactive Convex queries over a local cache. Queries cannot
 *   schedule work, so a stale or empty cache is reported with `needsSync`, and
 *   the UI's `useFeed` / `useAnimeDetail` hooks call the matching sync action.
 * • Sync actions are guarded: they no-op while another run is in flight and back
 *   off exponentially after a failure, so a broken upstream can never become a
 *   request loop. A cron keeps the four rails warm even without traffic.
 */

import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { fetchDetail, fetchFeed, fetchSearch, type NormalizedCard } from "./anilist";
import {
  FEED_DEFINITIONS,
  isFeedKey,
  toCardView,
  toDetailView,
  type AnimeCardView,
  type DetailResult,
  type FeedResult,
  type TitleRefView,
} from "./animeView";

/** Rail data is refreshed every 6 hours; detail payloads every 24. */
const FEED_TTL_MS = 6 * 60 * 60 * 1000;
const DETAIL_TTL_MS = 24 * 60 * 60 * 1000;
/** How long a sync may stay "running" before another one is allowed. */
const RUNNING_WINDOW_MS = 120_000;
const BASE_RETRY_MS = 15_000;
const MAX_RETRY_MS = 15 * 60 * 1000;
/** Upper bound on rows scanned for browse / stats queries. */
const CATALOG_SCAN_LIMIT = 500;

type SyncRow = Doc<"syncs"> | null;

export function feedSyncKey(list: string) {
  return `feed:${list}`;
}

function detailSyncKey(anilistId: number) {
  return `detail:${anilistId}`;
}

async function readSync(ctx: QueryCtx | MutationCtx, key: string): Promise<SyncRow> {
  return await ctx.db
    .query("syncs")
    .withIndex("by_key", (q) => q.eq("key", key))
    .first();
}

/** Exponential backoff between retries of a failing sync. */
function backoffMs(attempts: number) {
  return Math.min(BASE_RETRY_MS * 2 ** Math.min(attempts, 6), MAX_RETRY_MS);
}

/** Is a sync allowed to start right now? */
function shouldSync(sync: SyncRow, now: number) {
  if (!sync) return true;
  if (sync.status === "running") return now - sync.attemptedAt > RUNNING_WINDOW_MS;
  return now - sync.attemptedAt > backoffMs(sync.attempts);
}

async function loadCards(ctx: QueryCtx, ids: Id<"anime">[]): Promise<AnimeCardView[]> {
  const docs = await Promise.all(ids.map((id) => ctx.db.get(id)));
  return docs.filter((doc): doc is Doc<"anime"> => doc !== null).map(toCardView);
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/** `NormalizedCard` and `AnimeCardView` intentionally share a shape. */
function cardToView(card: NormalizedCard): AnimeCardView {
  return { ...card };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * One editorial rail (`trending` | `airing` | `popular` | `top`).
 * Returns whatever is cached plus whether a sync is needed.
 */
export const feed = query({
  args: { list: v.string() },
  handler: async (ctx, args): Promise<FeedResult> => {
    if (!isFeedKey(args.list)) {
      return {
        status: "error",
        message: "Bilinmeyen liste istendi.",
        items: [],
        needsSync: false,
      };
    }

    const now = Date.now();
    const [sync, feedDoc] = await Promise.all([
      readSync(ctx, feedSyncKey(args.list)),
      ctx.db
        .query("feeds")
        .withIndex("by_list", (q) => q.eq("list", args.list))
        .first(),
    ]);

    const items = feedDoc ? await loadCards(ctx, feedDoc.animeIds) : [];
    const syncedAt = feedDoc?.syncedAt;
    const fresh = syncedAt !== undefined && now - syncedAt < FEED_TTL_MS;
    const needsSync = !fresh && shouldSync(sync, now);

    if (fresh && items.length > 0) {
      return { status: "ready", items, syncedAt, needsSync: false };
    }

    // Hard failure with nothing cached: surface it so the UI can offer a retry.
    if (sync?.status === "error" && items.length === 0) {
      return {
        status: "error",
        message: sync.message ?? "İçerik şu anda yüklenemedi.",
        items: [],
        needsSync,
      };
    }

    // Stale data (if any) stays on screen while the refresh runs.
    return { status: "syncing", items, syncedAt, needsSync };
  },
});

/** A single title, with characters / episodes / links fetched on demand. */
export const detail = query({
  args: { anilistId: v.number() },
  handler: async (ctx, args): Promise<DetailResult> => {
    if (!Number.isInteger(args.anilistId) || args.anilistId <= 0) {
      return {
        status: "error",
        message: "Geçersiz yapım kimliği.",
        anime: null,
        needsSync: false,
      };
    }

    const now = Date.now();
    const [doc, sync] = await Promise.all([
      ctx.db
        .query("anime")
        .withIndex("by_anilistId", (q) => q.eq("anilistId", args.anilistId))
        .first(),
      readSync(ctx, detailSyncKey(args.anilistId)),
    ]);

    const hasDetail = Boolean(doc?.detailSyncedAt);
    const stale = !doc?.detailSyncedAt || now - doc.detailSyncedAt > DETAIL_TTL_MS;
    const needsSync = stale && shouldSync(sync, now);

    if (doc && hasDetail) {
      return { status: "ready", anime: toDetailView(doc), needsSync };
    }

    if (!doc && sync?.status === "error") {
      return {
        status: "error",
        message: sync.message ?? "Bu yapım bulunamadı.",
        anime: null,
        needsSync,
      };
    }

    return { status: "syncing", anime: doc ? toDetailView(doc) : null, needsSync };
  },
});

const SORT_FIELDS: Record<string, keyof Doc<"anime">> = {
  popular: "popularity",
  score: "score",
  newest: "year",
};

type GenreCount = { name: string; count: number };

function countGenres(docs: Doc<"anime">[]): GenreCount[] {
  const counts = new Map<string, number>();
  for (const doc of docs) {
    for (const genre of doc.genres) {
      counts.set(genre, (counts.get(genre) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/**
 * Browse catalogue: full-text search over cached titles plus genre and sort
 * filtering. Genre facets come back in the same round-trip.
 */
export const catalog = query({
  args: {
    q: v.optional(v.string()),
    genre: v.optional(v.string()),
    sort: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const term = args.q?.trim() ?? "";
    const all = await ctx.db.query("anime").take(CATALOG_SCAN_LIMIT);

    let rows: Doc<"anime">[];
    if (term.length >= 2) {
      rows = await ctx.db
        .query("anime")
        .withSearchIndex("search_text", (q) => q.search("searchText", term))
        .take(72);
    } else {
      const field = SORT_FIELDS[args.sort ?? "popular"] ?? "popularity";
      rows = [...all].sort((a, b) => Number(b[field] ?? 0) - Number(a[field] ?? 0));
    }

    if (args.genre) {
      const genre = args.genre;
      rows = rows.filter((doc) => doc.genres.includes(genre));
    }

    return {
      items: rows.slice(0, 120).map(toCardView),
      total: all.length,
      matching: rows.length,
      genres: countGenres(all),
      searching: term.length >= 2,
    };
  },
});

/** Small real-data summary used on the landing page. */
export const stats = query({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db.query("anime").take(CATALOG_SCAN_LIMIT);
    const genres = countGenres(docs);
    const studios = new Set<string>();
    let lastUpdatedAt = 0;

    for (const doc of docs) {
      for (const studio of doc.studios) studios.add(studio);
      if (doc.updatedAt > lastUpdatedAt) lastUpdatedAt = doc.updatedAt;
    }

    return {
      titles: docs.length,
      genres: genres.length,
      studios: studios.size,
      lastUpdatedAt: lastUpdatedAt > 0 ? lastUpdatedAt : undefined,
      topGenres: genres.slice(0, 12),
    };
  },
});

/** Sync bookkeeping for one key (consumed by the sync actions). */
export const getSync = internalQuery({
  args: { key: v.string() },
  handler: async (ctx, args) => readSync(ctx, args.key),
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Clears cached state for a rail or a title so the next read asks for a sync
 * again. Powers the "Tekrar dene" buttons; safe for anyone to call.
 */
export const retry = mutation({
  args: {
    list: v.optional(v.string()),
    anilistId: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (args.list && isFeedKey(args.list)) {
      const list = args.list;
      const sync = await readSync(ctx, feedSyncKey(list));
      if (sync) await ctx.db.delete(sync._id);
      const feedDoc = await ctx.db
        .query("feeds")
        .withIndex("by_list", (q) => q.eq("list", list))
        .first();
      if (feedDoc) await ctx.db.delete(feedDoc._id);
      return;
    }

    if (args.anilistId !== undefined) {
      const anilistId = args.anilistId;
      const sync = await readSync(ctx, detailSyncKey(anilistId));
      if (sync) await ctx.db.delete(sync._id);
      const doc = await ctx.db
        .query("anime")
        .withIndex("by_anilistId", (q) => q.eq("anilistId", anilistId))
        .first();
      // `undefined` removes the field, which makes the detail query sync again.
      if (doc) await ctx.db.patch(doc._id, { detailSyncedAt: undefined });
    }
  },
});

/** Records the outcome of a sync attempt (status, message, backoff counter). */
export const markSync = internalMutation({
  args: {
    key: v.string(),
    status: v.string(),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await readSync(ctx, args.key);
    const attempts =
      args.status === "ok"
        ? 0
        : (existing?.attempts ?? 0) + (args.status === "error" ? 1 : 0);
    const payload = {
      key: args.key,
      status: args.status,
      message: args.message,
      attempts,
      attemptedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
    } else {
      await ctx.db.insert("syncs", payload);
    }
  },
});

/**
 * Upsert normalised AniList cards.
 * The payload is shaped by `normalizeCard` rather than a duplicate Convex
 * validator (the schema opts out of runtime validation), which keeps the wire
 * shape single-sourced.
 */
export const upsertCards = internalMutation({
  args: { cards: v.any() },
  handler: async (ctx, args): Promise<Id<"anime">[]> => {
    const cards = args.cards as NormalizedCard[];
    const ids: Id<"anime">[] = [];

    for (const card of cards) {
      const existing = await ctx.db
        .query("anime")
        .withIndex("by_anilistId", (q) => q.eq("anilistId", card.anilistId))
        .first();

      if (existing) {
        // Only card-level fields are patched so cached detail payloads survive.
        await ctx.db.patch(existing._id, { ...card, updatedAt: Date.now() });
        ids.push(existing._id);
      } else {
        ids.push(await ctx.db.insert("anime", { ...card, updatedAt: Date.now() }));
      }
    }

    return ids;
  },
});

/** Upsert a full detail payload (card fields + characters, relations, links). */
export const upsertDetail = internalMutation({
  args: { detail: v.any(), anilistId: v.number() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("anime")
      .withIndex("by_anilistId", (q) => q.eq("anilistId", args.anilistId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, args.detail);
      return;
    }
    await ctx.db.insert("anime", args.detail);
  },
});

/** Stores the ordered ids behind a rail. */
export const writeFeed = internalMutation({
  args: { list: v.string(), animeIds: v.array(v.id("anime")) },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("feeds")
      .withIndex("by_list", (q) => q.eq("list", args.list))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        animeIds: args.animeIds,
        syncedAt: Date.now(),
      });
      return;
    }
    await ctx.db.insert("feeds", {
      list: args.list,
      animeIds: args.animeIds,
      syncedAt: Date.now(),
    });
  },
});

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

type SyncOutcome = { synced: boolean; reason?: string };

/**
 * Refreshes one rail from AniList.
 * Safe to call from the UI: it no-ops when the cache is fresh, when another run
 * is in flight, or while a failure backoff is active.
 */
export const syncFeed = action({
  args: { list: v.string() },
  handler: async (ctx, args): Promise<SyncOutcome> => {
    if (!isFeedKey(args.list)) return { synced: false, reason: "unknown-list" };

    const key = feedSyncKey(args.list);
    const now = Date.now();
    const sync = await ctx.runQuery(internal.anime.getSync, { key });
    if (sync && !shouldSync(sync, now)) {
      return { synced: false, reason: "recent-attempt" };
    }

    await ctx.runMutation(internal.anime.markSync, { key, status: "running" });

    try {
      const definition = FEED_DEFINITIONS[args.list];
      const cards = await fetchFeed({
        sort: definition.sort,
        status: definition.status,
        perPage: definition.perPage,
      });

      if (cards.length === 0) {
        throw new Error("AniList bu liste için sonuç döndürmedi.");
      }

      const animeIds = await ctx.runMutation(internal.anime.upsertCards, { cards });
      await ctx.runMutation(internal.anime.writeFeed, { list: args.list, animeIds });
      await ctx.runMutation(internal.anime.markSync, { key, status: "ok" });
      return { synced: true };
    } catch (error) {
      await ctx.runMutation(internal.anime.markSync, {
        key,
        status: "error",
        message: errorMessage(error, "AniList isteği başarısız oldu."),
      });
      return { synced: false, reason: "error" };
    }
  },
});

/** Loads characters, episodes, relations and streaming links for one title. */
export const syncDetail = action({
  args: { anilistId: v.number() },
  handler: async (ctx, args): Promise<SyncOutcome> => {
    const key = detailSyncKey(args.anilistId);
    const now = Date.now();
    const sync = await ctx.runQuery(internal.anime.getSync, { key });
    if (sync && !shouldSync(sync, now)) {
      return { synced: false, reason: "recent-attempt" };
    }

    await ctx.runMutation(internal.anime.markSync, { key, status: "running" });

    try {
      const detail = await fetchDetail(args.anilistId);
      if (!detail) {
        throw new Error("Bu yapım AniList kataloğunda bulunamadı.");
      }

      await ctx.runMutation(internal.anime.upsertDetail, {
        detail,
        anilistId: args.anilistId,
      });
      await ctx.runMutation(internal.anime.markSync, { key, status: "ok" });
      return { synced: true };
    } catch (error) {
      await ctx.runMutation(internal.anime.markSync, {
        key,
        status: "error",
        message: errorMessage(error, "Yapım bilgileri yüklenemedi."),
      });
      return { synced: false, reason: "error" };
    }
  },
});

/**
 * Live AniList search, used when the cached catalogue cannot answer a query.
 * Results are cached on the way back, so opening a result works immediately.
 */
export const searchRemote = action({
  args: { q: v.string() },
  handler: async (ctx, args): Promise<AnimeCardView[]> => {
    const term = args.q.trim();
    if (term.length < 2) return [];

    const cards = await fetchSearch(term, 30);
    if (cards.length === 0) return [];

    await ctx.runMutation(internal.anime.upsertCards, { cards });
    return cards.map(cardToView);
  },
});

/** Type-only re-export so the UI can name the shape of a relation rail. */
export type { TitleRefView };
