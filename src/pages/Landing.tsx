import { AnimeRail } from "@/components/site/anime-rail";
import { AnimeRow } from "@/components/site/anime-card";
import { Poster } from "@/components/site/poster";
import { NextEpisodeLabel } from "@/components/site/next-episode";
import { SiteShell } from "@/components/site/site-shell";
import { TrailerButton } from "@/components/site/trailer-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { AnimeCardView } from "@/convex/animeView";
import { useFeed } from "@/hooks/use-anime";
import {
  formatCount,
  formatEpisodes,
  formatLabel,
  formatScore,
  genreLabel,
  metaLine,
  releaseWindow,
  statusLabel,
} from "@/lib/anime-labels";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Clapperboard,
  Compass,
  Database,
  MonitorSmartphone,
  Play,
  Star,
} from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router";

/** Rotates once a day through recent trending titles that have banner art. */
function pickFeatured(items: AnimeCardView[]): AnimeCardView | undefined {
  if (items.length === 0) return undefined;
  const withBanner = items.filter((item) => item.banner).slice(0, 6);
  const pool = withBanner.length > 0 ? withBanner : items.slice(0, 6);
  const dayIndex = Math.floor(Date.now() / 86_400_000);
  return pool[dayIndex % pool.length];
}

const reveal = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const },
};

