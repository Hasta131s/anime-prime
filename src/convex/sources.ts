/**
 * Playback sources (HLS / MP4) supplied by the site owner.
 *
 * The app never scrapes or extracts streams from third-party sites. Sources are
 * added through the admin panel (or the Convex dashboard) and are restricted to
 * signed-in accounts holding the `admin` role, so the public site can never be
 * turned into a link board.
 *
 * Bootstrapping: until one admin exists, a signed-in account with a verified
 * e-mail address can claim ownership once via `claimAdmin`.
 */

import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { inferKind, type PlaybackSourceView, type SourceKind } from "./sourceView";

const MAX_SOURCES_PER_TITLE = 120;

function toView(row: Doc<"playbackSources">): PlaybackSourceView {
  const view: PlaybackSourceView = {
    id: row._id,
    anilistId: row.anilistId,
    episode: row.episode,
    label: row.label,
    url: row.url,
    kind: row.kind as SourceKind,
    createdAt: row.createdAt,
  };
  if (row.language) view.language = row.language;
  if (row.note) view.note = row.note;
  return view;
}

/** Validates and normalises a user-supplied media URL. */
function normalizeUrl(raw: string) {
  const trimmed = raw.trim();
  if (trimmed.length === 0) throw new Error("Bağlantı boş olamaz.");

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("Geçerli bir bağlantı gir (https://…).");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Yalnızca http veya https bağlantıları eklenebilir.");
  }

  return parsed.toString();
}

async function requireAdmin(ctx: MutationCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new Error("Kaynak yönetimi için giriş yapmalısın.");
  }
  const user = await ctx.db.get(userId);
  if (!user || user.role !== "admin") {
    throw new Error("Bu işlem yalnızca yönetici hesaplara açıktır.");
  }
  return userId;
}

async function findAdmin(ctx: QueryCtx | MutationCtx) {
  return await ctx.db
    .query("users")
    .filter((q) => q.eq(q.field("role"), "admin"))
    .first();
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Public read: every source configured for one title, episode order first. */
export const list = query({
  args: { anilistId: v.number() },
  handler: async (ctx, args): Promise<PlaybackSourceView[]> => {
    if (!Number.isInteger(args.anilistId) || args.anilistId <= 0) return [];

    const rows = await ctx.db
      .query("playbackSources")
      .withIndex("by_anilistId", (q) => q.eq("anilistId", args.anilistId))
      .take(MAX_SOURCES_PER_TITLE);

    return rows
      .sort((a, b) => a.episode - b.episode || a.createdAt - b.createdAt)
      .map(toView);
  },
});

/** Drives the admin panel: who may edit, and whether setup is still open. */
export const manageState = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return { signedIn: false, canManage: false, adminExists: false };
    }

    const user = await ctx.db.get(userId);
    const adminExists = (await findAdmin(ctx)) !== null;

    return {
      signedIn: true,
      canManage: user?.role === "admin",
      adminExists,
      // Only a real (non-anonymous, verified) account may take ownership.
      canClaim:
        !adminExists &&
        Boolean(user) &&
        !user?.isAnonymous &&
        Boolean(user?.emailVerificationTime),
      email: user?.email ?? undefined,
    };
  },
});

// ---------------------------------------------------------------------------
// Mutations (admin only)
// ---------------------------------------------------------------------------

export const add = mutation({
  args: {
    anilistId: v.number(),
    episode: v.number(),
    label: v.string(),
    url: v.string(),
    language: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"playbackSources">> => {
    const userId = await requireAdmin(ctx);

    if (!Number.isInteger(args.anilistId) || args.anilistId <= 0) {
      throw new Error("Geçersiz yapım kimliği.");
    }

    const episode = Math.max(0, Math.floor(args.episode));
    const url = normalizeUrl(args.url);
    const label = args.label.trim() || `Bölüm ${episode}`;

    const existing = await ctx.db
      .query("playbackSources")
      .withIndex("by_anilistId_episode", (q) =>
        q.eq("anilistId", args.anilistId).eq("episode", episode),
      )
      .take(MAX_SOURCES_PER_TITLE);

    if (existing.length >= 8) {
      throw new Error("Bir bölüm için en fazla 8 kaynak eklenebilir.");
    }

    return await ctx.db.insert("playbackSources", {
      anilistId: args.anilistId,
      episode,
      label,
      url,
      kind: inferKind(url),
      language: args.language?.trim() || undefined,
      note: args.note?.trim() || undefined,
      addedBy: userId,
      createdAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("playbackSources") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.id);
  },
});

/** One-time ownership claim, available while no admin exists yet. */
export const claimAdmin = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Devralmak için önce giriş yapmalısın.");
    }

    if ((await findAdmin(ctx)) !== null) {
      throw new Error("Bu kurulum zaten tamamlanmış.");
    }

    const user = await ctx.db.get(userId);
    if (!user || user.isAnonymous) {
      throw new Error("Misafir hesaplar yönetici olamaz. E-posta ile giriş yap.");
    }
    if (!user.emailVerificationTime) {
      throw new Error("Yönetici olmak için e-posta adresini doğrulamalısın.");
    }

    await ctx.db.patch(userId, { role: "admin" });
    return { ok: true };
  },
});
