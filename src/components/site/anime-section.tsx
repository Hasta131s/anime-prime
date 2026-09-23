import type { AnimeCardView, SyncStatus } from "@/convex/animeView";
import { cn } from "@/lib/utils";
import { Link } from "react-router";
import { AnimeCard } from "./anime-card";
import { CardGridSkeleton, ErrorCard } from "./states";

const GRID_CLASS =
  "grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6";

/** AniList section header: title left, blue "View more" right. */
export function SectionHeader({
  title,
  blurb,
  href,
  className,
}: {
  title: string;
  blurb?: string;
  href?: string;
  className?: string;
}) {
  return (
    <div className={cn("mb-3 flex items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        <h2 className="text-[17px] leading-tight font-semibold text-foreground">
          {title}
        </h2>
        {blurb ? (
          <p className="mt-0.5 text-[12px] text-muted-foreground">{blurb}</p>
        ) : null}
      </div>
      {href ? (
        <Link
          to={href}
          className="shrink-0 text-[12px] font-medium text-primary hover:underline"
        >
          Tümünü gör
        </Link>
      ) : null}
    </div>
  );
}

/** Vertical card grid used everywhere AniList would show a list of titles. */
export function AnimeGrid({
  items,
  limit,
  className,
  priorityCount = 6,
}: {
  items: AnimeCardView[];
  limit?: number;
  className?: string;
  priorityCount?: number;
}) {
  const shown = limit ? items.slice(0, limit) : items;

  return (
    <div className={cn(GRID_CLASS, className)}>
      {shown.map((anime, index) => (
        <AnimeCard
          key={anime.anilistId}
          anime={anime}
          priority={index < priorityCount}
        />
      ))}
    </div>
  );
}

/**
 * Feed-backed section: header, grid, and honest loading / error states.
 */
export function AnimeSection({
  title,
  blurb,
  items,
  href,
  status,
  message,
  onRetry,
  limit = 12,
}: {
  title: string;
  blurb?: string;
  items: AnimeCardView[];
  href?: string;
  status: SyncStatus;
  message?: string;
  onRetry?: () => void;
  limit?: number;
}) {
  const loading = items.length === 0 && status !== "error";

  return (
    <section>
      <SectionHeader title={title} blurb={blurb} href={href} />

      {status === "error" && items.length === 0 ? (
        <ErrorCard title={`${title} yüklenemedi`} message={message} onRetry={onRetry} />
      ) : loading ? (
        <CardGridSkeleton count={6} />
      ) : (
        <AnimeGrid items={items} limit={limit} priorityCount={0} />
      )}
    </section>
  );
}
