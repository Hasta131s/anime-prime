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

// --- usernames -------------------------------------------------------------

/** Every member owns one unique @username, chosen by themselves. */
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
/** A member may rename themselves once every two weeks. */
export const USERNAME_COOLDOWN_DAYS = 14;
export const USERNAME_COOLDOWN_MS = USERNAME_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

export type UsernameStatus = "ok" | "current" | "invalid" | "taken" | "reserved";

/** Names that would impersonate the site itself or mislead other members. */
const RESERVED_USERNAMES = new Set([
  "admin",
  "yonetici",
  "moderator",
  "mod",
  "destek",
  "sistem",
  "root",
  "animeprime",
  "official",
  "staff",
  "kurucu",
  "owner",
  "api",
  "support",
  "profil",
  "ayarlar",
  "giris",
  "login",
  "yardim",
  "help",
  "ben",
  "me",
]);

/**
 * Usernames are stored lowercase with any leading "@" stripped, so two members
 * can never claim names that differ only in case or decoration.
 */
export function normalizeUsername(raw: string): string {
  return raw.trim().replace(/^@+/, "").toLowerCase();
}

export function isReservedUsername(value: string) {
  return RESERVED_USERNAMES.has(value);
}

/** Turkish validation message, or null when the name may be claimed. */
export function usernameError(value: string): string | null {
  if (value.length < USERNAME_MIN || value.length > USERNAME_MAX) {
    return `Kullanıcı adı ${USERNAME_MIN}-${USERNAME_MAX} karakter olmalı.`;
  }
  if (!/^[a-z0-9_]+$/.test(value)) {
    return "Yalnızca harf, rakam ve alt çizgi (_) kullanabilirsin.";
  }
  if (/^[0-9]+$/.test(value)) {
    return "Kullanıcı adı en az bir harf içermeli.";
  }
  if (isReservedUsername(value)) {
    return "Bu kullanıcı adı siteye ayrılmış.";
  }
  return null;
}

/** Whole days left before a member may rename themselves again. */
export function usernameCooldownDaysLeft(nextChangeAt: number, now = Date.now()) {
  return Math.max(0, Math.ceil((nextChangeAt - now) / (24 * 60 * 60 * 1000)));
}

export type ProfileStats = {
  titles: number;
  episodes: number;
  comments: number;
  favorites: number;
};

// --- roles -----------------------------------------------------------------

/** Roles an admin can hand out. The values match the `users.role` validator. */
export type CommunityRole =
  | "admin"
  | "moderator"
  | "editor"
  | "member"
  | "newcomer";

export const ROLE_OPTIONS: Array<{
  value: CommunityRole;
  label: string;
  hint: string;
}> = [
  { value: "admin", label: "Yönetici", hint: "Panelin tamamı: rol, ban ve tema" },
  { value: "moderator", label: "Moderatör", hint: "Yorumları denetler ve kaldırır" },
  { value: "editor", label: "Editör", hint: "İçerik ve kaynak katkısı" },
  { value: "member", label: "Üye", hint: "Standart üye yetkisi" },
  { value: "newcomer", label: "En yeni üye", hint: "Yeni katılanları karşılayan rozet" },
];

// --- profile sections -------------------------------------------------------

/** Sections a member can hide from their public profile. */
export const PROFILE_SECTIONS = [
  { id: "stats", label: "İstatistik şeridi", hint: "İzlenen anime/bölüm, favori ve yorum sayıları" },
  { id: "activity", label: "Aktiflik grafiği", hint: "Son 14 günün aktivitesi ve son görülme" },
  { id: "favorites", label: "Favori animeler", hint: "Seçtiğin favori yapımlar" },
  { id: "history", label: "İzleme geçmişi", hint: "Son izlediğin bölümler" },
  { id: "comments", label: "Yorumlar", hint: "Son yorumların" },
] as const;

export type ProfileSectionId = (typeof PROFILE_SECTIONS)[number]["id"];

export const PROFILE_SECTION_IDS = PROFILE_SECTIONS.map((section) => section.id);

export function isSectionHidden(
  hidden: string[] | undefined,
  id: ProfileSectionId,
) {
  return (hidden ?? []).includes(id);
}

/** Turns a member's stored selection into labels for the profile summary. */
export function hiddenSectionLabels(hidden: string[] | undefined) {
  const set = new Set(hidden ?? []);
  return PROFILE_SECTIONS.filter((section) => set.has(section.id)).map(
    (section) => section.label,
  );
}

