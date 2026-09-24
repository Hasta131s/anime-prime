import { AnimeSection } from "@/components/site/anime-section";
import { NextEpisodeLabel } from "@/components/site/next-episode";
import { Panel, StatStrip, Tag } from "@/components/site/panel";
import { Poster } from "@/components/site/poster";
import { Container, SiteShell } from "@/components/site/site-shell";
import { TrailerButton } from "@/components/site/trailer-dialog";
import { buttonVariants } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { AnimeCardView } from "@/convex/animeView";
import { useFeed } from "@/hooks/use-anime";
import { useDocumentTitle } from "@/hooks/use-document-title";
import {
  formatCount,
  formatDuration,
  formatEpisodes,
  formatLabel,
  formatScore,
  genreLabel,
  releaseWindow,
  scoreColorClass,
  statusLabel,
} from "@/lib/anime-labels";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { Database } from "lucide-react";
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

export default function Landing() {
  const trending = useFeed("trending");
  const airing = useFeed("airing");
  const popular = useFeed("popular");
  const top = useFeed("top");
  const stats = useQuery(api.anime.stats);

  const featured = useMemo(() => pickFeatured(trending.items), [trending.items]);

  useDocumentTitle("Anime keşfet");

  const heroImage = featured ? (featured.banner ?? featured.cover) : undefined;
  const score = formatScore(featured?.score);

  return (
    <SiteShell>
      {/* -------------------------------------------------------- Header block */}
      <section className="border-b border-border">
        <div className="relative h-[160px] w-full sm:h-[220px] lg:h-[270px]">
          {heroImage ? (
            <img
              src={heroImage}
              alt=""
              aria-hidden="true"
              className="size-full object-cover object-center"
            />
          ) : (
            <div className="size-full animate-pulse bg-card" />
          )}
          <div className="absolute inset-0 bg-linear-to-t from-background via-background/75 to-background/25" />
        </div>

        <Container>
          {featured ? (
            <div className="-mt-[96px] flex flex-col gap-4 pb-6 sm:-mt-[112px] sm:flex-row sm:gap-6 lg:-mt-[128px]">
              <div className="w-[104px] shrink-0 sm:w-[150px] lg:w-[200px]">
                <Poster
                  anime={featured}
                  priority
                  className="border border-border shadow-lg shadow-black/30"
                />
              </div>

              <div className="min-w-0 flex-1">
                <p className="stat-label">
                  Öne çıkan
                  {featured.status ? ` · ${statusLabel(featured.status)}` : ""}
                </p>

                <h1 className="text-cinema mt-1.5 text-[24px] leading-tight font-bold text-foreground sm:text-[30px] lg:text-[34px]">
                  {featured.title}
                </h1>

                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
                  {featured.titleEnglish &&
                  featured.titleEnglish !== featured.title ? (
                    <span className="text-primary">{featured.titleEnglish}</span>
                  ) : null}
                  {featured.titleNative ? (
                    <span className="text-muted-foreground">
                      {featured.titleNative}
                    </span>
                  ) : null}
                </div>

                <StatStrip
                  className="mt-4"
                  stats={[
                    {
                      label: "Puan",
                      value: score,
                      tone: scoreColorClass(featured.score),
                    },
                    { label: "Format", value: formatLabel(featured.format) },
                    { label: "Bölüm", value: formatEpisodes(featured.episodes) },
                    { label: "Süre", value: formatDuration(featured.duration) },
                    { label: "Sezon", value: releaseWindow(featured) },
                    {
                      label: "Popülerlik",
                      value: formatCount(featured.popularity),
                    },
                  ]}
                />

                {featured.genres.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {featured.genres.slice(0, 5).map((genre) => (
                      <Tag key={genre} to={`/anime?genre=${encodeURIComponent(genre)}`}>
                        {genreLabel(genre)}
                      </Tag>
                    ))}
                  </div>
                ) : null}

                {featured.synopsis ? (
                  <p className="mt-3 line-clamp-3 max-w-3xl text-[13px] leading-relaxed text-muted-foreground">
                    {featured.synopsis}
                  </p>
                ) : null}

                <NextEpisodeLabel
                  episode={featured.nextEpisode}
                  airingAt={featured.nextEpisodeAt}
                  className="mt-3"
                />

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Link
                    to={`/anime/${featured.anilistId}`}
                    className={buttonVariants({ size: "lg" })}
                  >
                    Detayları gör
                  </Link>
                  <TrailerButton
                    trailerId={featured.trailerId}
                    trailerSite={featured.trailerSite}
                    title={featured.title}
                    variant="outline"
                    size="lg"
                    label="Fragman"
                  />
                  <Link
                    to="/anime"
                    className={cn(buttonVariants({ variant: "ghost", size: "lg" }))}
                  >
                    Kataloğu keşfet
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="-mt-[96px] flex gap-6 pb-6 sm:-mt-[112px]">
              <div className="aspect-[2/3] w-[104px] shrink-0 animate-pulse rounded-[3px] bg-card sm:w-[150px]" />
              <div className="flex-1 space-y-3 pt-10">
                <div className="h-4 w-28 animate-pulse rounded-[2px] bg-card" />
                <div className="h-8 w-2/3 animate-pulse rounded-[2px] bg-card" />
                <div className="h-14 w-full max-w-md animate-pulse rounded-[3px] bg-card" />
              </div>
            </div>
          )}
        </Container>
      </section>

      {/* ------------------------------------------------------------ Sections */}
      <Container className="space-y-9 py-8">
        <AnimeSection
          title="Şu an trend"
          blurb="Katalogun trend sıralaması, 6 saatte bir yenilenir."
          items={trending.items}
          status={trending.status}
          message={trending.message}
          onRetry={() => void trending.retry()}
          href="/anime"
        />

        <AnimeSection
          title="Bu sezon yayında"
          blurb="Yeni bölümleriyle devam eden yapımlar."
          items={airing.items}
          status={airing.status}
          message={airing.message}
          onRetry={() => void airing.retry()}
          href="/anime?sort=newest"
        />

        <AnimeSection
          title="Tüm zamanların en popüleri"
          blurb="İzleyicilerin en çok takip ettiği animeler."
          items={popular.items}
          status={popular.status}
          message={popular.message}
          onRetry={() => void popular.retry()}
          href="/anime"
        />

        <AnimeSection
          title="En yüksek puanlılar"
          blurb="İzleyici ortalamasına göre zirve."
          items={top.items}
          status={top.status}
          message={top.message}
          onRetry={() => void top.retry()}
          href="/anime?sort=score"
        />

        {stats && stats.topGenres.length > 0 ? (
          <Panel
            title="Türlere göre keşfet"
            action={
              <Link to="/anime" className="text-[12px] font-medium text-primary hover:underline">
                Tümünü gör
              </Link>
            }
          >
            <div className="flex flex-wrap gap-1.5">
              {stats.topGenres.map((genre) => (
                <Tag
                  key={genre.name}
                  to={`/anime?genre=${encodeURIComponent(genre.name)}`}
                  count={genre.count}
                >
                  {genreLabel(genre.name)}
                </Tag>
              ))}
            </div>
            <p className="mt-3 flex items-center gap-2 border-t border-border pt-3 text-[11px] text-muted-foreground">
              <Database className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
              {stats.titles > 0
                ? `${formatCount(stats.titles)} yapım · ${stats.genres} tür · ${stats.studios} stüdyo, doğrudan katalogdan sayılır.`
                : "Katalog güncelleniyor…"}
            </p>
          </Panel>
        ) : null}

        <Panel title="Bu katalog nasıl çalışır">
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              {
                label: "Gerçek veri",
                body: "Başlık, puan, tür, stüdyo, kadro ve bölüm bilgileri canlı anime kataloğundan çekilir. Afiş yoksa yapımın adı gösterilir; uydurma görsel kullanılmaz.",
              },
              {
                label: "Nerede izlenir",
                body: "Her yapımın lisanslı yayın platformları ve resmî fragmanı listelenir. Anime Prime video barındırmaz ve hiçbir siteden akış çekmez.",
              },
              {
                label: "Her ekranda",
                body: "Telefon, tablet ve masaüstünde aynı düzen; dokunmatik kaydırma, çevrimdışı uygulama desteği ve saniyelik arama.",
              },
            ].map((item) => (
              <div key={item.label}>
                <p className="stat-label">{item.label}</p>
                <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Takvim, yorumlar ve profiller">
          <div className="grid gap-5 sm:grid-cols-3">
            {[
              {
                to: "/takvim",
                label: "Yayın takvimi",
                body: "Önümüzdeki yedi günün gerçek bölüm saatleri tek bakışta. Bölüm yayınlandığında sayfayı yenile, kaldığın yerden devam et.",
              },
              {
                to: "/anime",
                label: "Yorumlar ve spoiler",
                body: "Her yapımın altında yorum yap, yanıtla, beğen. Spoiler içeren yorumlar sen dokunana kadar gizli kalır.",
              },
              {
                to: "/auth",
                label: "Kişisel profil",
                body: "Favori animelerini seç, izlediğin bölümleri ve toplam anime sayını profilde topla.",
              },
            ].map((item) => (
              <Link key={item.label} to={item.to} className="group block">
                <p className="stat-label transition-colors group-hover:text-primary">
                  {item.label}
                </p>
                <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
                  {item.body}
                </p>
              </Link>
            ))}
          </div>
        </Panel>

        <Panel bodyClassName="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl">
            <h2 className="text-[17px] font-semibold text-foreground">
              Kataloğun tamamı seni bekliyor
            </h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
              Tür, puan ve çıkış yılına göre filtrele; kadroyu, bölümleri ve
              nerede izleyebileceğini tek sayfada gör.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/anime" className={buttonVariants()}>
              Kataloğu aç
            </Link>
            <Link
              to="/takvim"
              className={buttonVariants({ variant: "outline" })}
            >
              Yayın takvimi
            </Link>
            <Link
              to="/auth"
              className={buttonVariants({ variant: "outline" })}
            >
              Hesap oluştur
            </Link>
          </div>
        </Panel>
      </Container>
    </SiteShell>
  );
}
