/**
 * Watch progress.
 *
 * One row per (user, title, episode). Recording is idempotent so the player can
 * write a position as often as it likes without creating duplicates, and the
 * profile counters (`watchedTitleCount`, `watchedEpisodeCount`) are recomputed
 * from the stored history so they always match what the history lists show.
 *
 * Guests (anonymous accounts) may record progress too — that is the only
 * signed-in action that does not require a verified e-mail.
 */

import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { currentUser, requireUser } from "./access";
import { cardsByAnilistIds } from "./animeStore";
import {
  MAX_HISTORY_ROWS,
  type WatchEntryView,
} from "./communityView";
import { ensureProfile, findProfileRow } from "./profileStore";

/** Upper bound on rows scanned when recomputing the profile counters. */
const COUNTER_SCAN_LIMIT = 600;

function toEntry(
  row: Doc<"watchHistory">,
  anime: WatchEntryView["anime"],
): WatchEntryView {
  return {
    anilistId: row.anilistId,
    episode: row.episode,
    position: row.position,
    duration: row.duration,
    completed: row.completed,
    watchedAt: row.watchedAt,
    anime,
  };
}

/** De-duplicated history rows, newest first, joined with the cached artwork. */
async function decorate(
  ctx: QueryCtx,
  rows: Doc<"watchHistory">[],
): Promise<WatchEntryView[]> {
  const cards = await cardsByAnilistIds(
    ctx,
    rows.map((row) => row.anilistId),
  );
  const byId = new Map(cards.map((card) => [card.anilistId, card]));
  return rows.map((row) => toEntry(row, byId.get(row.anilistId) ?? null));
}

/** Recomputes the profile counters from the stored history. */
export async function refreshWatchCounters(
  ctx: MutationCtx,
  userId: Id<"users">,
) {
  const rows = await ctx.db
    .query("watchHistory")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .take(COUNTER_SCAN_LIMIT);

  const titles = new Set<number>();
  for (const row of rows) titles.add(row.anilistId);

  const profile = await ensureProfile(ctx, userId);
  await ctx.db.patch(profile._id, {
    watchedEpisodeCount: rows.length,
    watchedTitleCount: titles.size,
    updatedAt: Date.now(),
  });
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** The signed-in account's latest episodes across every title. */
export const recent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args): Promise<WatchEntryView[]> => {
    const user = await currentUser(ctx);
    if (!user) return [];

    const limit = Math.min(Math.max(args.limit ?? 20, 1), MAX_HISTORY_ROWS);
    const rows = await ctx.db
      .query("watchHistory")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(limit);

    return await decorate(ctx, rows);
  },
});

/** One entry per title: the most recently watched episode of each. */
export const continueWatching = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args): Promise<WatchEntryView[]> => {
    const user = await currentUser(ctx);
    if (!user) return [];

    const limit = Math.min(Math.max(args.limit ?? 12, 1), 60);
    const rows = await ctx.db
      .query("watchHistory")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(COUNTER_SCAN_LIMIT);

    const seen = new Set<number>();
    const latest: Doc<"watchHistory">[] = [];
    for (const row of rows) {
      if (seen.has(row.anilistId)) continue;
      seen.add(row.anilistId);
      latest.push(row);
      if (latest.length >= limit) break;
    }

    return await decorate(ctx, latest);
  },
});

/** Position of one episode for the signed-in account (resume across devices). */
export const forEpisode = query({
  args: { anilistId: v.number(), episode: v.number() },
  handler: async (ctx, args) => {
    const user = await currentUser(ctx);
    if (!user) return null;

    const row = await ctx.db
      .query("watchHistory")
      .withIndex("by_user_anilistId_episode", (q) =>
        q
          .eq("userId", user._id)
          .eq("anilistId", args.anilistId)
          .eq("episode", args.episode),
      )
      .first();

    if (!row) return null;
    return {
      position: row.position,
      duration: row.duration,
      completed: row.completed,
      watchedAt: row.watchedAt,
    };
  },
});

/** Small summary for the account hub. */
export const summary = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    if (!user) return null;

    const [profile, rows] = await Promise.all([
      findProfileRow(ctx, user._id),
      ctx.db
        .query("watchHistory")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .take(COUNTER_SCAN_LIMIT),
    ]);

    return {
      titles:
        profile?.watchedTitleCount ??
        new Set(rows.map((row) => row.anilistId)).size,
      episodes: profile?.watchedEpisodeCount ?? rows.length,
      comments: profile?.commentCount ?? 0,
      favorites: profile?.favoriteAnimeIds.length ?? 0,
    };
  },
});

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Records a playback position. Called continuously by the player, so it stays
 * cheap and never duplicates a row.
 */
export const record = mutation({
  args: {
    anilistId: v.number(),
    episode: v.number(),
    position: v.number(),
    duration: v.number(),
    completed: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    if (!Number.isInteger(args.anilistId) || args.anilistId <= 0) return;
    if (!Number.isFinite(args.position) || !Number.isFinite(args.duration)) return;

    const episode = Math.max(0, Math.floor(args.episode));
    const position = Math.max(0, Math.round(args.position));
    const duration = Math.max(0, Math.round(args.duration));
    const now = Date.now();

    const existing = await ctx.db
      .query("watchHistory")
      .withIndex("by_user_anilistId_episode", (q) =>
        q
          .eq("userId", user._id)
          .eq("anilistId", args.anilistId)
          .eq("episode", episode),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        position,
        duration,
        completed: Boolean(args.completed),
        watchedAt: now,
      });
    } else {
      await ctx.db.insert("watchHistory", {
        userId: user._id,
        anilistId: args.anilistId,
        episode,
        position,
        duration,
        completed: Boolean(args.completed),
        watchedAt: now,
      });
    }

    await refreshWatchCounters(ctx, user._id);
  },
});

/** Removes one episode from the history (profile "kaldır" action). */
export const forget = mutation({
  args: { anilistId: v.number(), episode: v.number() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const row = await ctx.db
      .query("watchHistory")
      .withIndex("by_user_anilistId_episode", (q) =>
        q
          .eq("userId", user._id)
          .eq("anilistId", args.anilistId)
          .eq("episode", args.episode),
      )
      .first();
    if (!row) return;
    await ctx.db.delete(row._id);
    await refreshWatchCounters(ctx, user._id);
  },
});

/** Clears the whole history for the signed-in account. */
export const clear = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const rows = await ctx.db
      .query("watchHistory")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(MAX_HISTORY_ROWS);
    for (const row of rows) await ctx.db.delete(row._id);
    await refreshWatchCounters(ctx, user._id);
  },
});
