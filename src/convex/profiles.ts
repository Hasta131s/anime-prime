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
import {
  OWNER_HANDLES,
  canModerate,
  currentUser,
  isAdmin,
  isOwnerEmail,
  requireMember,
} from "./access";
import { fetchCharacter, searchCharacters } from "./anilist";
import { animeRowByAnilistId, cardsByAnilistIds } from "./animeStore";
import {
  CHARACTER_SEARCH_MAX,
  MAX_BIO,
  MAX_DISPLAY_NAME,
  MAX_FAVORITES,
  MAX_TAGLINE,
  PROFILE_SECTION_IDS,
  USERNAME_COOLDOWN_MS,
  WEEKDAY_SHORT,
  handleFromEmail,
  isReservedUsername,
  isSectionHidden,
  normalizeUsername,
  resolveDisplayName,
  usernameCooldownDaysLeft,
  usernameError,
  type ActivityDay,
  type CharacterPick,
  type CommentView,
  type MemberCardView,
  type ProfileActivity,
  type ProfilePreview,
  type ProfileResult,
  type ProfileSectionId,
  type ProfileView,
  type UsernameStatus,
  type WatchEntryView,
} from "./communityView";
import { decorateComments } from "./comments";
import { ensureProfile, findProfileRow } from "./profileStore";

