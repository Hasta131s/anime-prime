import { AnimeCard } from "@/components/site/anime-card";
import { SiteShell } from "@/components/site/site-shell";
import { CardGridSkeleton, EmptyCard } from "@/components/site/states";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/convex/_generated/api";
import type { AnimeCardView } from "@/convex/animeView";
import { useRemoteSearch } from "@/hooks/use-anime";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { formatCount, genreLabel } from "@/lib/anime-labels";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { Loader2, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";

const SORT_OPTIONS = [
  { value: "popular", label: "Popülerlik" },
  { value: "score", label: "Puan" },
  { value: "newest", label: "Çıkış yılı" },
];

const PAGE_SIZE = 24;

export default function Browse() {
  const [searchParams, setSearchParams] = useSearchParams();

  const q = searchParams.get("q") ?? "";
  const genre = searchParams.get("genre") ?? "";
  const sort = SORT_OPTIONS.some((option) => option.value === searchParams.get("sort"))
    ? (searchParams.get("sort") as string)
    : "popular";

  const [term, setTerm] = useState(q);
  const [visible, setVisible] = useState(PAGE_SIZE);
  // Tracks what the URL already holds so external navigation (header search)
  // and in-page typing never fight each other.
  const pushedRef = useRef(q);

  useDocumentTitle(
    q ? `"${q}" arama sonuçları` : genre ? `${genreLabel(genre)} animeleri` : "Katalog",
  );

  useEffect(() => {
    if (q !== pushedRef.current) {
      pushedRef.current = q;
      setTerm(q);
    }
  }, [q]);

  useEffect(() => {
    const trimmed = term.trim();
    if (trimmed === pushedRef.current) return;

    const timer = setTimeout(() => {
      pushedRef.current = trimmed;
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          if (trimmed) next.set("q", trimmed);
          else next.delete("q");
          return next;
        },
        { replace: true },
      );
    }, 350);

    return () => clearTimeout(timer);
  }, [term, setSearchParams]);

  const catalog = useQuery(api.anime.catalog, {
    q: q || undefined,
    genre: genre || undefined,
    sort,
  });
  const remote = useRemoteSearch(q);

  const searching = q.trim().length >= 2;

  // Local cache first for instant feedback, then live AniList hits merged in.
  const items = useMemo(() => {
    const local = catalog?.items ?? [];
    const live = remote.resolvedTerm === q.trim() ? remote.items : [];
    const merged: AnimeCardView[] = [];
    const seen = new Set<number>();
    for (const item of [...live, ...local]) {
      if (seen.has(item.anilistId)) continue;
      seen.add(item.anilistId);
      merged.push(item);
    }
    return merged;
  }, [catalog?.items, remote.items, remote.resolvedTerm, q]);

  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [q, genre, sort]);

  const updateParam = (key: string, value?: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key === "q") pushedRef.current = value ?? "";
    setSearchParams(next, { replace: true });
  };

  const isLoading = catalog === undefined;
  const shown = items.slice(0, visible);
  const hasMore = items.length > shown.length;

  return (
    <SiteShell>
      <div className="mx-auto w-full max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">
        {/* ------------------------------------------------------- Page header */}
        <div className="border-b border-white/6 pb-8">
          <p className="font-display text-xs font-bold tracking-[0.2em] text-brand-bright uppercase">
            Katalog
          </p>
          <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">
            {searching
              ? `"${q.trim()}" için sonuçlar`
              : genre
                ? `${genreLabel(genre)} animeleri`
                : "Tüm animeler"}
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
            {searching
              ? "Önce AniList kataloğunda canlı arama yapılır, ardından yerel önbellekteki eşleşmeler eklenir."
              : "AniList kataloğundan çekilen gerçek veriler: puanlar, türler, stüdyolar ve bölüm sayıları."}
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                type="search"
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="Anime, tür veya stüdyo ara — örn. Attack on Titan, MAPPA"
                aria-label="Katalogda ara"
                className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] pr-10 pl-10 text-sm text-foreground outline-none placeholder:text-muted-foreground/80 focus:border-brand/60 focus:bg-white/[0.06] focus:ring-2 focus:ring-ring/40"
              />
              {term ? (
                <button
                  type="button"
                  onClick={() => setTerm("")}
                  aria-label="Aramayı temizle"
                  className="absolute top-1/2 right-3 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </div>

            <div className="flex items-center gap-3">
              <Select value={sort} onValueChange={(value) => updateParam("sort", value)}>
                <SelectTrigger
                  aria-label="Sıralama"
                  className="h-12 w-[168px] rounded-xl border-white/10 bg-white/[0.04] px-3.5 text-sm"
                >
                  <SelectValue placeholder="Sırala" />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {catalog ? (
                <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                  {formatCount(catalog.total)} yapım
                </span>
              ) : null}
            </div>
          </div>

          {/* ---------------------------------------------------- Genre filters */}
          {catalog && catalog.genres.length > 0 ? (
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => updateParam("genre", undefined)}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors sm:text-sm",
                  genre
                    ? "border-white/10 bg-white/[0.04] text-muted-foreground hover:text-foreground"
                    : "border-brand/60 bg-brand/18 text-foreground",
                )}
              >
                Tüm türler
              </button>
              {catalog.genres.slice(0, 14).map((entry) => (
                <button
                  key={entry.name}
                  type="button"
                  onClick={() => updateParam("genre", entry.name)}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors sm:text-sm",
                    genre === entry.name
                      ? "border-brand/60 bg-brand/18 text-foreground"
                      : "border-white/10 bg-white/[0.04] text-muted-foreground hover:text-foreground",
                  )}
                >
                  {genreLabel(entry.name)}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {/* ------------------------------------------------------------ Results */}
        <div className="py-8">
          {isLoading ? (
            <CardGridSkeleton count={15} />
          ) : shown.length === 0 ? (
            remote.isSearching ? (
              <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                AniList kataloğunda aranıyor…
              </div>
            ) : (
              <EmptyCard
                title="Sonuç bulunamadı"
                description={
                  searching
                    ? `"${q.trim()}" için eşleşen bir yapım bulunamadı. Başka bir başlık, tür ya da stüdyo adı dene.`
                    : "Bu filtre birleşimi için katalogda kayıt yok."
                }
              >
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchParams(new URLSearchParams(), { replace: true });
                    setTerm("");
                  }}
                >
                  Filtreleri temizle
                </Button>
              </EmptyCard>
            )
          ) : (
            <>
              <div className="mb-5 flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  {formatCount(searching ? items.length : catalog?.matching ?? items.length)}{" "}
                  sonuç
                  {searching && remote.isSearching ? (
                    <span className="ml-2 inline-flex items-center gap-1.5 text-xs text-brand-bright">
                      <Loader2 className="size-3 animate-spin" />
                      canlı arama sürüyor
                    </span>
                  ) : null}
                </p>
                <p className="hidden text-xs text-muted-foreground sm:block">
                  Kaynak: AniList API
                </p>
              </div>

              <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-4 xl:grid-cols-5">
                {shown.map((anime, index) => (
                  <AnimeCard key={anime.anilistId} anime={anime} priority={index < 5} />
                ))}
              </div>

              {hasMore ? (
                <div className="mt-10 flex justify-center">
                  <Button
                    variant="outline"
                    size="lg"
                    className="rounded-full border-white/12 px-6"
                    onClick={() => setVisible((value) => value + PAGE_SIZE)}
                  >
                    Daha fazla göster ({items.length - shown.length})
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </SiteShell>
  );
}
