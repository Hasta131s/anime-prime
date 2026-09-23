/**
 * Shared access to the `profiles` table.
 *
 * A profile row holds the public customisation (display name, bio, accent,
 * favourites, banner) plus the counters a profile page shows. It is created
 * lazily the first time an account does something worth counting, so an account
 * that never customises anything still renders correctly.
 */

import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { accentFor } from "./communityView";

export type ReadCtx = QueryCtx | MutationCtx;

export async function findProfileRow(
  ctx: ReadCtx,
  userId: Id<"users">,
): Promise<Doc<"profiles"> | null> {
  return await ctx.db
    .query("profiles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .first();
}

/** Returns the account's profile row, creating it with defaults if missing. */
export async function ensureProfile(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<Doc<"profiles">> {
  const existing = await findProfileRow(ctx, userId);
  if (existing) return existing;

  const now = Date.now();
  const id = await ctx.db.insert("profiles", {
    userId,
    favoriteAnimeIds: [],
    isPublic: true,
    accent: accentFor(String(userId)),
    commentCount: 0,
    watchedTitleCount: 0,
    watchedEpisodeCount: 0,
    createdAt: now,
    updatedAt: now,
  });

  const created = await ctx.db.get(id);
  if (!created) throw new Error("Profil oluşturulamadı.");
  return created;
}
