/**
 * Airing calendar.
 *
 * Every slot is a real broadcast entry mirrored from AniList's `airingSchedules`
 * — nothing is generated. The page reads a seven-day window from the local cache
 * and, when it is missing or stale, asks for the guarded sync action exactly the
 * way the catalogue rails do.
 */

import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { action, internalMutation, query } from "./_generated/server";
import { fetchAiring } from "./anilist";
import { cardsByAnilistIds } from "./animeStore";
import {
  CALENDAR_DAYS,
  CALENDAR_TTL_MS,
  addDays,
  dayStartOf,
  type CalendarResult,
  type CalendarSlotView,
} from "./communityView";

const SYNC_KEY = "calendar";
const RUNNING_WINDOW_MS = 120_000;
const SLOT_LIMIT = 600;

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * Seven days of real broadcasts, starting at `start` (defaults to today's local
 * midnight). Reported as `syncing` while the cache is empty so the page shows a
 * live state instead of a blank week.
 */
export const week = query({
  args: { start: v.optional(v.number()) },
  handler: async (ctx, args): Promise<CalendarResult> => {
    const now = Date.now();
    const from = dayStartOf(args.start ?? now);
    const to = addDays(from, CALENDAR_DAYS);

    const sync = await ctx.db
      .query("syncs")
      .withIndex("by_key", (q) => q.eq("key", SYNC_KEY))
      .first();

    const rows = await ctx.db
      .query("airingSchedule")
      .withIndex("by_airingAt", (q) => q.gte("airingAt", from).lt("airingAt", to))
      .take(SLOT_LIMIT);

    const cards = await cardsByAnilistIds(
      ctx,
      rows.map((row) => row.anilistId),
    );
    const byId = new Map(cards.map((card) => [card.anilistId, card]));

    const slots: CalendarSlotView[] = rows
      .map((row: Doc<"airingSchedule">) => ({
        anilistId: row.anilistId,
        episode: row.episode,
        airingAt: row.airingAt,
        anime: byId.get(row.anilistId) ?? null,
      }))
      .sort((a, b) => a.airingAt - b.airingAt || a.episode - b.episode);

    const syncedAt = sync?.status === "ok" ? sync.attemptedAt : undefined;
    const fresh = syncedAt !== undefined && now - syncedAt < CALENDAR_TTL_MS;
    const backoffReady =
      !sync ||
      sync.status !== "running" ||
      now - sync.attemptedAt > RUNNING_WINDOW_MS;
    const needsSync = !fresh && backoffReady;

    if (fresh && slots.length > 0) {
      return { slots, from, to, status: "ready", syncedAt, needsSync: false };
    }

    if (sync?.status === "error" && slots.length === 0) {
      return {
        slots: [],
        from,
        to,
        status: "error",
        message: sync.message ?? "Yayın takvimi şu anda yüklenemedi.",
        needsSync,
      };
    }

    return { slots, from, to, status: "syncing", syncedAt, needsSync };
  },
});

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/** Replaces the stored slots inside one window with a fresh set. */
export const writeSlots = internalMutation({
  args: {
    from: v.number(),
    to: v.number(),
    slots: v.any(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("airingSchedule")
      .withIndex("by_airingAt", (q) =>
        q.gte("airingAt", args.from).lt("airingAt", args.to),
      )
      .take(SLOT_LIMIT);
    for (const row of existing) await ctx.db.delete(row._id);

    const slots = args.slots as Array<{
      anilistId: number;
      episode: number;
      airingAt: number;
    }>;

    for (const slot of slots) {
      await ctx.db.insert("airingSchedule", {
        anilistId: slot.anilistId,
        episode: slot.episode,
        airingAt: slot.airingAt,
      });
    }
  },
});

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

/** Refreshes the next seven days from AniList, with the usual backoff guard. */
export const syncCalendar = action({
  args: { start: v.optional(v.number()) },
  handler: async (ctx, args): Promise<{ synced: boolean; reason?: string }> => {
    const now = Date.now();
    const from = dayStartOf(args.start ?? now);
    const to = addDays(from, CALENDAR_DAYS);

    const sync = await ctx.runQuery(internal.anime.getSync, { key: SYNC_KEY });
    if (sync) {
      const running = sync.status === "running" && now - sync.attemptedAt < RUNNING_WINDOW_MS;
      const cooling = sync.status !== "running" && now - sync.attemptedAt < 15_000;
      if (running || cooling) return { synced: false, reason: "recent-attempt" };
    }

    await ctx.runMutation(internal.anime.markSync, {
      key: SYNC_KEY,
      status: "running",
    });

    try {
      const airing = await fetchAiring(from, to, 3);

      const cards = airing.map((slot) => slot.media);
      if (cards.length > 0) {
        await ctx.runMutation(internal.anime.upsertCards, { cards });
      }

      await ctx.runMutation(internal.calendar.writeSlots, {
        from,
        to,
        slots: airing.map((slot) => ({
          anilistId: slot.media.anilistId,
          episode: slot.episode,
          airingAt: slot.airingAt,
        })),
      });

      await ctx.runMutation(internal.anime.markSync, {
        key: SYNC_KEY,
        status: "ok",
      });
      return { synced: true };
    } catch (error) {
      await ctx.runMutation(internal.anime.markSync, {
        key: SYNC_KEY,
        status: "error",
        message: errorMessage(error, "Yayın takvimi yüklenemedi."),
      });
      return { synced: false, reason: "error" };
    }
  },
});
