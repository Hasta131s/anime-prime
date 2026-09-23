import type { AnimeCardView, SyncStatus } from "@/convex/animeView";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useRef } from "react";
import { Link } from "react-router";
import { AnimeCard } from "./anime-card";
import { ErrorCard, RailSkeleton } from "./states";

/**
 * Horizontal rail, streaming-service style: cards snap as you swipe on touch
 * and arrow buttons scroll on pointer devices.
 */
export function AnimeRail({
  title,
  blurb,
  items,
  href,
  status,
  message,
  onRetry,
  priorityCount = 2,
}: {
  title: string;
  blurb?: string;
  items: AnimeCardView[];
  href?: string;
  status: SyncStatus;
  message?: string;
  onRetry?: () => void;
  priorityCount?: number;
}) {
  const railRef = useRef<HTMLDivElement>(null);

  const scrollBy = useCallback((direction: 1 | -1) => {
    const node = railRef.current;
    if (!node) return;
    node.scrollBy({
      left: direction * Math.max(node.clientWidth * 0.8, 240),
      behavior: "smooth",
    });
  }, []);

  if (status === "error" && items.length === 0) {
    return (
      <section className="space-y-4">
        <RailHeading title={title} blurb={blurb} href={href} />
        <ErrorCard title={`${title} yüklenemedi`} message={message} onRetry={onRetry} />
      </section>
    );
  }

  const loading = items.length === 0;

  return (
    <section className="space-y-4">
      <RailHeading
        title={title}
        blurb={blurb}
        href={href}
        onScroll={scrollBy}
        showControls={!loading}
      />

      {loading ? (
        <RailSkeleton />
      ) : (
        <div
          ref={railRef}
          className="rail-scroll no-scrollbar -mx-4 gap-3 px-4 pb-2 sm:gap-4 lg:-mx-6 lg:px-6"
        >
          {items.map((anime, index) => (
            <div
              key={anime.anilistId}
              className="w-[140px] shrink-0 snap-start sm:w-[160px] md:w-[176px]"
            >
              <AnimeCard anime={anime} priority={index < priorityCount} />
            </div>
          ))}
          {href ? (
            <div className="flex w-[120px] shrink-0 snap-start items-center justify-center self-stretch sm:w-[140px]">
              <Link
                to={href}
                className="text-center text-sm font-semibold text-brand-bright transition-colors hover:text-foreground"
              >
                Tümünü gör
              </Link>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

function RailHeading({
  title,
  blurb,
  href,
  onScroll,
  showControls = false,
}: {
  title: string;
  blurb?: string;
  href?: string;
  onScroll?: (direction: 1 | -1) => void;
  showControls?: boolean;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h2 className="font-display text-lg font-extrabold sm:text-xl">{title}</h2>
        {blurb ? (
          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground sm:text-sm">
            {blurb}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {href && !showControls ? (
          <Link
            to={href}
            className="text-xs font-semibold text-brand-bright hover:underline sm:text-sm"
          >
            Tümünü gör
          </Link>
        ) : null}
        {showControls && onScroll ? (
          <div className="hidden items-center gap-1.5 md:flex">
            <button
              type="button"
              onClick={() => onScroll(-1)}
              aria-label="Sola kaydır"
              className="flex size-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => onScroll(1)}
              aria-label="Sağa kaydır"
              className="flex size-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
