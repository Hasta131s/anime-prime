/**
 * Turkish presentation helpers for the real AniList vocabulary.
 * Anything without a translation falls back to the raw AniList value so the UI
 * never invents a label that does not match the data.
 */

import type { AnimeCardView } from "@/convex/animeView";

export const FORMAT_LABELS: Record<string, string> = {
  TV: "TV dizisi",
  TV_SHORT: "Kısa dizi",
  MOVIE: "Film",
  SPECIAL: "Özel bölüm",
  OVA: "OVA",
  ONA: "ONA",
  MUSIC: "Müzik videosu",
};

export const STATUS_LABELS: Record<string, string> = {
  FINISHED: "Tamamlandı",
  RELEASING: "Yayında",
  NOT_YET_RELEASED: "Yakında",
  CANCELLED: "İptal edildi",
  HIATUS: "Arada",
};

export const SEASON_LABELS: Record<string, string> = {
  WINTER: "Kış",
  SPRING: "İlkbahar",
  SUMMER: "Yaz",
  FALL: "Sonbahar",
};

export const GENRE_LABELS: Record<string, string> = {
  Action: "Aksiyon",
  Adventure: "Macera",
  Comedy: "Komedi",
  Drama: "Drama",
  Fantasy: "Fantastik",
  Horror: "Korku",
  Mystery: "Gizem",
  Psychological: "Psikolojik",
  Romance: "Romantik",
  "Sci-Fi": "Bilim kurgu",
  "Slice of Life": "Günlük yaşam",
  Sports: "Spor",
  Supernatural: "Doğaüstü",
  Thriller: "Gerilim",
  Music: "Müzik",
  Mecha: "Mecha",
  "Mahou Shoujo": "Sihirli kız",
  Ecchi: "Ecchi",
  Military: "Askeri",
  School: "Okul",
  Space: "Uzay",
  Vampire: "Vampir",
  Samurai: "Samuray",
  Historical: "Tarihî",
  Demons: "Şeytanlar",
  "Martial Arts": "Dövüş sanatları",
  "Super Power": "Süper güç",
  Police: "Polis",
  Game: "Oyun",
  Harem: "Harem",
  Parody: "Parodi",
  Kids: "Çocuk",
  Josei: "Josei",
  Seinen: "Seinen",
  Shoujo: "Shoujo",
  Shounen: "Shounen",
  Isekai: "Isekai",
  "Gender Bender": "Cinsiyet değişimi",
  Dementia: "Deneysel",
  Cars: "Arabalar",
};

export const RELATION_LABELS: Record<string, string> = {
  ADAPTATION: "Uyarlama",
  PREQUEL: "Öncesi",
  SEQUEL: "Devamı",
  PARENT: "Ana yapım",
  SIDE_STORY: "Yan hikâye",
  CHARACTER: "Karakter",
  SUMMARY: "Özet",
  ALTERNATIVE: "Alternatif",
  SPIN_OFF: "Spin-off",
  OTHER: "Diğer",
  SOURCE: "Kaynak",
  COMPILATION: "Derleme",
  CONTAINS: "İçeriyor",
};

export const ROLE_LABELS: Record<string, string> = {
  MAIN: "Ana karakter",
  SUPPORTING: "Yardımcı karakter",
  BACKGROUND: "Figüran",
};

export function genreLabel(genre: string) {
  return GENRE_LABELS[genre] ?? genre;
}

export function roleLabel(role?: string) {
  if (!role) return undefined;
  return ROLE_LABELS[role] ?? role;
}

export function formatLabel(format?: string) {
  if (!format) return undefined;
  return FORMAT_LABELS[format] ?? format;
}

export function statusLabel(status?: string) {
  if (!status) return undefined;
  return STATUS_LABELS[status] ?? status;
}

export function relationLabel(relation?: string) {
  if (!relation) return undefined;
  return RELATION_LABELS[relation] ?? relation;
}

/** AniList scores are 0–100; the UI shows the familiar 10-point scale. */
export function formatScore(score?: number) {
  if (typeof score !== "number" || score <= 0) return undefined;
  return (score / 10).toFixed(1);
}

const compact = new Intl.NumberFormat("tr-TR", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const plain = new Intl.NumberFormat("tr-TR");

export function formatCount(value?: number) {
  if (typeof value !== "number" || value <= 0) return undefined;
  return value >= 10_000 ? compact.format(value) : plain.format(value);
}

const relative = new Intl.RelativeTimeFormat("tr", { numeric: "auto" });

/** "3 gün önce" / "12 dakika sonra" style labels. */
export function formatRelative(target: number, now = Date.now()) {
  const diffSeconds = Math.round((target - now) / 1000);
  const abs = Math.abs(diffSeconds);
  if (abs < 60) return relative.format(diffSeconds, "second");
  if (abs < 3600) return relative.format(Math.round(diffSeconds / 60), "minute");
  if (abs < 86_400) return relative.format(Math.round(diffSeconds / 3600), "hour");
  if (abs < 2_592_000) return relative.format(Math.round(diffSeconds / 86_400), "day");
  if (abs < 31_536_000) return relative.format(Math.round(diffSeconds / 2_592_000), "month");
  return relative.format(Math.round(diffSeconds / 31_536_000), "year");
}

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const shortDateTime = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDateTime(value: number, withTime = true) {
  return withTime ? shortDateTime.format(value) : dateFormatter.format(value);
}

/** "24 dk", "1 sa 50 dk" */
export function formatDuration(minutes?: number) {
  if (!minutes) return undefined;
  if (minutes < 60) return `${minutes} dk`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} sa` : `${hours} sa ${rest} dk`;
}

export function formatEpisodes(count?: number) {
  if (!count) return undefined;
  return `${count} bölüm`;
}

export function releaseWindow(anime: {
  season?: string;
  seasonYear?: number;
  year?: number;
}) {
  const season = anime.season ? SEASON_LABELS[anime.season] : undefined;
  const year = anime.seasonYear ?? anime.year;
  if (season && year) return `${season} ${year}`;
  if (year) return String(year);
  return undefined;
}

/** "2024 · TV dizisi · 12 bölüm" — only the parts AniList actually returned. */
export function metaLine(
  anime: Pick<AnimeCardView, "year" | "seasonYear" | "season" | "format" | "episodes" | "duration">,
) {
  return [
    anime.year ?? anime.seasonYear,
    formatLabel(anime.format),
    formatEpisodes(anime.episodes),
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Long-form synopsis split into readable paragraphs. */
export function synopsisParagraphs(synopsis?: string) {
  if (!synopsis) return [];
  return synopsis
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}
