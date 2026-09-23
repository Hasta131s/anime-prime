/**
 * Shared contract for the community layer (comments, profiles, calendar).
 *
 * Pure module — Convex types are imported with `import type`, so the browser
 * bundle can import the same view shapes, labels and helpers the server uses.
 */

import type { Id } from "./_generated/dataModel";
import type { AnimeCardView } from "./animeView";

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export type CommentSort = "new" | "old" | "popular";

export const COMMENT_SORTS: Array<{ value: CommentSort; label: string; hint: string }> = [
  { value: "new", label: "En yeni", hint: "Son yazılanlar üstte" },
  { value: "old", label: "En eski", hint: "İlk yazılanlar üstte" },
  { value: "popular", label: "En beğenilen", hint: "En çok beğeni alanlar" },
];

export function normalizeCommentSort(value: string | null | undefined): CommentSort {
  return value === "old" || value === "popular" ? value : "new";
}

export const COMMENT_MIN_LENGTH = 2;
export const COMMENT_MAX_LENGTH = 1200;
/** One comment per user per this window — keeps a thread readable. */
export const COMMENT_COOLDOWN_MS = 12_000;
/** Reply depth is one level, matching every popular anime tracker. */
export const COMMENT_REPLY_LIMIT = 200;
export const COMMENTS_PAGE_SIZES = [10, 20, 50] as const;
export const DEFAULT_COMMENTS_PAGE_SIZE = 20;
/** Upper bound scanned when ordering by likes. */
export const COMMENT_POPULAR_SCAN_LIMIT = 400;

export type CommentAuthorView = {
  userId: Id<"users">;
  name: string;
  handle?: string;
  image?: string;
  role?: string;
  isAnonymous: boolean;
  banned: boolean;
};

export type CommentView = {
  id: Id<"comments">;
  anilistId: number;
  body: string;
  spoiler: boolean;
  isReply: boolean;
  rootId?: Id<"comments">;
  replyCount: number;
  likeCount: number;
  likedByMe: boolean;
  mine: boolean;
  canDelete: boolean;
  deleted: boolean;
  deletedByAdmin: boolean;
  createdAt: number;
  editedAt?: number;
  author: CommentAuthorView;
};

export type CommentPage = {
  page: CommentView[];
  isDone: boolean;
  continueCursor: string;
};

export type CommentThread = {
  items: CommentView[];
  total: number;
};

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------

/**
 * A character a member chose to represent them, as AniList reports it.
 * Real data only: the portrait and the title it belongs to both come from the
 * AniList API, never from user input.
 */
export type CharacterPick = {
  id: number;
  name: string;
  image?: string;
  mediaTitle?: string;
  mediaAnilistId?: number;
};

export const CHARACTER_SEARCH_MIN = 2;
export const CHARACTER_SEARCH_MAX = 24;
export const MAX_FAVORITES = 12;
export const MAX_DISPLAY_NAME = 32;
export const MAX_TAGLINE = 90;
export const MAX_BIO = 500;
export const MAX_HISTORY_ROWS = 240;

export type ProfileStats = {
  titles: number;
  episodes: number;
  comments: number;
  favorites: number;
};

export type ProfileView = {
  userId: Id<"users">;
  displayName: string;
  handle?: string;
  image?: string;
  tagline?: string;
  bio?: string;
  location?: string;
  website?: string;
  favoriteGenre?: string;
  favoriteAnimeIds: number[];
  bannerAnilistId?: number;
  /** The character the member picked to represent their profile. */
  characterName?: string;
  characterImage?: string;
  characterMediaTitle?: string;
  characterAnilistId?: number;
  /** AniList id of the anime the character belongs to. */
  characterMediaAnilistId?: number;
  isPublic: boolean;
  role?: string;
  isAnonymous: boolean;
  banned: boolean;
  banReason?: string;
  isMe: boolean;
  customized: boolean;
  joinedAt: number;
  updatedAt: number;
};

export type WatchEntryView = {
  anilistId: number;
  episode: number;
  position: number;
  duration: number;
  completed: boolean;
  watchedAt: number;
  anime: AnimeCardView | null;
};

export type ProfileResult = {
  profile: ProfileView | null;
  stats: ProfileStats;
  favorites: AnimeCardView[];
  history: WatchEntryView[];
  /** Recent comments by this user, newest first. */
  comments: CommentView[];
  restricted: boolean;
};

