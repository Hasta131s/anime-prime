import { formatRelative } from "@/lib/anime-labels";
import { cn } from "@/lib/utils";
import { CalendarClock } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * AniList publishes the next airing episode and its timestamp, so the countdown
 * is real data — it just needs to re-render as time passes.
 */
export function useMinuteTick() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), 60_000);
    return () => clearInterval(timer);
  }, []);
}

export function NextEpisodeLabel({
  episode,
  airingAt,
  className,
}: {
  episode?: number;
  airingAt?: number;
  className?: string;
}) {
  useMinuteTick();

  if (!episode || !airingAt) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium text-brand-cyan",
        className,
      )}
    >
      <CalendarClock className="size-3.5" aria-hidden="true" />
      Bölüm {episode} · {formatRelative(airingAt)}
    </span>
  );
}
