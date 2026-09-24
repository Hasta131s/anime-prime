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
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  action,
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { currentUser, isAdmin, requireMember } from "./access";
import { fetchCharacter, searchCharacters } from "./anilist";
import { animeRowByAnilistId, cardsByAnilistIds } from "./animeStore";
import {
  CHARACTER_SEARCH_MAX,
  MAX_BIO,
  MAX_DISPLAY_NAME,
  MAX_FAVORITES,
  MAX_TAGLINE,
  handleFromEmail,
  resolveDisplayName,
  type CharacterPick,
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

/**
 * Turns the stored upload ids into public URLs.
 *
 * Files live in Convex file storage, so the profile only ever keeps the id —
 * the URL is resolved on every read and expires with the file itself.
 */
async function uploadedImages(
  ctx: QueryCtx,
  profile: Doc<"profiles"> | null,
): Promise<{ avatarUrl?: string; bannerUrl?: string }> {
  const result: { avatarUrl?: string; bannerUrl?: string } = {};

  if (profile?.avatarStorageId) {
    const url = await ctx.storage.getUrl(profile.avatarStorageId);
    if (url) result.avatarUrl = url;
  }
  if (profile?.bannerStorageId) {
    const url = await ctx.storage.getUrl(profile.bannerStorageId);
    if (url) result.bannerUrl = url;
  }

  return result;
}

async function buildProfileView(
  ctx: QueryCtx,
  user: Doc<"users">,
  profile: Doc<"profiles"> | null,
  viewerId: Id<"users"> | null,
  admin: boolean,
): Promise<ProfileView> {
  const displayName = resolveDisplayName(user, profile);
  const view: ProfileView = {
    userId: user._id,
    displayName,
    favoriteAnimeIds: profile?.favoriteAnimeIds ?? [],
    isPublic: profile?.isPublic ?? true,
    isAnonymous: Boolean(user.isAnonymous),
    banned: Boolean(user.bannedAt),
    isMe: viewerId === user._id,
    customized: isCustomized(profile),
    joinedAt: user._creationTime,
    updatedAt: profile?.updatedAt ?? user._creationTime,
  };

  if (profile?.characterName) view.characterName = profile.characterName;
  if (profile?.characterImage) view.characterImage = profile.characterImage;
  if (profile?.characterMediaTitle) {
    view.characterMediaTitle = profile.characterMediaTitle;
  }
  if (profile?.characterAnilistId) {
    view.characterAnilistId = profile.characterAnilistId;
  }
  if (profile?.characterMediaAnilistId) {
    view.characterMediaAnilistId = profile.characterMediaAnilistId;
  }

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

  const uploads = await uploadedImages(ctx, profile);
  if (uploads.avatarUrl) view.avatarUrl = uploads.avatarUrl;
  if (uploads.bannerUrl) view.bannerUrl = uploads.bannerUrl;

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
  const view = await buildProfileView(ctx, user, profile, viewerId, admin);

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

      // An uploaded photo beats both the account avatar and the character
      // portrait, so the face a member picked is the one shown in lists.
      const uploadedAvatar = profile?.avatarStorageId
        ? await ctx.storage.getUrl(profile.avatarStorageId)
        : null;
      if (uploadedAvatar) card.image = uploadedAvatar;
      else if (user.image) card.image = user.image;
      if (!uploadedAvatar && profile?.characterImage) {
        card.characterImage = profile.characterImage;
      }
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

/**
 * Any account's public profile.
 *
 * The id arrives as a string from the URL, so it is normalised here — a
 * malformed link returns an empty result instead of throwing in the client.
 */
export const detail = query({
  args: { userId: v.string() },
  handler: async (ctx, args): Promise<ProfileResult> => {
    const viewer = await currentUser(ctx);
    const userId = ctx.db.normalizeId("users", args.userId);
    if (!userId) return EMPTY_RESULT;
    return await buildResult(ctx, userId, viewer?._id ?? null, isAdmin(viewer));
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

// ---------------------------------------------------------------------------
// Gallery uploads
// ---------------------------------------------------------------------------

/**
 * A short-lived URL the client posts an image to.
 *
 * The file goes straight to Convex file storage; only the resulting id ever
 * passes through the profile mutation, so no public URL is trusted from the
 * client.
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx): Promise<string> => {
    await requireMember(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

async function storeImage(
  ctx: MutationCtx,
  field: "avatarStorageId" | "bannerStorageId",
  storageId: Id<"_storage"> | null,
) {
  const user = await requireMember(ctx);
  const profile = await ensureProfile(ctx, user._id);
  const previous = profile[field];

  await ctx.db.patch(profile._id, {
    [field]: storageId ?? undefined,
    updatedAt: Date.now(),
  });

  if (previous && previous !== storageId) {
    await ctx.storage.delete(previous);
  }
}

/** Sets or clears the member's own profile photo (square framing in the UI). */
export const setAvatar = mutation({
  args: { storageId: v.union(v.id("_storage"), v.null()) },
  handler: async (ctx, args) => {
    await storeImage(ctx, "avatarStorageId", args.storageId);
  },
});

/** Sets or clears the member's own banner image. */
export const setCoverImage = mutation({
  args: { storageId: v.union(v.id("_storage"), v.null()) },
  handler: async (ctx, args) => {
    await storeImage(ctx, "bannerStorageId", args.storageId);
  },
});

// ---------------------------------------------------------------------------
// Profile character
// ---------------------------------------------------------------------------

/**
 * Character search for the profile picker.
 * A public read: it only proxies AniList's own character search.
 */
export const characterSearch = action({
  args: { q: v.string() },
  handler: async (_ctx, args): Promise<CharacterPick[]> => {
    const results = await searchCharacters(args.q, CHARACTER_SEARCH_MAX);
    return results.map((pick) => ({ ...pick }));
  },
});

/**
 * Saves the character a member chose to represent them.
 *
 * The client only sends the AniList character id; the name, portrait and the
 * title it belongs to are fetched server-side, so a profile can never point at
 * an arbitrary image URL.
 */
export const setCharacter = action({
  args: { characterId: v.number() },
  handler: async (ctx, args) => {
    const character = await fetchCharacter(args.characterId);
    if (!character) {
      throw new Error("Bu karakter AniList kataloğunda bulunamadı.");
    }

    await ctx.runMutation(internal.profiles.saveCharacter, {
      characterId: character.id,
      name: character.name,
      image: character.image,
      mediaTitle: character.mediaTitle,
      mediaAnilistId: character.mediaAnilistId,
    });
  },
});

/** Writes a server-fetched character onto the profile. Not callable directly. */
export const saveCharacter = internalMutation({
  args: {
    characterId: v.number(),
    name: v.string(),
    image: v.optional(v.string()),
    mediaTitle: v.optional(v.string()),
    mediaAnilistId: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireMember(ctx);
    const profile = await ensureProfile(ctx, user._id);
    await ctx.db.patch(profile._id, {
      characterAnilistId: args.characterId,
      characterName: args.name,
      characterImage: args.image,
      characterMediaTitle: args.mediaTitle,
      characterMediaAnilistId: args.mediaAnilistId,
      updatedAt: Date.now(),
    });
  },
});

/** Removes the chosen character; the account avatar or initials take over. */
export const clearCharacter = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireMember(ctx);
    const profile = await ensureProfile(ctx, user._id);
    await ctx.db.patch(profile._id, {
      characterAnilistId: undefined,
      characterName: undefined,
      characterImage: undefined,
      characterMediaTitle: undefined,
      characterMediaAnilistId: undefined,
      updatedAt: Date.now(),
    });
  },
});
