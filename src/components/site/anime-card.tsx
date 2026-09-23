import type { AnimeCardView } from "@/convex/animeView";
import {
  formatDuration,
  formatEpisodes,
  formatLabel,
  formatScore,
  metaLine,
} from "@/lib/anime-labels";
import { cn } from "@/lib/utils";
import { Star } from "lucide-react";
import { Link } from "react-router";
import { Poster } from "./poster";

/**
 * Poster card. Everything shown here — artwork, score, format, episode count —
 * comes straight from AniList.
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
      <div className="relative overflow-hidden rounded-xl ring-1 ring-white/8 transition duration-300 group-hover:ring-2 group-hover:ring-brand/70 group-focus-visible:ring-2 group-focus-visible:ring-ring">
        <Poster anime={anime} priority={priority} />

        {score ? (
          <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
            <Star className="size-3 text-amber-300" aria-hidden="true" />
            {score}
          </span>
        ) : null}

        {anime.status === "RELEASING" ? (
          <span className="absolute top-2 left-2 inline-flex items-center gap-1.5 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase backdrop-blur-sm">
            <span className="size-1.5 rounded-full bg-brand-cyan" aria-hidden="true" />
            Yayında
          </span>
        ) : null}

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 flex h-24 items-end bg-linear-to-t from-black/90 via-black/45 to-transparent p-2.5 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          <span className="text-[11px] leading-tight font-medium text-white/90">
            {hoverMeta}
          </span>
        </div>
      </div>

      <div className="mt-2.5 space-y-1">
        <h3 className="font-display line-clamp-2 text-[13px] leading-snug font-bold text-foreground transition-colors duration-200 group-hover:text-brand-bright sm:text-sm">
          {anime.title}
        </h3>
        {meta ? (
          <p className="line-clamp-1 text-xs text-muted-foreground">{meta}</p>
        ) : null}
      </div>
    </Link>
  );
}

/** Compact horizontal row used inside search suggestions. */
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
        "flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-white/5",
        className,
      )}
    >
      <div className="w-10 shrink-0">
        <Poster anime={anime} className="rounded-md" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 text-sm font-medium text-foreground">
          {anime.title}
        </p>
        <p className="line-clamp-1 text-xs text-muted-foreground">{meta}</p>
      </div>
      {score ? (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-200">
          <Star className="size-3" aria-hidden="true" />
          {score}
        </span>
      ) : null}
    </Link>
  );
}