export default function Landing() {
  const trending = useFeed("trending");
  const airing = useFeed("airing");
  const popular = useFeed("popular");
  const top = useFeed("top");
  const stats = useQuery(api.anime.stats);

  const featured = useMemo(() => pickFeatured(trending.items), [trending.items]);

  const spotlight = useMemo(() => {
    const pool = airing.items.filter((item) => item.cover);
    const lead = pool.find((item) => item.nextEpisodeAt) ?? pool[0];
    const rest = pool
      .filter((item) => item.anilistId !== lead?.anilistId)
      .slice(0, 5);
    return { lead, rest };
  }, [airing.items]);

  const heroImage = featured ? (featured.banner ?? featured.cover) : undefined;

  return (
    <SiteShell>
      {/* ---------------------------------------------------------------- Hero */}
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10">
          {heroImage ? (
            <img
              src={heroImage}
              alt=""
              aria-hidden="true"
              className="size-full object-cover object-center"
            />
          ) : (
            <div className="size-full bg-grid opacity-30" />
          )}
          {/* Scrims keep every word readable over real artwork. */}
          <div className="absolute inset-0 bg-linear-to-r from-background via-background/92 to-background/30" />
          <div className="absolute inset-0 bg-linear-to-t from-background via-background/60 to-background/10" />
        </div>

        <div className="mx-auto flex min-h-[72vh] w-full max-w-7xl flex-col justify-end px-4 pt-28 pb-14 sm:px-6 sm:pt-36 sm:pb-16 lg:min-h-[80vh] lg:px-8">
          {featured ? (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="max-w-3xl"
            >
              <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-black/40 px-3 py-1.5 text-[11px] font-semibold tracking-[0.14em] text-white/80 uppercase backdrop-blur-sm">
                <span className="size-1.5 rounded-full bg-brand-cyan" aria-hidden="true" />
                Öne çıkan
                {featured.status ? ` · ${statusLabel(featured.status)}` : ""}
              </span>

              <h1 className="text-cinema mt-5 text-3xl leading-[1.05] font-extrabold text-white sm:text-5xl lg:text-6xl">
                {featured.title}
              </h1>

              {featured.titleEnglish && featured.titleEnglish !== featured.title ? (
                <p className="mt-3 text-sm text-white/60 sm:text-base">
                  {featured.titleEnglish}
                </p>
              ) : null}

              <div className="mt-5 flex flex-wrap items-center gap-2.5 text-xs font-medium text-white/85 sm:text-sm">
                {formatScore(featured.score) ? (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1 backdrop-blur-sm">
                    <Star className="size-3.5 text-amber-300" aria-hidden="true" />
                    {formatScore(featured.score)} / 10
                  </span>
                ) : null}
                {releaseWindow(featured) ? (
                  <span className="rounded-md bg-white/10 px-2.5 py-1 backdrop-blur-sm">
                    {releaseWindow(featured)}
                  </span>
                ) : null}
                {formatLabel(featured.format) ? (
                  <span className="rounded-md bg-white/10 px-2.5 py-1 backdrop-blur-sm">
                    {formatLabel(featured.format)}
                  </span>
                ) : null}
                {formatEpisodes(featured.episodes) ? (
                  <span className="rounded-md bg-white/10 px-2.5 py-1 backdrop-blur-sm">
                    {formatEpisodes(featured.episodes)}
                  </span>
                ) : null}
                <NextEpisodeLabel
                  episode={featured.nextEpisode}
                  airingAt={featured.nextEpisodeAt}
                  className="bg-black/30 px-2.5 py-1 text-white/90 backdrop-blur-sm"
                />
              </div>

              {featured.synopsis ? (
                <p className="mt-5 max-w-2xl text-sm leading-relaxed text-white/75 sm:text-base">
                  {featured.synopsis}
                </p>
              ) : null}

              {featured.genres.length > 0 ? (
                <div className="mt-5 flex flex-wrap gap-2">
                  {featured.genres.slice(0, 4).map((genre) => (
                    <Link
                      key={genre}
                      to={`/anime?genre=${encodeURIComponent(genre)}`}
                      className="rounded-full border border-white/12 px-3 py-1 text-xs text-white/75 transition-colors hover:border-brand/60 hover:text-white"
                    >
                      {genreLabel(genre)}
                    </Link>
                  ))}
                </div>
              ) : null}

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  to={`/anime/${featured.anilistId}`}
                  className={cn(
                    buttonVariants({ size: "lg" }),
                    "rounded-full px-6 text-sm font-semibold",
                  )}
                >
                  Detayları gör
                  <ArrowRight />
                </Link>
                <TrailerButton
                  trailerId={featured.trailerId}
                  trailerSite={featured.trailerSite}
                  title={featured.title}
                  className="rounded-full border-white/20 bg-white/5 px-6 text-sm text-white hover:bg-white/12 hover:text-white"
                />
                <Link
                  to="/anime"
                  className="text-sm font-medium text-white/75 underline-offset-4 transition-colors hover:text-white hover:underline"
                >
                  Kataloğun tamamı
                </Link>
              </div>
            </motion.div>
          ) : (
            <HeroSkeleton />
          )}

          {/* Live catalogue figures — counted from what is actually cached. */}
          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/10 pt-5 text-xs text-white/60 sm:text-sm">
            <span className="inline-flex items-center gap-2 font-semibold text-white/80">
              <Database className="size-3.5 text-brand-bright" aria-hidden="true" />
              AniList canlı kataloğu
            </span>
            {stats && stats.titles > 0 ? (
              <>
                <span>{formatCount(stats.titles)} yapım</span>
                <span>{stats.genres} tür</span>
                <span>{stats.studios} stüdyo</span>
                <span>Kadro, bölüm ve yayın bilgileri dahil</span>
              </>
            ) : (
              <span>Katalog güncelleniyor…</span>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-7xl space-y-14 px-4 pt-14 sm:space-y-16 sm:px-6 lg:px-8">
        <motion.div {...reveal}>
          <AnimeRail
            title="Şu an trend"
            blurb="AniList trend sıralaması, her 6 saatte bir yenilenir."
            items={trending.items}
            status={trending.status}
            message={trending.message}
            onRetry={() => void trending.retry()}
            href="/anime"
          />
        </motion.div>

        {/* --------------------------------------------------------- Spotlight */}
        {(spotlight.lead ?? spotlight.rest.length > 0) && (
          <motion.section
            {...reveal}
            className="grid gap-6 rounded-3xl border border-white/8 bg-surface-1/70 p-4 sm:p-6 lg:grid-cols-[220px_1fr] lg:gap-8"
          >
            {spotlight.lead ? (
              <div>
                <Link
                  to={`/anime/${spotlight.lead.anilistId}`}
                  className="group block"
                >
                  <Poster anime={spotlight.lead} />
                  <div className="mt-3 space-y-1">
                    <h3 className="font-display line-clamp-2 text-sm font-bold transition-colors group-hover:text-brand-bright">
                      {spotlight.lead.title}
                    </h3>
                    <NextEpisodeLabel
                      episode={spotlight.lead.nextEpisode}
                      airingAt={spotlight.lead.nextEpisodeAt}
                    />
                    <p className="text-xs text-muted-foreground">
                      {metaLine(spotlight.lead)}
                    </p>
                  </div>
                </Link>
              </div>
            ) : null}

            <div className="flex flex-col">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-lg font-extrabold sm:text-xl">
                    Bu sezon yayında
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                    Yeni bölümü olan yapımlar ve gerçek yayın takvimi.
                  </p>
                </div>
                <Link
                  to="/anime?sort=newest"
                  className="hidden shrink-0 text-xs font-semibold text-brand-bright hover:underline sm:block sm:text-sm"
                >
                  Tümünü gör
                </Link>
              </div>

              <div className="mt-4 divide-y divide-white/6 border-y border-white/6">
                {spotlight.rest.length > 0 ? (
                  spotlight.rest.map((anime) => (
                    <div
                      key={anime.anilistId}
                      className="flex items-center gap-3 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <AnimeRow anime={anime} className="px-0 hover:bg-transparent" />
                      </div>
                      <NextEpisodeLabel
                        episode={anime.nextEpisode}
                        airingAt={anime.nextEpisodeAt}
                        className="hidden shrink-0 sm:inline-flex"
                      />
                    </div>
                  ))
                ) : (
                  <p className="py-6 text-sm text-muted-foreground">
                    Yayın takvimi yükleniyor…
                  </p>
                )}
              </div>
            </div>
          </motion.section>
        )}

        <motion.div {...reveal}>
          <AnimeRail
            title="Tüm zamanların en popüleri"
            blurb="İzleyicilerin en çok takip ettiği yapımlar."
            items={popular.items}
            status={popular.status}
            message={popular.message}
            onRetry={() => void popular.retry()}
            href="/anime"
          />
        </motion.div>

        {/* -------------------------------------------------------- How it works */}
        <motion.section {...reveal} className="grid gap-8 sm:grid-cols-3">
          {[
            {
              icon: Compass,
              step: "01",
              title: "Gerçek katalog",
              body: "Başlık, puan, tür, stüdyo, kadro ve bölüm bilgileri AniList API'sinden canlı gelir. Vitrin görseli uydurmayız; afiş yoksa yapımın adı gösterilir.",
            },
            {
              icon: Clapperboard,
              step: "02",
              title: "Nerede izlenir",
              body: "Her detay sayfası, yapımın lisanslı yayın platformlarını ve resmî fragmanını listeler. Anime Prime video barındırmaz.",
            },
            {
              icon: MonitorSmartphone,
              step: "03",
              title: "Her ekranda akıcı",
              body: "Telefon, tablet ve masaüstünde aynı düzen; dokunmatik kaydırma, çevrimdışı uygulama desteği ve hızlı arama.",
            },
          ].map((item) => (
            <div key={item.step} className="space-y-3 border-t border-white/10 pt-5">
              <div className="flex items-center justify-between">
                <span className="font-display text-xs font-bold tracking-[0.2em] text-muted-foreground">
                  {item.step}
                </span>
                <item.icon className="size-4 text-brand-bright" aria-hidden="true" />
              </div>
              <h3 className="font-display text-base font-bold">{item.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {item.body}
              </p>
            </div>
          ))}
        </motion.section>

        <motion.div {...reveal}>
          <AnimeRail
            title="En yüksek puanlılar"
            blurb="AniList kullanıcı ortalamasına göre zirve."
            items={top.items}
            status={top.status}
            message={top.message}
            onRetry={() => void top.retry()}
            href="/anime?sort=score"
          />
        </motion.div>

        {/* ------------------------------------------------------ Genre browser */}
        {stats && stats.topGenres.length > 0 ? (
          <motion.section
            {...reveal}
            className="space-y-5 rounded-3xl border border-white/8 bg-grid p-6 sm:p-8"
          >
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-lg font-extrabold sm:text-xl">
                  Türlere göre keşfet
                </h2>
                <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                  Katalogdaki dağılıma göre, {stats.genres} tür.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {stats.topGenres.map((genre) => (
                <Link
                  key={genre.name}
                  to={`/anime?genre=${encodeURIComponent(genre.name)}`}
                  className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm transition-colors hover:border-brand/60 hover:bg-brand/12"
                >
                  <span className="font-medium">{genreLabel(genre.name)}</span>
                  <span className="text-xs text-muted-foreground group-hover:text-brand-bright">
                    {genre.count}
                  </span>
                </Link>
              ))}
            </div>
          </motion.section>
        ) : null}

        {/* ----------------------------------------------------------------- CTA */}
        <motion.section
          {...reveal}
          className="relative overflow-hidden rounded-3xl border border-white/10 bg-surface-1 px-6 py-10 sm:px-10 sm:py-12"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_120%_at_100%_0%,oklch(0.55_0.2_258/0.28),transparent_60%)]"
          />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <h2 className="font-display text-2xl font-extrabold sm:text-3xl">
                <span className="inline-flex items-center gap-2">
                  <Play className="size-5 fill-brand-bright text-brand-bright" aria-hidden="true" />
                  Kataloğun tamamı seni bekliyor
                </span>
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                Tür, puan ve çıkış yılına göre filtrele, aradığın yapımı bul,
                kadrosunu ve nerede izleyebileceğini tek sayfada gör.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/anime"
                className={cn(buttonVariants({ size: "lg" }), "rounded-full px-6")}
              >
                Kataloğu aç
                <ArrowRight />
              </Link>
              <Link
                to="/auth"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "rounded-full border-white/15 px-6",
                )}
              >
                Hesap oluştur
              </Link>
            </div>
          </div>
        </motion.section>
      </div>
    </SiteShell>
  );
}

function HeroSkeleton() {
  return (
    <div className="max-w-2xl animate-pulse space-y-5">
      <div className="h-6 w-40 rounded-full bg-white/8" />
      <div className="h-12 w-3/4 rounded-lg bg-white/8" />
      <div className="h-4 w-2/3 rounded-md bg-white/6" />
      <div className="h-20 w-full rounded-lg bg-white/5" />
      <div className="flex gap-3">
        <div className="h-11 w-40 rounded-full bg-white/8" />
        <div className="h-11 w-36 rounded-full bg-white/6" />
      </div>
    </div>
  );
}
