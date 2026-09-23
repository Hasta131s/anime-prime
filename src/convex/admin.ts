/**
 * Moderation surface.
 *
 * Every function here is gated on the `admin` role at the Convex level — the UI
 * hiding itself is never the actual protection. Admins can suspend and restore
 * accounts, promote or demote members, review the newest comments across the
 * whole site and see the totals that matter.
 */

import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { currentUser, isAdmin, requireAdmin } from "./access";
import type { CommentView, MemberCardView } from "./communityView";
import { decorateComments } from "./comments";
import { memberCardsFor } from "./profiles";
import { refreshWatchCounters } from "./progress";

const USER_SCAN_LIMIT = 500;
const COMMENT_SCAN_LIMIT = 800;
const SOURCE_SCAN_LIMIT = 800;
const RECENT_COMMENT_LIMIT = 40;

/** Numbers shown on the admin dashboard. */
export const overview = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    if (!isAdmin(user)) return null;

    const [users, comments, sources, airing] = await Promise.all([
      ctx.db.query("users").take(USER_SCAN_LIMIT),
      ctx.db.query("comments").take(COMMENT_SCAN_LIMIT),
      ctx.db.query("playbackSources").take(SOURCE_SCAN_LIMIT),
      ctx.db.query("airingSchedule").take(40),
    ]);

    const live = comments.filter((row) => !row.deletedAt);
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

    return {
      members: users.filter((row) => !row.isAnonymous).length,
      guests: users.filter((row) => row.isAnonymous).length,
      admins: users.filter((row) => row.role === "admin").length,
      banned: users.filter((row) => Boolean(row.bannedAt)).length,
      comments: live.length,
      commentsThisWeek: live.filter((row) => row.createdAt >= weekAgo).length,
      replies: live.filter((row) => row.isReply).length,
      sources: sources.length,
      titlesWithSources: new Set(sources.map((row) => row.anilistId)).size,
      calendarSlots: airing.length,
    };
  },
});

/** Every account, including guests and suspended members. */
export const members = query({
  args: { q: v.optional(v.string()) },
  handler: async (ctx, args): Promise<MemberCardView[]> => {
    const user = await currentUser(ctx);
    if (!isAdmin(user)) return [];

    const users = await ctx.db.query("users").take(USER_SCAN_LIMIT);
    const cards = await memberCardsFor(ctx, users);

    const term = args.q?.trim().toLowerCase() ?? "";
    const filtered = term
      ? cards.filter(
          (card) =>
            card.displayName.toLowerCase().includes(term) ||
            (card.handle ?? "").toLowerCase().includes(term),
        )
      : cards;

    return filtered.sort((a, b) => b.joinedAt - a.joinedAt);
  },
});

/** Newest comments across every title, for the moderation queue. */
export const recentComments = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<Array<{ comment: CommentView; animeTitle?: string }>> => {
    const user = await currentUser(ctx);
    if (!user || !isAdmin(user)) return [];

    const rows = await ctx.db
      .query("comments")
      .withIndex("by_createdAt")
      .order("desc")
      .take(RECENT_COMMENT_LIMIT);

    const [comments, animeRows] = await Promise.all([
      decorateComments(ctx, rows, { userId: user._id, admin: true }),
      Promise.all(
        Array.from(new Set(rows.map((row) => row.anilistId))).map((anilistId) =>
          ctx.db
            .query("anime")
            .withIndex("by_anilistId", (q) => q.eq("anilistId", anilistId))
            .first(),
        ),
      ),
    ]);

    const titles = new Map<number, string>();
    for (const row of animeRows) {
      if (row) titles.set(row.anilistId, row.title);
    }

    return comments.map((comment) => {
      const title = titles.get(comment.anilistId);
      return title ? { comment, animeTitle: title } : { comment };
    });
  },
});

// ---------------------------------------------------------------------------
// Actions on accounts
// ---------------------------------------------------------------------------

/** Suspends an account. A banned member keeps read access only. */
export const ban = mutation({
  args: { userId: v.id("users"), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    if (args.userId === admin._id) {
      throw new Error("Kendi hesabını askıya alamazsın.");
    }

    const target: Doc<"users"> | null = await ctx.db.get(args.userId);
    if (!target) throw new Error("Hesap bulunamadı.");
    if (target.role === "admin") {
      throw new Error("Önce yöneticilik yetkisini kaldır.");
    }

    await ctx.db.patch(args.userId, {
      bannedAt: Date.now(),
      banReason: args.reason?.trim().slice(0, 200) || undefined,
      bannedBy: admin._id,
    });
  },
});

/** Restores a suspended account. */
export const unban = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.userId, {
      bannedAt: undefined,
      banReason: undefined,
      bannedBy: undefined,
    });
  },
});

/** Promotes or demotes a member. */
export const setRole = mutation({
  args: { userId: v.id("users"), role: v.union(v.literal("admin"), v.literal("member")) },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    if (args.userId === admin._id) {
      throw new Error("Kendi yetkini değiştiremezsin.");
    }

    await ctx.db.patch(args.userId, { role: args.role });
  },
});

/** Recomputes a member's watch counters (repair after manual data edits). */
export const refreshMemberStats = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await refreshWatchCounters(ctx, args.userId);
  },
});
