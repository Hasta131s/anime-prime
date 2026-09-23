/**
 * Public profiles.
 *
 * A profile is built from the auth user row (name, avatar, role) plus the
 * optional `profiles` row (customisation + counters), so an account that never
 * opened the editor still gets a coherent page.
 *
 * Reads are public. Writes require a real, non-anonymous, non-banned account.
 */

import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { currentUser, isAdmin, requireMember } from "./access";
import { animeRowByAnilistId, cardsByAnilistIds } from "./animeStore";
import {
  MAX_BIO,
  MAX_DISPLAY_NAME,
  MAX_FAVORITES,
  MAX_TAGLINE,
  accentFor,
  handleFromEmail,
  resolveDisplayName,
  type CommentView,
  type MemberCardView,
  type ProfileResult,
  type ProfileView,
  type WatchEntryView,
} from "./communityView";
import { decorateComments } from "./comments";
import { ensureProfile, findProfileRow } from "./profileStore";

const PROFILE_HISTORY_LIMIT = 24;
const PROFILE_COMMENT_LIMIT = 6;
const MEMBER_SCAN_LIMIT = 300;

function clean(value: string | undefined, max: number) {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return ""; // explicit clear
  return trimmed.slice(0, max);
}

/** Only http(s) links survive, so a profile can never inject a bad scheme. */
function cleanWebsite(value: string | undefined) {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return "";
  try {
    const parsed = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    return parsed.toString().slice(0, 200);
  } catch {
    return "";
  }
}

function isCustomized(profile: Doc<"profiles"> | null) {
  if (!profile) return false;
  return Boolean(
    profile.displayName ||
      profile.tagline ||
      profile.bio ||
      profile.location ||
      profile.website ||
      profile.favoriteGenre ||
      profile.favoriteAnimeIds.length > 0,
  );
}

function buildProfileView(
  user: Doc<"users">,
  profile: Doc<"profiles"> | null,
  viewerId: Id<"users"> | null,
  admin: boolean,
): ProfileView {
  const displayName = resolveDisplayName(user, profile);
  const view: ProfileView = {
    userId: user._id,
    displayName,
    accent: profile?.accent ?? accentFor(`${user._id}:${displayName}`),
    favoriteAnimeIds: profile?.favoriteAnimeIds ?? [],
    isPublic: profile?.isPublic ?? true,
    isAnonymous: Boolean(user.isAnonymous),
    banned: Boolean(user.bannedAt),
    isMe: viewerId === user._id,
    customized: isCustomized(profile),
    joinedAt: user._creationTime,
    updatedAt: profile?.updatedAt ?? user._creationTime,
  };

  const handle = handleFromEmail(user.email);
  if (handle) view.handle = handle;
  if (user.image) view.image = user.image;
  if (user.role) view.role = user.role;
  if (user.banReason) view.banReason = user.banReason;
  if (profile?.tagline) view.tagline = profile.tagline;
  if (profile?.bio) view.bio = profile.bio;
  if (profile?.location) view.location = profile.location;
  if (profile?.website) view.website = profile.website;
  if (profile?.favoriteGenre) view.favoriteGenre = profile.favoriteGenre;

  const banner = profile?.bannerAnilistId ?? profile?.favoriteAnimeIds[0];
  if (banner) view.bannerAnilistId = banner;

  void admin; // reserved for future moderation-specific fields
  return view;
}

async function loadHistory(
  ctx: QueryCtx,
  userId: Id<"users">,
  limit: number,
): Promise<WatchEntryView[]> {
  const rows = await ctx.db
    .query("watchHistory")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .order("desc")
    .take(limit);

  const cards = await cardsByAnilistIds(
    ctx,
    rows.map((row) => row.anilistId),
  );
  const byId = new Map(cards.map((card) => [card.anilistId, card]));

  return rows.map((row) => ({
    anilistId: row.anilistId,
    episode: row.episode,
    position: row.position,
    duration: row.duration,
    completed: row.completed,
    watchedAt: row.watchedAt,
    anime: byId.get(row.anilistId) ?? null,
  }));
}

