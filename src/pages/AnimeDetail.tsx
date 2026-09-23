import { AnimeGrid, SectionHeader } from "@/components/site/anime-section";
import { NextEpisodeLabel } from "@/components/site/next-episode";
import { Panel, StatStrip, Tag } from "@/components/site/panel";
import { Poster } from "@/components/site/poster";
import { Container, SiteShell } from "@/components/site/site-shell";
import { ErrorCard } from "@/components/site/states";
import { TrailerButton } from "@/components/site/trailer-dialog";
import { buttonVariants } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { AnimeDetailView, TitleRefView } from "@/convex/animeView";
import { useAnimeDetail } from "@/hooks/use-anime";
import { useDocumentTitle } from "@/hooks/use-document-title";
import {
  formatCount,
  formatDateTime,
  formatDuration,
  formatEpisodes,
  formatLabel,
  formatRelative,
  formatScore,
  genreLabel,
  relationLabel,
  releaseWindow,
  roleLabel,
  scoreColorClass,
  statusLabel,
  synopsisParagraphs,
} from "@/lib/anime-labels";
import { cn } from "@/lib/utils";
import { formatClock, latestProgressFor } from "@/lib/watch-progress";
import { useQuery } from "convex/react";
import { ExternalLink, Play } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { Link, useParams } from "react-router";

export default function AnimeDetail() {
  const params = useParams<{ id: string }>();
  const anilistId = Number(params.id);
  const valid = Number.isInteger(anilistId) && anilistId > 0;

  const { anime, status, message, isLoading, retry } = useAnimeDetail(
    valid ? anilistId : 0,
  );
  useDocumentTitle(anime?.title);

  if (!valid) {
    return (
      <SiteShell>
        <DetailMessage
          title="Geçersiz yapım bağlantısı"
          description="Adres çubuğundaki bağlantı bir AniList kaydına karşılık gelmiyor."
        />
      </SiteShell>
    );
  }

  if (isLoading || (!anime && status !== "error")) {
    return (
      <SiteShell>
        <DetailSkeleton />
      </SiteShell>
    );
  }

  if (!anime) {
    return (
      <SiteShell>
        <DetailMessage
          title="Bu yapım bulunamadı"
          description={
            message ??
            "AniList kataloğunda bu kimliğe ait bir kayıt bulunamadı."
          }
        />
      </SiteShell>
    );
  }

  return (
    <DetailBody
      anime={anime}
      status={status}
      message={message}
      onRetry={() => void retry()}
    />
  );
}

