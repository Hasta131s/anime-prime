/**
 * Shared access helpers.
 *
 * Every community feature (comments, profiles, progress) goes through these so
 * the rules live in one place: you need a real e-mail account to post, an
 * account that has not been suspended may post, and only admins reach the
 * moderation surface.
 */

import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

export type ReadCtx = QueryCtx | MutationCtx;

export async function currentUser(ctx: ReadCtx): Promise<Doc<"users"> | null> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return null;
  return await ctx.db.get(userId);
}

export function isAdmin(user: Doc<"users"> | null) {
  return user?.role === "admin";
}

/** A real, non-anonymous account — the bar for anything that gets moderated. */
export function isMember(user: Doc<"users"> | null) {
  return Boolean(user) && !user?.isAnonymous;
}

export function assertNotBanned(user: Doc<"users">) {
  if (user.bannedAt) {
    throw new Error(
      user.banReason
        ? `Hesabın askıya alındı: ${user.banReason}`
        : "Hesabın yönetici tarafından askıya alındı.",
    );
  }
}

/** Signed-in account (guests included) — used for watch progress. */
export async function requireUser(ctx: MutationCtx): Promise<Doc<"users">> {
  const user = await currentUser(ctx);
  if (!user) throw new Error("Bu işlem için giriş yapmalısın.");
  assertNotBanned(user);
  return user;
}

/** Signed-in, non-anonymous account — used for comments and profile edits. */
export async function requireMember(ctx: MutationCtx): Promise<Doc<"users">> {
  const user = await currentUser(ctx);
  if (!user) throw new Error("Bu işlem için giriş yapmalısın.");
  if (user.isAnonymous) {
    throw new Error(
      "Yorum yapmak ve profilini özelleştirmek için e-posta ile giriş yapmalısın.",
    );
  }
  assertNotBanned(user);
  return user;
}

export async function requireAdmin(ctx: MutationCtx): Promise<Doc<"users">> {
  const user = await currentUser(ctx);
  if (!user) throw new Error("Bu alan yalnızca yöneticilere açıktır.");
  if (user.role !== "admin") throw new Error("Bu alan yalnızca yöneticilere açıktır.");
  assertNotBanned(user);
  return user;
}

export async function findAdmin(ctx: ReadCtx): Promise<Id<"users"> | null> {
  const admin = await ctx.db
    .query("users")
    .filter((q) => q.eq(q.field("role"), "admin"))
    .first();
  return admin?._id ?? null;
}

/** Email reduced to something safe to show in a moderation list. */
export function maskEmail(email: string | undefined) {
  if (!email) return undefined;
  const [local, domain] = email.split("@");
  if (!local || !domain) return undefined;
  const head = local.slice(0, Math.min(2, local.length));
  return `${head}${"•".repeat(Math.max(local.length - 2, 2))}@${domain}`;
}