const EMPTY_RESULT: ProfileResult = {
  profile: null,
  stats: { titles: 0, episodes: 0, comments: 0, favorites: 0 },
  favorites: [],
  history: [],
  comments: [],
  restricted: false,
};

async function buildResult(
  ctx: QueryCtx,
  userId: Id<"users">,
  viewerId: Id<"users"> | null,
  admin: boolean,
): Promise<ProfileResult> {
  const user = await ctx.db.get(userId);
  if (!user) return EMPTY_RESULT;

  const profile = await findProfileRow(ctx, userId);
  const view = buildProfileView(user, profile, viewerId, admin);

  const isOwner = viewerId === userId;
  if (!view.isPublic && !isOwner && !admin) {
    return {
      profile: view,
      stats: { titles: 0, episodes: 0, comments: 0, favorites: 0 },
      favorites: [],
      history: [],
      comments: [],
      restricted: true,
    };
  }

  const [favorites, history, commentRows] = await Promise.all([
    cardsByAnilistIds(ctx, view.favoriteAnimeIds),
    loadHistory(ctx, userId, PROFILE_HISTORY_LIMIT),
    ctx.db
      .query("comments")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(PROFILE_COMMENT_LIMIT),
  ]);

  const comments: CommentView[] = await decorateComments(ctx, commentRows, {
    userId: viewerId,
    admin,
  });

  return {
    profile: view,
    stats: {
      titles: profile?.watchedTitleCount ?? 0,
      episodes: profile?.watchedEpisodeCount ?? 0,
      comments: profile?.commentCount ?? 0,
      favorites: view.favoriteAnimeIds.length,
    },
    favorites,
    history,
    comments,
    restricted: false,
  };
}

/** Shared member-card builder (used here and by the admin panel). */
export async function memberCardsFor(
  ctx: QueryCtx,
  users: Doc<"users">[],
): Promise<MemberCardView[]> {
  const cards = await Promise.all(
    users.map(async (user): Promise<MemberCardView> => {
      const profile = await findProfileRow(ctx, user._id);
      const displayName = resolveDisplayName(user, profile);
      const card: MemberCardView = {
        userId: user._id,
        displayName,
        accent: profile?.accent ?? accentFor(`${user._id}:${displayName}`),
        isAnonymous: Boolean(user.isAnonymous),
        banned: Boolean(user.bannedAt),
        comments: profile?.commentCount ?? 0,
        titles: profile?.watchedTitleCount ?? 0,
        episodes: profile?.watchedEpisodeCount ?? 0,
        favorites: profile?.favoriteAnimeIds.length ?? 0,
        joinedAt: user._creationTime,
      };
      const handle = handleFromEmail(user.email);
      if (handle) card.handle = handle;
      if (user.image) card.image = user.image;
      if (user.role) card.role = user.role;
      if (profile?.tagline) card.tagline = profile.tagline;
      return card;
    }),
  );
  return cards;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** The signed-in account's own profile (used by the editor and account hub). */
export const me = query({
  args: {},
  handler: async (ctx): Promise<ProfileResult> => {
    const user = await currentUser(ctx);
    if (!user) return EMPTY_RESULT;
    return await buildResult(ctx, user._id, user._id, isAdmin(user));
  },
});

/** Any account's public profile. */
export const detail = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<ProfileResult> => {
    const viewer = await currentUser(ctx);
    return await buildResult(ctx, args.userId, viewer?._id ?? null, isAdmin(viewer));
  },
});

