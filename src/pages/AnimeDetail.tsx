import { AnimeRail } from "@/components/site/anime-rail";
import { AnimeCard } from "@/components/site/anime-card";
import { Poster } from "@/components/site/poster";
import { NextEpisodeLabel } from "@/components/site/next-episode";
import { SiteShell } from "@/components/site/site-shell";
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
  statusLabel,
  synopsisParagraphs,
} from "@/lib/anime-labels";
import { cn } from "@/lib/utils";
import { formatClock, latestProgressFor } from "@/lib/watch-progress";
import { useQuery } from "convex/react";
import {
  ArrowLeft,
  CalendarClock,
  ExternalLink,
  Info,
  Play,
  RotateCcw,
  Star,
  Tv,
  Users,
} from "lucide-react";
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
  // Owner-supplied playable sources (HLS / MP4) for this title.
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
      {/* --------------------------------------------------------- Banner hero */}
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
          <div className="absolute inset-0 bg-linear-to-t from-background via-background/80 to-background/40" />
          <div className="absolute inset-0 bg-linear-to-r from-background via-background/50 to-transparent" />
        </div>

        <div className="mx-auto w-full max-w-7xl px-4 pt-6 pb-10 sm:px-6 lg:px-8">
          <Link
            to="/anime"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-white/70 transition-colors hover:text-white sm:text-sm"
          >
            <ArrowLeft className="size-3.5" />
            Kataloğa dön
          </Link>

          <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-end sm:gap-8">
            <div className="w-28 shrink-0 sm:w-40 lg:w-52">
              <Poster anime={anime} priority className="shadow-2xl shadow-black/60" />
            </div>

            <div className="min-w-0 flex-1">
              {anime.genres.length > 0 ? (
                <div className="mb-3 flex flex-wrap gap-2">
                  {anime.genres.slice(0, 3).map((genre) => (
                    <Link
                      key={genre}
                      to={`/anime?genre=${encodeURIComponent(genre)}`}
                      className="rounded-full border border-white/15 bg-black/30 px-2.5 py-1 text-[11px] font-medium text-white/80 backdrop-blur-sm transition-colors hover:border-brand/60 hover:text-white"
                    >
                      {genreLabel(genre)}
                    </Link>
                  ))}
                </div>
              ) : null}

              <h1 className="text-cinema text-3xl leading-[1.08] font-extrabold text-white sm:text-4xl lg:text-5xl">
                {anime.title}
              </h1>

              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/65">
                {anime.titleEnglish && anime.titleEnglish !== anime.title ? (
                  <span>{anime.titleEnglish}</span>
                ) : null}
                {anime.titleNative ? <span>{anime.titleNative}</span> : null}
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2 text-xs font-medium text-white/85 sm:text-sm">
                {score ? (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1 backdrop-blur-sm">
                    <Star className="size-3.5 text-amber-300" aria-hidden="true" />
                    {score} / 10
                  </span>
                ) : null}
                {releaseWindow(anime) ? (
                  <span className="rounded-md bg-white/10 px-2.5 py-1 backdrop-blur-sm">
                    {releaseWindow(anime)}
                  </span>
                ) : null}
                {formatLabel(anime.format) ? (
                  <span className="rounded-md bg-white/10 px-2.5 py-1 backdrop-blur-sm">
                    {formatLabel(anime.format)}
                  </span>
                ) : null}
                {formatEpisodes(anime.episodes) ? (
                  <span className="rounded-md bg-white/10 px-2.5 py-1 backdrop-blur-sm">
                    {formatEpisodes(anime.episodes)}
                  </span>
                ) : null}
                {statusLabel(anime.status) ? (
                  <span className="rounded-md bg-white/10 px-2.5 py-1 backdrop-blur-sm">
                    {statusLabel(anime.status)}
                  </span>
                ) : null}
              </div>

              <NextEpisodeLabel
                episode={anime.nextEpisode}
                airingAt={anime.nextEpisodeAt}
                className="mt-4 text-xs text-brand-cyan"
              />

              <div className="mt-6 flex flex-wrap items-center gap-3">
                {hasSources ? (
                  <Link
                    to={watchHref}
                    className={cn(
                      buttonVariants({ size: "lg" }),
                      "rounded-full px-6 text-sm font-semibold",
                    )}
                  >
                    <Play className="fill-current" />
                    İzle
                  </Link>
                ) : null}
                <TrailerButton
                  trailerId={anime.trailerId}
                  trailerSite={anime.trailerSite}
                  title={anime.title}
                  variant={hasSources ? "outline" : "default"}
                  className={cn(
                    "rounded-full px-6 text-sm font-semibold",
                    hasSources &&
                      "border-white/20 bg-white/5 text-white hover:bg-white/12 hover:text-white",
                  )}
                />
                {!hasSources && streams[0] ? (
                  <a
                    href={streams[0].url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className={cn(
                      buttonVariants({ variant: "outline", size: "lg" }),
                      "rounded-full border-white/20 bg-white/5 px-6 text-sm text-white hover:bg-white/12 hover:text-white",
                    )}
                  >
                    {streams[0].site}&apos;de izle
                    <ExternalLink />
                  </a>
                ) : null}
                {anime.siteUrl ? (
                  <a
                    href={anime.siteUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-sm font-medium text-white/70 underline-offset-4 transition-colors hover:text-white hover:underline"
                  >
                    AniList kaydı
                  </a>
                ) : null}
              </div>

              {hasSources && resume ? (
                <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-brand-cyan">
                  <RotateCcw className="size-3.5" aria-hidden="true" />
                  Kaldığın yer:{" "}
                  {resume.episode === 0 ? "Tek parça" : `Bölüm ${resume.episode}`}
                  {" · "}
                  {formatClock(resume.position)}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {status === "error" ? (
        <div className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
          <ErrorCard
            title="Detaylar eksik görünebilir"
            message={message}
            onRetry={onRetry}
          />
        </div>
      ) : null}

      <div className="mx-auto w-full max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-12">
          {/* ------------------------------------------------------ Main column */}
          <div className="min-w-0 space-y-12">
            {paragraphs.length > 0 ? (
              <Section icon={<Info className="size-4" />} title="Konu">
                <div className="space-y-3 text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
                  {paragraphs.map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
                </div>
              </Section>
            ) : null}

            {characters.length > 0 ? (
              <Section icon={<Users className="size-4" />} title="Karakterler ve seslendirme">
                <div className="grid gap-3 sm:grid-cols-2">
                  {characters.map((character) => (
                    <div
                      key={character.name}
                      className="flex items-center gap-3 rounded-xl border border-white/8 bg-surface-1/70 p-2.5"
                    >
                      {character.image ? (
                        <img
                          src={character.image}
                          alt={character.name}
                          loading="lazy"
                          className="size-14 shrink-0 rounded-lg object-cover object-top"
                        />
                      ) : (
                        <div className="size-14 shrink-0 rounded-lg bg-white/5" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-sm font-semibold">
                          {character.name}
                        </p>
                        {roleLabel(character.role) ? (
                          <p className="text-[11px] tracking-wide text-brand-bright uppercase">
                            {roleLabel(character.role)}
                          </p>
                        ) : null}
                        {character.voiceActor ? (
                          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                            Ses: {character.voiceActor}
                          </p>
                        ) : null}
                      </div>
                      {character.voiceImage ? (
                        <img
                          src={character.voiceImage}
                          alt={character.voiceActor ?? ""}
                          loading="lazy"
                          className="size-9 shrink-0 rounded-full object-cover"
                        />
                      ) : null}
                    </div>
                  ))}
                </div>
              </Section>
            ) : null}

            {episodes.length > 0 ? (
              <Section
                icon={<Tv className="size-4" />}
                title="Bölümler"
                hint="Bölüm başlıkları ve görselleri yayın platformundan gelir."
              >
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {episodes.map((episode, index) => (
                    <a
                      key={`${episode.url}-${index}`}
                      href={episode.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="group overflow-hidden rounded-xl border border-white/8 bg-surface-1/70 transition-colors hover:border-brand/50"
                    >
                      {episode.thumbnail ? (
                        <img
                          src={episode.thumbnail}
                          alt=""
                          loading="lazy"
                          className="aspect-video w-full object-cover"
                        />
                      ) : (
                        <div className="aspect-video w-full bg-white/[0.04]" />
                      )}
                      <div className="p-2.5">
                        <p className="line-clamp-2 text-xs font-medium transition-colors group-hover:text-brand-bright">
                          {episode.title}
                        </p>
                        {episode.site ? (
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {episode.site}
                          </p>
                        ) : null}
                      </div>
                    </a>
                  ))}
                </div>
              </Section>
            ) : null}

            {relations.length > 0 ? (
              <Section icon={<Tv className="size-4" />} title="İlgili yapımlar">
                <RefGrid items={relations} showRelation />
              </Section>
            ) : null}
          </div>

          {/* ---------------------------------------------------------- Sidebar */}
          <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-white/8 bg-surface-1/70 p-5">
              <h2 className="font-display text-sm font-bold tracking-wide">
                Bilgiler
              </h2>
              <dl className="mt-4 space-y-3 text-sm">
                <InfoRow label="Tür" value={formatLabel(anime.format)} />
                <InfoRow label="Durum" value={statusLabel(anime.status)} />
                <InfoRow
                  label="Bölüm"
                  value={
                    anime.episodes
                      ? `${anime.episodes}${anime.duration ? ` × ${formatDuration(anime.duration)}` : ""}`
                      : undefined
                  }
                />
                <InfoRow label="Sezon" value={releaseWindow(anime)} />
                <InfoRow
                  label="Stüdyo"
                  value={anime.studios.length > 0 ? anime.studios.join(", ") : undefined}
                />
                <InfoRow
                  label="AniList puanı"
                  value={score ? `${score} / 10` : undefined}
                />
                <InfoRow
                  label="Popülerlik"
                  value={formatCount(anime.popularity)}
                />
                <InfoRow label="Favori" value={formatCount(anime.favourites)} />
              </dl>
            </div>

            {anime.nextEpisodeAt ? (
              <div className="rounded-2xl border border-brand/25 bg-brand/8 p-5">
                <h2 className="font-display flex items-center gap-2 text-sm font-bold">
                  <CalendarClock className="size-4 text-brand-bright" />
                  Yayın takvimi
                </h2>
                <p className="mt-3 text-sm text-foreground">
                  Bölüm {anime.nextEpisode} · {formatRelative(anime.nextEpisodeAt)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDateTime(anime.nextEpisodeAt)}
                </p>
              </div>
            ) : null}

            <div className="rounded-2xl border border-white/8 bg-surface-1/70 p-5">
              <h2 className="font-display text-sm font-bold">Nerede izlenir</h2>
              {streams.length > 0 ? (
                <ul className="mt-4 space-y-2">
                  {streams.map((stream) => (
                    <li key={stream.site}>
                      <a
                        href={stream.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5 transition-colors hover:border-brand/50 hover:bg-white/[0.06]"
                      >
                        {stream.icon ? (
                          <img
                            src={stream.icon}
                            alt=""
                            className="size-5 shrink-0 rounded-sm object-contain"
                          />
                        ) : null}
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {stream.site}
                        </span>
                        <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  AniList bu yapım için lisanslı bir yayın platformu bildirmiyor.
                  Yeni bir platform eklendiğinde bu bölüm otomatik güncellenir.
                </p>
              )}
              <p className="mt-4 border-t border-white/6 pt-3 text-[11px] leading-relaxed text-muted-foreground">
                Anime Prime video barındırmaz; bağlantılar lisanslı platformlara
                yönlendirir.
              </p>
            </div>
          </aside>
        </div>

        {/* ---------------------------------------------------- Recommendations */}
        {recommendations.length > 0 ? (
          <div className="mt-16">
            <AnimeRail
              title="Benzer animeler"
              blurb="AniList kullanıcılarının birlikte önerdiği yapımlar."
              items={recommendations.map((item) => refToCard(item))}
              status="ready"
              href="/anime"
            />
          </div>
        ) : null}
      </div>
    </SiteShell>
  );
}

function Section({
  title,
  hint,
  icon,
  children,
}: {
  title: string;
  hint?: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2.5 border-b border-white/6 pb-3">
        {icon ? (
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand/12 text-brand-bright">
            {icon}
          </span>
        ) : null}
        <div>
          <h2 className="font-display text-base font-extrabold sm:text-lg">
            {title}
          </h2>
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
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

function RefGrid({
  items,
  showRelation = false,
}: {
  items: TitleRefView[];
  showRelation?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.anilistId} className="space-y-2">
          <AnimeCard anime={refToCard(item)} />
          {showRelation && relationLabel(item.relationType) ? (
            <p className="text-center text-[11px] tracking-wide text-muted-foreground uppercase">
              {relationLabel(item.relationType)}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function DetailMessage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 px-4 py-24 text-center sm:py-32">
      <h1 className="font-display text-2xl font-extrabold">{title}</h1>
      <p className="text-sm text-muted-foreground">{description}</p>
      <Link
        to="/anime"
        className={cn(buttonVariants({ variant: "outline" }), "rounded-full")}
      >
        Kataloğa dön
      </Link>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="mx-auto w-full max-w-7xl animate-pulse px-4 pt-16 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:gap-8">
        <div className="aspect-[2/3] w-28 rounded-xl bg-white/[0.05] sm:w-40 lg:w-52" />
        <div className="flex-1 space-y-4">
          <div className="h-4 w-24 rounded-full bg-white/[0.05]" />
          <div className="h-10 w-3/4 rounded-lg bg-white/[0.06]" />
          <div className="h-4 w-1/2 rounded-md bg-white/[0.05]" />
          <div className="h-11 w-52 rounded-full bg-white/[0.06]" />
        </div>
      </div>
      <div className="mt-14 grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <div className="h-5 w-32 rounded bg-white/[0.06]" />
          <div className="h-4 w-full rounded bg-white/[0.04]" />
          <div className="h-4 w-full rounded bg-white/[0.04]" />
          <div className="h-4 w-3/4 rounded bg-white/[0.04]" />
        </div>
        <div className="h-64 rounded-2xl bg-white/[0.04]" />
      </div>
    </div>
  );
}