const PROFILE_HISTORY_LIMIT = 24;
const PROFILE_COMMENT_LIMIT = 6;
const MEMBER_SCAN_LIMIT = 300;
/** Sparkline window and the rows scanned to fill it. */
const ACTIVITY_DAYS = 14;
const ACTIVITY_SCAN_LIMIT = 400;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Local midnight for a timestamp — the buckets the sparkline uses. */
function dayStartOf(timestamp: number) {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

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
  staff: boolean,
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

  // The member's own @username wins over the name derived from their e-mail,
  // and it is the single handle the whole site shows.
  if (profile?.username) {
    view.username = profile.username;
    view.handle = profile.username;
  } else {
    const fallback = handleFromEmail(user.email);
    if (fallback) view.handle = fallback;
  }
  if (profile?.usernameChangedAt) {
    view.usernameChangeAt = profile.usernameChangedAt + USERNAME_COOLDOWN_MS;
  }

  if (user.image) view.image = user.image;
  if (user.role) view.role = user.role;
  if (user.banReason) view.banReason = user.banReason;
  if (user.lastSeenAt) view.lastSeenAt = user.lastSeenAt;
  if (profile?.hiddenSections && profile.hiddenSections.length > 0) {
    view.hiddenSections = profile.hiddenSections;
  }
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

  void staff; // reserved for future moderation-specific fields
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
  staff: boolean,
): Promise<ProfileResult> {
  const user = await ctx.db.get(userId);
  if (!user) return EMPTY_RESULT;

  const profile = await findProfileRow(ctx, userId);
  const view = await buildProfileView(ctx, user, profile, viewerId, staff);

  const isOwner = viewerId === userId;
  if (!view.isPublic && !isOwner && !staff) {
    return {
      profile: view,
      stats: { titles: 0, episodes: 0, comments: 0, favorites: 0 },
      favorites: [],
      history: [],
      comments: [],
      restricted: true,
    };
  }

  // A hidden section is never even loaded for a visitor; the owner keeps the
  // full view of their own profile.
  const hide = (id: ProfileSectionId) =>
    !isOwner && isSectionHidden(profile?.hiddenSections, id);

  const favorites = hide("favorites")
    ? []
    : await cardsByAnilistIds(ctx, view.favoriteAnimeIds);
  const history = hide("history")
    ? []
    : await loadHistory(ctx, userId, PROFILE_HISTORY_LIMIT);
  const commentRows = hide("comments")
    ? []
    : await ctx.db
        .query("comments")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .order("desc")
        .take(PROFILE_COMMENT_LIMIT);

  const comments: CommentView[] = await decorateComments(ctx, commentRows, {
    userId: viewerId,
    staff,
  });

  return {
    profile: view,
    stats: hide("stats")
      ? { titles: 0, episodes: 0, comments: 0, favorites: 0 }
      : {
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
      const handle = profile?.username ?? handleFromEmail(user.email);
      if (handle) card.handle = handle;
      if (user.bannedAt) card.bannedAt = user.bannedAt;
      if (user.banReason) card.banReason = user.banReason;
      if (user.lastSeenAt) card.lastSeenAt = user.lastSeenAt;

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
    return await buildResult(ctx, user._id, user._id, canModerate(user));
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
    return await buildResult(ctx, userId, viewer?._id ?? null, canModerate(viewer));
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

/**
 * Activity for one member: the last-seen stamp plus a 14-day sparkline built
 * from real rows — comments written and episodes recorded. Nothing is cached or
 * invented, so a quiet week honestly shows as a flat line.
 */
export const activity = query({
  args: { userId: v.string() },
  handler: async (ctx, args): Promise<ProfileActivity | null> => {
    const targetId = ctx.db.normalizeId("users", args.userId);
    if (!targetId) return null;

    const viewer = await currentUser(ctx);
    const [user, profile] = await Promise.all([
      ctx.db.get(targetId),
      findProfileRow(ctx, targetId),
    ]);
    if (!user) return null;

    // A hidden (or private) section simply is not served to anyone else.
    const owner = viewer?._id === targetId;
    if (!owner && !isAdmin(viewer)) {
      if (!(profile?.isPublic ?? true)) return null;
      if (isSectionHidden(profile?.hiddenSections, "activity")) return null;
    }

    const todayStart = dayStartOf(Date.now());
    const windowStart = todayStart - (ACTIVITY_DAYS - 1) * DAY_MS;

    const [history, comments] = await Promise.all([
      ctx.db
        .query("watchHistory")
        .withIndex("by_user", (q) => q.eq("userId", targetId))
        .order("desc")
        .take(ACTIVITY_SCAN_LIMIT),
      ctx.db
        .query("comments")
        .withIndex("by_user", (q) => q.eq("userId", targetId))
        .order("desc")
        .take(ACTIVITY_SCAN_LIMIT),
    ]);

    const counts = new Array<number>(ACTIVITY_DAYS).fill(0);
    let episodes = 0;
    let commentCount = 0;

    const bucket = (at: number) => {
      if (at < windowStart) return false;
      const index = Math.min(
        ACTIVITY_DAYS - 1,
        Math.floor((at - windowStart) / DAY_MS),
      );
      counts[index] += 1;
      return true;
    };

    for (const row of history) {
      if (bucket(row.watchedAt)) episodes += 1;
      else break;
    }
    for (const row of comments) {
      // A soft-deleted comment stays in the thread but is not activity.
      if (row.deletedAt) continue;
      if (bucket(row.createdAt)) commentCount += 1;
      else break;
    }

    let streak = 0;
    let run = 0;
    for (const count of counts) {
      run = count > 0 ? run + 1 : 0;
      if (run > streak) streak = run;
    }

    const days: ActivityDay[] = counts.map((count, index) => {
      const start = windowStart + index * DAY_MS;
      return { start, label: WEEKDAY_SHORT[new Date(start).getDay()], count };
    });

    return {
      lastSeenAt: user.lastSeenAt ?? null,
      days,
      comments: commentCount,
      episodes,
      streak,
    };
  },
});

/**
 * Everything a hover card needs to introduce a comment author.
 * Respects the member's privacy switches: a private profile shows who they are
 * but never how much they use the site.
 */
export const preview = query({
  args: { userId: v.string() },
  handler: async (ctx, args): Promise<ProfilePreview | null> => {
    const targetId = ctx.db.normalizeId("users", args.userId);
    if (!targetId) return null;

    const [user, profile] = await Promise.all([
      ctx.db.get(targetId),
      findProfileRow(ctx, targetId),
    ]);
    if (!user) return null;

    const viewer = await currentUser(ctx);
    const own = viewer?._id === targetId;
    const isPublic = profile?.isPublic ?? true;
    const visible = isPublic || own || isAdmin(viewer);
    const uploads = await uploadedImages(ctx, profile);

    const card: ProfilePreview = {
      userId: user._id,
      displayName: resolveDisplayName(user, profile),
      banned: Boolean(user.bannedAt),
      isPublic,
      isAnonymous: Boolean(user.isAnonymous),
      joinedAt: user._creationTime,
      comments: 0,
      titles: 0,
      episodes: 0,
      favorites: 0,
    };

    if (profile?.username) card.username = profile.username;
    const handle = profile?.username ?? handleFromEmail(user.email);
    if (handle) card.handle = handle;
    if (user.role) card.role = user.role;
    if (profile?.tagline) card.tagline = profile.tagline;
    if (uploads.avatarUrl) card.image = uploads.avatarUrl;
    else if (profile?.characterImage) card.characterImage = profile.characterImage;
    else if (user.image) card.image = user.image;

    if (visible) {
      if (!isSectionHidden(profile?.hiddenSections, "stats")) {
        card.comments = profile?.commentCount ?? 0;
        card.titles = profile?.watchedTitleCount ?? 0;
        card.episodes = profile?.watchedEpisodeCount ?? 0;
        card.favorites = profile?.favoriteAnimeIds.length ?? 0;
      }
      if (!isSectionHidden(profile?.hiddenSections, "activity")) {
        if (user.lastSeenAt) card.lastSeenAt = user.lastSeenAt;
      }
    }

    return card;
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
    hiddenSections: v.optional(v.array(v.string())),
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
    if (args.hiddenSections !== undefined) {
      // Only known section ids are stored, so the profile never hides a typo
      // and the UI can rely on the list.
      const allowed = new Set<string>(PROFILE_SECTION_IDS);
      patch.hiddenSections = Array.from(
        new Set(args.hiddenSections.filter((id) => allowed.has(id))),
      );
    }

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
// Username
// ---------------------------------------------------------------------------

/** True for the handles reserved for the site owner. */
function isOwnerHandle(value: string) {
  return OWNER_HANDLES.includes(value);
}

/**
 * Claims or renames the member's own @username.
 *
 * Availability is checked against the `by_username` index inside this mutation,
 * so two members can never end up sharing a handle. The first claim is
 * immediate; every rename after that is locked for two weeks.
 */
export const setUsername = mutation({
  args: { username: v.string() },
  handler: async (ctx, args): Promise<string> => {
    const user = await requireMember(ctx);
    const profile = await ensureProfile(ctx, user._id);

    const value = normalizeUsername(args.username);
    if (profile.username === value) return value;

    // Renaming is rate-limited; the very first claim is not.
    if (profile.username && profile.usernameChangedAt) {
      const daysLeft = usernameCooldownDaysLeft(
        profile.usernameChangedAt + USERNAME_COOLDOWN_MS,
      );
      if (daysLeft > 0) {
        throw new Error(
          `Kullanıcı adını 2 haftada bir değiştirebilirsin. ${daysLeft} gün sonra tekrar dene.`,
        );
      }
    }

    const invalid = usernameError(value);
    if (invalid) throw new Error(invalid);
    // Owner handles exist so the site owner always has a name of their own.
    if (isOwnerHandle(value) && !isOwnerEmail(user.email)) {
      throw new Error("Bu kullanıcı adı siteye ayrılmış.");
    }

    const taken = await ctx.db
      .query("profiles")
      .withIndex("by_username", (q) => q.eq("username", value))
      .first();
    if (taken && taken._id !== profile._id) {
      throw new Error("Bu kullanıcı adı başka bir üye tarafından kullanılıyor.");
    }

    await ctx.db.patch(profile._id, {
      username: value,
      usernameChangedAt: Date.now(),
      updatedAt: Date.now(),
    });

    return value;
  },
});

/** Live availability check so the editor can warn before the member saves. */
export const usernameAvailable = query({
  args: { username: v.string() },
  handler: async (ctx, args): Promise<UsernameStatus> => {
    const value = normalizeUsername(args.username);

    const invalid = usernameError(value);
    if (invalid) return isReservedUsername(value) ? "reserved" : "invalid";

    const viewer = await currentUser(ctx);
    if (isOwnerHandle(value) && !isOwnerEmail(viewer?.email)) return "reserved";

    const taken = await ctx.db
      .query("profiles")
      .withIndex("by_username", (q) => q.eq("username", value))
      .first();
    if (!taken) return "ok";
    return viewer && taken.userId === viewer._id ? "current" : "taken";
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