export type MemberCardView = {
  userId: Id<"users">;
  displayName: string;
  handle?: string;
  image?: string;
  /** Character portrait, preferred over the account avatar in lists. */
  characterImage?: string;
  tagline?: string;
  role?: string;
  isAnonymous: boolean;
  banned: boolean;
  comments: number;
  titles: number;
  episodes: number;
  favorites: number;
  joinedAt: number;
};

/** Best available label for a person, in the order the site uses everywhere. */
export function resolveDisplayName(
  user: { name?: string; email?: string; isAnonymous?: boolean },
  profile?: { displayName?: string } | null,
) {
  const custom = profile?.displayName?.trim();
  if (custom) return custom;

  const name = user.name?.trim();
  if (name) return name;

  const local = user.email?.split("@")[0]?.trim();
  if (local) return local;

  return user.isAnonymous ? "Misafir" : "İsimsiz üye";
}

export function handleFromEmail(email: string | undefined) {
  if (!email) return undefined;
  const local = email.split("@")[0];
  if (!local) return undefined;
  const clean = local.replace(/[^a-z0-9._-]/gi, "").slice(0, 24);
  return clean || undefined;
}

/** "Ada Lovelace" → "AL", "naruto" → "N". Honest fallback for no avatar. */
export function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/** Turkish role wording used on comments and member lists. */
export function communityRoleLabel(role?: string) {
  if (role === "admin") return "Yönetici";
  if (role === "member") return "Üye";
  return undefined;
}

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------

export const WEEKDAY_LABELS = [
  "Pazar",
  "Pazartesi",
  "Salı",
  "Çarşamba",
  "Perşembe",
  "Cuma",
  "Cumartesi",
];

export const WEEKDAY_SHORT = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];

export type CalendarSlotView = {
  anilistId: number;
  episode: number;
  airingAt: number;
  anime: AnimeCardView | null;
};

export type CalendarDay = {
  /** Local midnight of the day, as an epoch ms value. */
  start: number;
  weekday: number;
  isToday: boolean;
  isPast: boolean;
  slots: CalendarSlotView[];
};

export type CalendarResult = {
  slots: CalendarSlotView[];
  from: number;
  to: number;
  status: "ready" | "syncing" | "error";
  message?: string;
  syncedAt?: number;
  needsSync: boolean;
};

export const CALENDAR_DAYS = 7;
export const CALENDAR_TTL_MS = 60 * 60 * 1000;

/** Local midnight of the day a timestamp falls on. */
export function dayStartOf(value: number) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function addDays(value: number, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date.getTime();
}

export function isSameDay(a: number, b: number) {
  return dayStartOf(a) === dayStartOf(b);
}

/**
 * Buckets real airing times into local calendar days.
 * Slots outside the requested window are dropped, so the page never shows a
 * broadcast under the wrong day.
 */
export function buildCalendarDays(
  slots: CalendarSlotView[],
  options: { start: number; days: number; now: number },
): CalendarDay[] {
  const start = dayStartOf(options.start);
  const today = dayStartOf(options.now);
  const days: CalendarDay[] = [];

  for (let index = 0; index < options.days; index += 1) {
    const dayStart = addDays(start, index);
    days.push({
      start: dayStart,
      weekday: new Date(dayStart).getDay(),
      isToday: dayStart === today,
      isPast: dayStart < today,
      slots: [],
    });
  }

  const index = new Map(days.map((day) => [day.start, day]));
  for (const slot of slots) {
    const bucket = index.get(dayStartOf(slot.airingAt));
    if (bucket) bucket.slots.push(slot);
  }

  for (const day of days) {
    day.slots.sort((a, b) => a.airingAt - b.airingAt || a.episode - b.episode);
  }

  return days;
}

const slotTimeFormat = new Intl.DateTimeFormat("tr-TR", {
  hour: "2-digit",
  minute: "2-digit",
});

const slotDateFormat = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
});

/** "21:30" in the visitor's own timezone. */
export function formatSlotTime(value: number) {
  return slotTimeFormat.format(new Date(value));
}

export function formatSlotDate(value: number) {
  return slotDateFormat.format(new Date(value));
}

/** "3 gün 4 saat" until the next episode — plain and readable. */
export function formatCountdown(target: number, now: number) {
  const diff = target - now;
  if (diff <= 0) return "yayında";
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} gün ${hours % 24} saat`;
  if (hours > 0) return `${hours} saat ${minutes % 60} dk`;
  if (minutes > 0) return `${minutes} dk`;
  return "1 dakikadan az";
}
