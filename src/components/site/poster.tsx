import { cn } from "@/lib/utils";
import { useState } from "react";

type PosterSource = {
  title: string;
  cover?: string;
  coverColor?: string;
};

/**
 * Real AniList artwork only.
 *
 * Nothing is substituted when a cover is missing — instead of a stand-in image
 * we render the title over the dominant colour AniList reports for that title,
 * so a card is never filled with invented artwork.
 */
export function Poster({
  anime,
  className,
  priority = false,
}: {
  anime: PosterSource;
  className?: string;
  priority?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(anime.cover) && !failed;

  return (
    <div
      className={cn(
        "relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-surface-2",
        className,
      )}
      style={
        anime.coverColor
          ? { backgroundColor: `${anime.coverColor}1f` }
          : undefined
      }
    >
      {showImage ? (
        <img
          src={anime.cover}
          alt={`${anime.title} posteri`}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={cn(
            "size-full object-cover transition-opacity duration-500",
            loaded ? "opacity-100" : "opacity-0",
          )}
        />
      ) : null}

      {!loaded && showImage ? (
        <div className="absolute inset-0 animate-pulse bg-white/[0.04]" />
      ) : null}

      {!showImage ? <PosterFallback anime={anime} /> : null}
    </div>
  );
}

function PosterFallback({ anime }: { anime: PosterSource }) {
  const tint = anime.coverColor ?? "#0063e5";

  return (
    <div
      className="flex size-full flex-col justify-between gap-3 p-3"
      style={{
        backgroundImage: `linear-gradient(155deg, ${tint}59 0%, oklch(0.16 0.03 265) 62%, oklch(0.13 0.02 265) 100%)`,
      }}
    >
      <span className="text-[9px] font-semibold tracking-[0.18em] text-white/45 uppercase">
        Afiş yok
      </span>
      <span className="font-display text-sm leading-tight font-bold text-white/90">
        {anime.title}
      </span>
    </div>
  );
}
