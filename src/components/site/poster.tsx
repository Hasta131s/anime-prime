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
 * When AniList has no cover for a title the card fills with the title itself on
 * the dominant colour AniList reports — never with stand-in artwork.
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
        "relative aspect-[2/3] w-full overflow-hidden rounded-[3px] bg-card",
        className,
      )}
      style={
        anime.coverColor ? { backgroundColor: `${anime.coverColor}1f` } : undefined
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
            "size-full object-cover transition-opacity duration-300",
            loaded ? "opacity-100" : "opacity-0",
          )}
        />
      ) : null}

      {!loaded && showImage ? (
        <div className="absolute inset-0 animate-pulse bg-white/[0.03]" />
      ) : null}

      {!showImage ? <PosterFallback anime={anime} /> : null}
    </div>
  );
}

function PosterFallback({ anime }: { anime: PosterSource }) {
  const tint = anime.coverColor ?? "#3db4f2";

  return (
    <div
      className="flex size-full flex-col justify-between gap-3 p-2.5"
      style={{
        backgroundImage: `linear-gradient(160deg, ${tint}4d 0%, #151f2e 55%, #0b1622 100%)`,
      }}
    >
      <span className="stat-label text-[9px] text-white/40">Afiş yok</span>
      <span className="text-[13px] leading-snug font-semibold text-white/90">
        {anime.title}
      </span>
    </div>
  );
}