function DetailBody({
  anime,
  status,
  message,
  onRetry,
}: {
  anime: AnimeDetailView;
  status: string;
  message?: string;
  onRetry: () => void;
}) {
  const sources = useQuery(api.sources.list, { anilistId: anime.anilistId });
  const hasSources = Boolean(sources && sources.length > 0);
  const resume = useMemo(
    () => (hasSources ? latestProgressFor(anime.anilistId) : null),
    [hasSources, anime.anilistId],
  );
  const watchHref = resume
    ? `/anime/${anime.anilistId}/izle?b=${resume.episode}`
    : `/anime/${anime.anilistId}/izle`;

  const heroImage = anime.banner ?? anime.cover;
  const score = formatScore(anime.score);
  const paragraphs = synopsisParagraphs(anime.synopsis);
  const streams = anime.streams ?? [];
  const characters = anime.characters ?? [];
  const episodes = anime.streamEpisodes ?? [];
  const recommendations = anime.recommendations ?? [];
  const relations = anime.relations ?? [];

  return (
    <SiteShell>
      {/* -------------------------------------------------------- Header block */}
      <section className="border-b border-border">
        <div className="relative h-[150px] w-full sm:h-[210px] lg:h-[260px]">
          {heroImage ? (
            <img
              src={heroImage}
              alt=""
              aria-hidden="true"
              className="size-full object-cover object-center"
            />
          ) : (
            <div className="size-full bg-card" />
          )}
          <div className="absolute inset-0 bg-linear-to-t from-background via-background/75 to-background/30" />
        </div>

        <Container>
          <div className="-mt-[92px] flex flex-col gap-4 pb-6 sm:-mt-[108px] sm:flex-row sm:gap-6 lg:-mt-[124px]">
            <div className="w-[104px] shrink-0 sm:w-[150px] lg:w-[200px]">
              <Poster
                anime={anime}
                priority
                className="border border-border shadow-lg shadow-black/30"
              />
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="text-cinema text-[22px] leading-tight font-bold text-foreground sm:text-[28px] lg:text-[32px]">
                {anime.title}
              </h1>

              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
                {anime.titleEnglish && anime.titleEnglish !== anime.title ? (
                  <span className="text-primary">{anime.titleEnglish}</span>
                ) : null}
                {anime.titleNative ? (
                  <span className="text-muted-foreground">{anime.titleNative}</span>
                ) : null}
              </div>

              <StatStrip
                className="mt-4"
                stats={[
                  {
                    label: "Puan",
                    value: score,
                    tone: scoreColorClass(anime.score),
                  },
                  {
                    label: "Popülerlik",
                    value: formatCount(anime.popularity),
                  },
                  { label: "Favori", value: formatCount(anime.favourites) },
                  { label: "Format", value: formatLabel(anime.format) },
                  { label: "Bölüm", value: formatEpisodes(anime.episodes) },
                  { label: "Süre", value: formatDuration(anime.duration) },
                  { label: "Durum", value: statusLabel(anime.status) },
                  { label: "Sezon", value: releaseWindow(anime) },
                ]}
              />

              {anime.genres.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {anime.genres.map((genre) => (
                    <Tag key={genre} to={`/anime?genre=${encodeURIComponent(genre)}`}>
                      {genreLabel(genre)}
                    </Tag>
                  ))}
                </div>
              ) : null}

              <NextEpisodeLabel
                episode={anime.nextEpisode}
                airingAt={anime.nextEpisodeAt}
                className="mt-3"
              />

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {hasSources ? (
                  <Link to={watchHref} className={buttonVariants({ size: "lg" })}>
                    <Play className="size-4 fill-current" />
                    İzle
                  </Link>
                ) : null}
                <TrailerButton
                  trailerId={anime.trailerId}
                  trailerSite={anime.trailerSite}
                  title={anime.title}
                  variant={hasSources ? "outline" : "default"}
                  size="lg"
                />
                {streams[0] ? (
                  <a
                    href={streams[0].url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className={buttonVariants({ variant: "outline", size: "lg" })}
                  >
                    {streams[0].site}
                    <ExternalLink className="size-4" />
                  </a>
                ) : null}
                {anime.siteUrl ? (
                  <a
                    href={anime.siteUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-[12px] font-medium text-primary hover:underline"
                  >
                    AniList kaydı
                  </a>
                ) : null}
              </div>

              {hasSources && resume ? (
                <p className="mt-3 text-[12px] text-muted-foreground">
                  Kaldığın yer:{" "}
                  <span className="font-medium text-brand-live">
                    {resume.episode === 0 ? "Tek parça" : `Bölüm ${resume.episode}`} ·{" "}
                    {formatClock(resume.position)}
                  </span>
                </p>
              ) : null}
            </div>
          </div>
        </Container>
      </section>

      <Container className="space-y-8 py-8">
        {status === "error" ? (
          <ErrorCard
            title="Detaylar eksik görünebilir"
            message={message}
            onRetry={onRetry}
          />
        ) : null}

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
          {/* ------------------------------------------------------ Main column */}
          <div className="min-w-0 space-y-6">
            {paragraphs.length > 0 ? (
              <Panel title="Konu">
                <div className="space-y-3 text-[13px] leading-relaxed text-muted-foreground">
                  {paragraphs.map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
                </div>
              </Panel>
            ) : null}

            {characters.length > 0 ? (
              <Panel title="Karakterler ve seslendirme">
                <div className="grid gap-2 sm:grid-cols-2">
                  {characters.map((character) => (
                    <div
                      key={character.name}
                      className="flex items-center gap-2.5 rounded-[3px] border border-border bg-background/40 p-2"
                    >
                      {character.image ? (
                        <img
                          src={character.image}
                          alt={character.name}
                          loading="lazy"
                          className="size-12 shrink-0 rounded-[2px] object-cover object-top"
                        />
                      ) : (
                        <div className="size-12 shrink-0 rounded-[2px] bg-accent" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-[12px] font-medium text-foreground">
                          {character.name}
                        </p>
                        {roleLabel(character.role) ? (
                          <p className="text-[10px] text-primary">
                            {roleLabel(character.role)}
                          </p>
                        ) : null}
                        {character.voiceActor ? (
                          <p className="line-clamp-1 text-[10px] text-muted-foreground">
                            {character.voiceActor}
                          </p>
                        ) : null}
                      </div>
                      {character.voiceImage ? (
                        <img
                          src={character.voiceImage}
                          alt={character.voiceActor ?? ""}
                          loading="lazy"
                          className="size-8 shrink-0 rounded-full object-cover"
                        />
                      ) : null}
                    </div>
                  ))}
                </div>
              </Panel>
            ) : null}

            {episodes.length > 0 ? (
              <Panel
                title="Bölümler"
                action={
                  <span className="text-[10px] text-muted-foreground">
                    Görseller yayın platformundan
                  </span>
                }
              >
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {episodes.map((episode, index) => (
                    <a
                      key={`${episode.url}-${index}`}
                      href={episode.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="group overflow-hidden rounded-[3px] border border-border bg-background/40 transition-colors hover:border-primary/60"
                    >
                      {episode.thumbnail ? (
                        <img
                          src={episode.thumbnail}
                          alt=""
                          loading="lazy"
                          className="aspect-video w-full object-cover"
                        />
                      ) : (
                        <div className="aspect-video w-full bg-accent" />
                      )}
                      <div className="p-2">
                        <p className="line-clamp-2 text-[11px] font-medium text-foreground group-hover:text-primary">
                          {episode.title}
                        </p>
                        {episode.site ? (
                          <p className="mt-0.5 text-[10px] text-muted-foreground">
                            {episode.site}
                          </p>
                        ) : null}
                      </div>
                    </a>
                  ))}
                </div>
              </Panel>
            ) : null}
          </div>

          {/* ---------------------------------------------------------- Sidebar */}
          <aside className="space-y-4 lg:sticky lg:top-[72px] lg:self-start">
            <Panel title="Nerede izlenir">
              {streams.length > 0 ? (
                <ul className="space-y-1.5">
                  {streams.map((stream) => (
                    <li key={stream.site}>
                      <a
                        href={stream.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="flex items-center gap-2.5 rounded-[3px] border border-border bg-background/40 px-2.5 py-2 transition-colors hover:border-primary/60"
                      >
                        {stream.icon ? (
                          <img
                            src={stream.icon}
                            alt=""
                            className="size-4 shrink-0 object-contain"
                          />
                        ) : null}
                        <span className="min-w-0 flex-1 truncate text-[12px] font-medium">
                          {stream.site}
                        </span>
                        <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[12px] leading-relaxed text-muted-foreground">
                  AniList bu yapım için lisanslı bir platform bildirmiyor. Yeni bir
                  platform eklendiğinde burası otomatik güncellenir.
                </p>
              )}
              <p className="mt-3 border-t border-border pt-2.5 text-[10px] leading-relaxed text-muted-foreground">
                Anime Prime video barındırmaz; bağlantılar lisanslı platformlara
                yönlendirir.
              </p>
            </Panel>

            <Panel title="Bilgiler">
              <dl className="space-y-2 text-[12px]">
                <InfoRow label="Tür" value={formatLabel(anime.format)} />
                <InfoRow label="Durum" value={statusLabel(anime.status)} />
                <InfoRow
                  label="Bölüm"
                  value={formatEpisodes(anime.episodes)}
                />
                <InfoRow label="Süre" value={formatDuration(anime.duration)} />
                <InfoRow label="Sezon" value={releaseWindow(anime)} />
                <InfoRow
                  label="Stüdyo"
                  value={anime.studios.length > 0 ? anime.studios.join(", ") : undefined}
                />
                <InfoRow label="Puan" value={score ? `${score} / 10` : undefined} />
                <InfoRow label="Popülerlik" value={formatCount(anime.popularity)} />
                <InfoRow label="Favori" value={formatCount(anime.favourites)} />
              </dl>
            </Panel>

            {anime.nextEpisodeAt ? (
              <Panel title="Yayın takvimi">
                <p className="text-[12px] text-foreground">
                  Bölüm {anime.nextEpisode} ·{" "}
                  <span className="font-medium text-brand-live">
                    {formatRelative(anime.nextEpisodeAt)}
                  </span>
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {formatDateTime(anime.nextEpisodeAt)}
                </p>
              </Panel>
            ) : null}
          </aside>
        </div>

        {/* -------------------------------------------------------- Related grids */}
        {relations.length > 0 ? (
          <section>
            <SectionHeader title="İlgili yapımlar" />
            <div className="space-y-4">
              {["PREQUEL", "SEQUEL", "SIDE_STORY", "ALTERNATIVE", "SPIN_OFF"]
                .map((relation) => ({
                  relation,
                  items: relations.filter((item) => item.relationType === relation),
                }))
                .filter((group) => group.items.length > 0)
                .map((group) => (
                  <div key={group.relation}>
                    <p className="stat-label mb-2">{relationLabel(group.relation)}</p>
                    <AnimeGrid items={group.items.map(refToCard)} priorityCount={0} />
                  </div>
                ))}
              {relations.some(
                (item) =>
                  !["PREQUEL", "SEQUEL", "SIDE_STORY", "ALTERNATIVE", "SPIN_OFF"].includes(
                    item.relationType ?? "",
                  ),
              ) ? (
                <div>
                  <p className="stat-label mb-2">Diğer</p>
                  <AnimeGrid
                    items={relations
                      .filter(
                        (item) =>
                          ![
                            "PREQUEL",
                            "SEQUEL",
                            "SIDE_STORY",
                            "ALTERNATIVE",
                            "SPIN_OFF",
                          ].includes(item.relationType ?? ""),
                      )
                      .map(refToCard)}
                    priorityCount={0}
                  />
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {recommendations.length > 0 ? (
          <section>
            <SectionHeader
              title="Benzer animeler"
              blurb="AniList kullanıcılarının birlikte önerdiği yapımlar."
              href="/anime"
            />
            <AnimeGrid
              items={recommendations.map(refToCard)}
              limit={12}
              priorityCount={0}
            />
          </section>
        ) : null}
      </Container>
    </SiteShell>
  );
}

function InfoRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}

/** Relations / recommendations are light-weight refs, not full records. */
function refToCard(ref: TitleRefView) {
  return {
    anilistId: ref.anilistId,
    title: ref.title,
    cover: ref.cover,
    format: ref.format,
    score: ref.score,
    genres: [] as string[],
    studios: [] as string[],
    updatedAt: 0,
  };
}

function DetailMessage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Container className="flex flex-col items-center gap-4 py-24 text-center">
      <h1 className="text-[20px] font-semibold text-foreground">{title}</h1>
      <p className="max-w-md text-[13px] text-muted-foreground">{description}</p>
      <Link to="/anime" className={buttonVariants({ variant: "outline" })}>
        Kataloğa dön
      </Link>
    </Container>
  );
}

function DetailSkeleton({ children }: { children?: ReactNode }) {
  return (
    <>
      <div className="relative h-[150px] w-full animate-pulse bg-card sm:h-[210px] lg:h-[260px]" />
      <Container>
        <div className="-mt-[92px] flex gap-6 pb-6 sm:-mt-[108px] lg:-mt-[124px]">
          <div className="aspect-[2/3] w-[104px] shrink-0 animate-pulse rounded-[3px] bg-card sm:w-[150px] lg:w-[200px]" />
          <div className="flex-1 space-y-3 pt-10">
            <div className="h-7 w-2/3 animate-pulse rounded-[2px] bg-card" />
            <div className="h-12 w-full max-w-lg animate-pulse rounded-[3px] bg-card" />
            <div className="h-9 w-56 animate-pulse rounded-[3px] bg-card" />
          </div>
        </div>
      </Container>
      {children}
    </>
  );
}