// --- site themes ------------------------------------------------------------

/**
 * Colour palettes the admin can switch between. Ids match the `[data-theme]`
 * blocks in `index.css`; the first entry is the palette the site ships with.
 */
export type SitePalette = {
  id: string;
  label: string;
  hint: string;
  /** Three colours used to preview the palette in the admin panel. */
  swatch: [string, string, string];
};

export const DEFAULT_PALETTE = "midnight";

export const SITE_PALETTES: SitePalette[] = [
  {
    id: DEFAULT_PALETTE,
    label: "Gece Mavisi (hazır)",
    hint: "Sitenin varsayılan koyu teması",
    swatch: ["#0b1622", "#151f2e", "#3db4f2"],
  },
  { id: "sakura", label: "Sakura", hint: "Pembe vurgulu koyu tema", swatch: ["#190f16", "#241822", "#ef6ea3"] },
  { id: "emerald", label: "Zümrüt", hint: "Yeşil vurgulu koyu tema", swatch: ["#081711", "#12251b", "#37d67a"] },
  { id: "amber", label: "Kehribar", hint: "Turuncu vurgulu sıcak tema", swatch: ["#191206", "#241b0d", "#f2a03d"] },
  { id: "violet", label: "Menekşe", hint: "Mor vurgulu koyu tema", swatch: ["#110e20", "#1b1631", "#a17bf7"] },
  { id: "crimson", label: "Kızıl", hint: "Kırmızı vurgulu sinema teması", swatch: ["#170b0e", "#231115", "#f2566d"] },
  { id: "frost", label: "Buz (açık)", hint: "Açık zemin, mavi vurgu", swatch: ["#eef2f8", "#ffffff", "#2f7fd6"] },
];

export function paletteById(id: string | null | undefined): SitePalette {
  return SITE_PALETTES.find((palette) => palette.id === id) ?? SITE_PALETTES[0];
}

export type ProfileView = {
  userId: Id<"users">;
  displayName: string;
  /** The member's own unique @username, when they have claimed one. */
  username?: string;
  /** Earliest moment the username may change again. */
  usernameChangeAt?: number;
  handle?: string;
  image?: string;
  /** Profile photo the member uploaded from their gallery. */
  avatarUrl?: string;
  /** Banner the member uploaded from their gallery. */
  bannerUrl?: string;
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
  /** Sections the member hid from their public profile. */
  hiddenSections?: string[];
  /** Last time the account was seen on the site. */
  lastSeenAt?: number;
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
  banReason?: string;
  bannedAt?: number;
  /** Who issued the suspension, by display name. Only filled in the ban list. */
  bannedByName?: string;
  comments: number;
  titles: number;
  episodes: number;
  favorites: number;
  joinedAt: number;
  lastSeenAt?: number;
};

/** Compact card shown when a reader hovers a comment author. */
export type ProfilePreview = {
  userId: Id<"users">;
  displayName: string;
  username?: string;
  handle?: string;
  image?: string;
  characterImage?: string;
  tagline?: string;
  role?: string;
  banned: boolean;
  isPublic: boolean;
  isAnonymous: boolean;
  joinedAt: number;
  lastSeenAt?: number;
  comments: number;
  titles: number;
  episodes: number;
  favorites: number;
};

/** One day of the profile activity sparkline. */
export type ActivityDay = {
  /** Local midnight of the day, as epoch ms. */
  start: number;
  /** Short weekday label, e.g. "Pzt". */
  label: string;
  /** Comments written + episodes recorded that day. */
  count: number;
};

export type ProfileActivity = {
  lastSeenAt: number | null;
  days: ActivityDay[];
  comments: number;
  episodes: number;
  /** Longest run of consecutive days with activity inside the window. */
  streak: number;
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

/** Turkish role wording used on comments, profiles and member lists. */
export function communityRoleLabel(role?: string) {
  return ROLE_OPTIONS.find((option) => option.value === role)?.label;
}

/** Badge colours per role, so a badge reads the same everywhere. */
export function communityRoleTone(role?: string) {
  if (role === "admin") return "bg-destructive/15 text-destructive";
  if (role === "moderator") return "bg-primary/15 text-primary";
  if (role === "editor") return "bg-primary/10 text-brand-bright";
  if (role === "newcomer") return "bg-accent text-foreground";
  return "bg-secondary text-muted-foreground";
}

/** Roles that may act on other people's content. */
export function isModeratingRole(role?: string) {
  return role === "admin" || role === "moderator";
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
