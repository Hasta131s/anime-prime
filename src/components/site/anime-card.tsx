import type { AnimeCardView } from "@/convex/animeView";
import {
  formatDuration,
  formatEpisodes,
  formatLabel,
  formatScore,
  metaLine,
  scoreColorClass,
} from "@/lib/anime-labels";
import { cn } from "@/lib/utils";
import { Link } from "react-router";
import { Poster } from "./poster";

/**
 * AniList-style grid card: sharp corners, hairline border, cover-first, white
 * title that turns blue on hover, and real data underneath.
 */
export function AnimeCard({
  anime,
  className,
  priority = false,
}: {
  anime: AnimeCardView;
  className?: string;
  priority?: boolean;
}) {
  const score = formatScore(anime.score);
  const meta = metaLine(anime);
  const hoverMeta = [
    formatLabel(anime.format),
    formatEpisodes(anime.episodes),
    formatDuration(anime.duration),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link
      to={`/anime/${anime.anilistId}`}
      className={cn("group block outline-none", className)}
      aria-label={`${anime.title} detay sayfası`}
    >
      <div className="relative overflow-hidden rounded-[3px] border border-border bg-card transition-colors duration-150 group-hover:border-primary/70 group-focus-visible:border-primary">
        <Poster anime={anime} priority={priority} />

        {score ? (
          <span
            className={cn(
              "absolute top-1 right-1 inline-flex items-center gap-1 rounded-[3px] bg-[#0b1622]/88 px-1.5 py-0.5 text-[11px] font-semibold backdrop-blur-[2px]",
              scoreColorClass(anime.score),
            )}
          >
            <span aria-hidden="true">★</span>
            {score}
          </span>
        ) : null}

        {anime.status === "RELEASING" ? (
          <span className="absolute bottom-1 left-1 inline-flex items-center gap-1 rounded-[3px] bg-[#0b1622]/88 px-1.5 py-0.5 text-[10px] font-medium text-brand-live backdrop-blur-[2px]">
            <span className="size-1.5 rounded-full bg-brand-live" aria-hidden="true" />
            Yayında
          </span>
        ) : null}

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 flex h-16 items-end bg-linear-to-t from-[#0b1622] via-[#0b1622]/60 to-transparent p-1.5 text-[10px] font-medium text-white/85 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          {hoverMeta}
        </div>
      </div>

      <h3 className="mt-1.5 line-clamp-2 text-[13px] leading-snug font-medium text-foreground transition-colors duration-150 group-hover:text-primary">
        {anime.title}
      </h3>
      {meta ? (
        <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">{meta}</p>
      ) : null}
    </Link>
  );
}

/** Compact list row (AniList "list view" style). */
export function AnimeRow({
  anime,
  onClick,
  className,
}: {
  anime: AnimeCardView;
  onClick?: () => void;
  className?: string;
}) {
  const meta = metaLine(anime);
  const score = formatScore(anime.score);

  return (
    <Link
      to={`/anime/${anime.anilistId}`}
      onClick={onClick}
      className={cn(
        "group flex items-center gap-3 rounded-[3px] px-2 py-2 transition-colors hover:bg-accent",
        className,
      )}
    >
      <div className="w-10 shrink-0">
        <Poster anime={anime} className="rounded-[2px]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 text-[13px] font-medium text-foreground group-hover:text-primary">
          {anime.title}
        </p>
        <p className="line-clamp-1 text-[11px] text-muted-foreground">{meta}</p>
      </div>
      {score ? (
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold",
            scoreColorClass(anime.score),
          )}
        >
          <span aria-hidden="true">★</span>
          {score}
        </span>
      ) : null}
    </Link>
  );
}
