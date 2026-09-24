import { AnimeGrid } from "@/components/site/anime-section";
import { Tag } from "@/components/site/panel";
import { Container, SiteShell } from "@/components/site/site-shell";
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
  // Tracks what the URL already holds so external navigation (top bar search)
  // and in-page typing never fight each other.
  const pushedRef = useRef(q);

  useDocumentTitle(
    q ? `"${q}" arama sonuçları` : genre ? `${genreLabel(genre)} animeleri` : "Anime",
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
  const resultCount = searching ? items.length : (catalog?.matching ?? items.length);

  return (
    <SiteShell>
      <Container className="py-6">
        <header className="border-b border-border pb-4">
          <h1 className="text-[20px] font-semibold text-foreground sm:text-[24px]">
            {searching
              ? `"${q.trim()}" için sonuçlar`
              : genre
                ? `${genreLabel(genre)} animeleri`
                : "Anime"}
          </h1>
          <p className="mt-1 text-[12px] text-muted-foreground">
            {isLoading
              ? "Katalog hazırlanıyor…"
              : `${formatCount(resultCount)} sonuç · ${formatCount(catalog?.total ?? 0)} yapımlık katalog önbelleği`}
          </p>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                type="search"
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="Anime, tür veya stüdyo ara — örn. Attack on Titan, MAPPA"
                aria-label="Katalogda ara"
                className="h-9 w-full rounded-[3px] border border-input bg-card pr-9 pl-9 text-[13px] text-foreground outline-none placeholder:text-muted-foreground/80 focus:border-primary"
              />
              {term ? (
                <button
                  type="button"
                  onClick={() => setTerm("")}
                  aria-label="Aramayı temizle"
                  className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded-[2px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </div>

            <Select value={sort} onValueChange={(value) => updateParam("sort", value)}>
              <SelectTrigger
                aria-label="Sıralama"
                className="h-9 w-full rounded-[3px] border-input bg-card text-[13px] sm:w-[150px]"
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
          </div>

          {catalog && catalog.genres.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <button type="button" onClick={() => updateParam("genre", undefined)}>
                <Tag active={!genre}>Tüm türler</Tag>
              </button>
              {catalog.genres.slice(0, 16).map((entry) => (
                <button
                  key={entry.name}
                  type="button"
                  onClick={() => updateParam("genre", entry.name)}
                >
                  <Tag active={genre === entry.name} count={entry.count}>
                    {genreLabel(entry.name)}
                  </Tag>
                </button>
              ))}
            </div>
          ) : null}
        </header>

        <div className="py-6">
          {isLoading ? (
            <CardGridSkeleton count={18} />
          ) : shown.length === 0 ? (
            remote.isSearching ? (
              <div className="flex items-center justify-center gap-2 py-20 text-[13px] text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Katalogda aranıyor…
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
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-[12px] text-muted-foreground">
                  {formatCount(resultCount)} sonuç
                  {searching && remote.isSearching ? (
                    <span className="ml-2 inline-flex items-center gap-1.5 text-brand-live">
                      <Loader2 className="size-3 animate-spin" />
                      canlı arama
                    </span>
                  ) : null}
                </p>
                <p className="hidden text-[11px] text-muted-foreground sm:block">
                  Kaynak: canlı anime kataloğu
                </p>
              </div>

              <AnimeGrid items={shown} priorityCount={6} />

              {hasMore ? (
                <div className="mt-8 flex justify-center">
                  <Button
                    variant="outline"
                    onClick={() => setVisible((value) => value + PAGE_SIZE)}
                  >
                    Daha fazla göster ({items.length - shown.length})
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </Container>
    </SiteShell>
  );
}