/** Directory of members who chose a public profile. */
export const members = query({
  args: { q: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, args): Promise<MemberCardView[]> => {
    const limit = Math.min(Math.max(args.limit ?? 24, 1), 60);
    const term = args.q?.trim().toLowerCase() ?? "";

    const users = await ctx.db.query("users").take(MEMBER_SCAN_LIMIT);
    const visible = users.filter((user) => !user.isAnonymous);
    const cards = await memberCardsFor(ctx, visible);

    const filtered = term
      ? cards.filter(
          (card) =>
            card.displayName.toLowerCase().includes(term) ||
            (card.handle ?? "").toLowerCase().includes(term),
        )
      : cards;

    return filtered
      .sort(
        (a, b) =>
          b.comments + b.episodes - (a.comments + a.episodes) ||
          b.joinedAt - a.joinedAt,
      )
      .slice(0, limit);
  },
});

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export const update = mutation({
  args: {
    displayName: v.optional(v.string()),
    tagline: v.optional(v.string()),
    bio: v.optional(v.string()),
    location: v.optional(v.string()),
    website: v.optional(v.string()),
    accent: v.optional(v.string()),
    favoriteGenre: v.optional(v.string()),
    isPublic: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireMember(ctx);
    const profile = await ensureProfile(ctx, user._id);

    const patch: Partial<Doc<"profiles">> = { updatedAt: Date.now() };

    if (args.displayName !== undefined) {
      const value = clean(args.displayName, MAX_DISPLAY_NAME);
      patch.displayName = value ? value : undefined;
    }
    if (args.tagline !== undefined) {
      const value = clean(args.tagline, MAX_TAGLINE);
      patch.tagline = value ? value : undefined;
    }
    if (args.bio !== undefined) {
      const value = clean(args.bio, MAX_BIO);
      patch.bio = value ? value : undefined;
    }
    if (args.location !== undefined) {
      const value = clean(args.location, 40);
      patch.location = value ? value : undefined;
    }
    if (args.website !== undefined) {
      const value = cleanWebsite(args.website);
      patch.website = value ? value : undefined;
    }
    if (args.accent !== undefined) {
      const value = args.accent.trim();
      patch.accent = /^#[0-9a-f]{6}$/i.test(value)
        ? value
        : accentFor(String(user._id));
    }
    if (args.favoriteGenre !== undefined) {
      const value = clean(args.favoriteGenre, 30);
      patch.favoriteGenre = value ? value : undefined;
    }
    if (args.isPublic !== undefined) patch.isPublic = args.isPublic;

    await ctx.db.patch(profile._id, patch);
  },
});

/** Adds or removes one title from the profile's favourites. */
export const toggleFavorite = mutation({
  args: { anilistId: v.number() },
  handler: async (ctx, args): Promise<{ favorite: boolean; count: number }> => {
    const user = await requireMember(ctx);
    if (!Number.isInteger(args.anilistId) || args.anilistId <= 0) {
      throw new Error("Geçersiz yapım kimliği.");
    }

    const anime = await animeRowByAnilistId(ctx, args.anilistId);
    if (!anime) throw new Error("Bu yapım kataloğta bulunamadı.");

    const profile = await ensureProfile(ctx, user._id);
    const favorites = [...profile.favoriteAnimeIds];

    const index = favorites.indexOf(args.anilistId);
    let favorite: boolean;
    if (index >= 0) {
      favorites.splice(index, 1);
      favorite = false;
    } else {
      if (favorites.length >= MAX_FAVORITES) {
        throw new Error(`En fazla ${MAX_FAVORITES} favori ekleyebilirsin.`);
      }
      favorites.push(args.anilistId);
      favorite = true;
    }

    const patch: Partial<Doc<"profiles">> = {
      favoriteAnimeIds: favorites,
      updatedAt: Date.now(),
    };
    if (favorite && !profile.bannerAnilistId) patch.bannerAnilistId = args.anilistId;

    await ctx.db.patch(profile._id, patch);
    return { favorite, count: favorites.length };
  },
});

/** Chooses which favourite supplies the profile banner. */
export const setBanner = mutation({
  args: { anilistId: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const user = await requireMember(ctx);
    const profile = await ensureProfile(ctx, user._id);

    if (args.anilistId === undefined) {
      await ctx.db.patch(profile._id, {
        bannerAnilistId: undefined,
        updatedAt: Date.now(),
      });
      return;
    }

    if (!profile.favoriteAnimeIds.includes(args.anilistId)) {
      throw new Error("Banner yalnızca favorilerinden seçilebilir.");
    }
    await ctx.db.patch(profile._id, {
      bannerAnilistId: args.anilistId,
      updatedAt: Date.now(),
    });
  },
});
