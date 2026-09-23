import { SourceManager } from "@/components/player/source-manager";
import { VideoPlayer } from "@/components/player/video-player";
import { SiteShell } from "@/components/site/site-shell";
import { CardGridSkeleton, EmptyCard } from "@/components/site/states";
import { buttonVariants } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import {
  KIND_LABELS,
  hostLabel,
  type PlaybackSourceView,
} from "@/convex/sourceView";
import { useAnimeDetail } from "@/hooks/use-anime";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { cn } from "@/lib/utils";
import {
  clearProgress,
  formatClock,
  getProgress,
  latestProgressFor,
  saveProgress,
} from "@/lib/watch-progress";
import { useQuery } from "convex/react";
import {
  ArrowLeft,
  ChevronRight,
  ExternalLink,
  Info,
  ListVideo,
  MonitorPlay,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";

export default function Watch() {
  const params = useParams<{ id: string }>();
  const anilistId = Number(params.id);
  const valid = Number.isInteger(anilistId) && anilistId > 0;
  const [searchParams, setSearchParams] = useSearchParams();
  const [restartToken, setRestartToken] = useState(0);
  const [finishedEpisode, setFinishedEpisode] = useState<number | null>(null);

  const { anime, isLoading: animeLoading } = useAnimeDetail(
    valid ? anilistId : 0,
  );
  const sources = useQuery(
    api.sources.list,
    valid ? { anilistId } : "skip",
  );

  useDocumentTitle(anime ? `${anime.title} izle` : "İzle");

  /** Sources grouped by episode, ascending. */
  const episodes = useMemo(() => {
    const grouped = new Map<number, PlaybackSourceView[]>();
    for (const source of sources ?? []) {
      const list = grouped.get(source.episode) ?? [];
      list.push(source);
      grouped.set(source.episode, list);
    }
    return Array.from(grouped.entries()).sort((a, b) => a[0] - b[0]);
  }, [sources]);

  const requestedEpisode = Number(searchParams.get("b"));
  const resume = useMemo(
    () => (valid && sources && sources.length > 0 ? latestProgressFor(anilistId) : null),
    [valid, anilistId, sources],
  );

  const activeEpisode = useMemo(() => {
    if (episodes.length === 0) return 0;
    if (episodes.some(([episode]) => episode === requestedEpisode)) {
      return requestedEpisode;
    }
    if (resume && episodes.some(([episode]) => episode === resume.episode)) {
      return resume.episode;
    }
    return episodes[0][0];
  }, [episodes, requestedEpisode, resume]);

  const episodeSources = useMemo(
    () => episodes.find(([episode]) => episode === activeEpisode)?.[1] ?? [],
    [episodes, activeEpisode],
  );

  const requestedSourceId = searchParams.get("k");
  const activeSource =
    episodeSources.find((source) => source.id === requestedSourceId) ??
    episodeSources[0];

  // Reads the saved position once per episode/source so the player can seek
  // into it on attach without the parent ever re-seeking mid-playback.
  const startAt = useMemo(() => {
    if (!valid || !activeSource) return 0;
    return getProgress(anilistId, activeEpisode)?.position ?? 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valid, anilistId, activeEpisode, activeSource?.id, restartToken]);

  const selectEpisode = (episode: number) => {
    const next = new URLSearchParams(searchParams);
    next.set("b", String(episode));
    next.delete("k");
    setFinishedEpisode(null);
    setSearchParams(next, { replace: true });
  };

  const selectSource = (source: PlaybackSourceView) => {
    const next = new URLSearchParams(searchParams);
    next.set("b", String(source.episode));
    next.set("k", source.id);
    setSearchParams(next, { replace: true });
  };

  const restart = () => {
    clearProgress(anilistId, activeEpisode);
    setFinishedEpisode(null);
    setRestartToken((value) => value + 1);
  };

  // ------------------------------------------------------------ guard rails
  if (!valid) {
    return (
      <SiteShell>
        <div className="mx-auto max-w-xl px-4 py-24 text-center">
          <h1 className="font-display text-2xl font-extrabold">
            Geçersiz bağlantı
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Bu adres bir AniList kaydına karşılık gelmiyor.
          </p>
        </div>
      </SiteShell>
    );
  }

  const loading = animeLoading || sources === undefined;

  if (loading || (!anime && episodes.length === 0)) {
    return (
      <SiteShell>
        <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="aspect-video w-full animate-pulse rounded-2xl bg-white/[0.04]" />
          <div className="mt-6">
            <CardGridSkeleton count={3} />
          </div>
        </div>
      </SiteShell>
    );
  }

  const nextEpisode = episodes.find(([episode]) => episode > activeEpisode)?.[0];

  return (
    <SiteShell>
      <div className="mx-auto w-full max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
        {/* ------------------------------------------------------- Breadcrumb */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Link
            to={`/anime/${anilistId}`}
            className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            {anime?.title ?? "Yapım sayfası"}
          </Link>
          <ChevronRight className="size-3" aria-hidden="true" />
          <span className="text-foreground">İzle</span>
        </div>

        {episodes.length === 0 || !activeSource ? (
          <div className="mt-6 space-y-6">
            <EmptyCard
              title="Bu yapım için oynatılabilir kaynak yok"
              description="Anime Prime hiçbir siteden akış çekmez. Kaynaklar site yöneticisi tarafından eklenir; eklenene kadar aşağıdaki lisanslı platformlardan izleyebilirsin."
            >
              <div className="flex flex-wrap justify-center gap-3">
                <Link
                  to={`/anime/${anilistId}`}
                  className={cn(buttonVariants({ variant: "outline" }), "rounded-full")}
                >
                  Yapım sayfasına dön
                </Link>
                {anime?.streams?.[0] ? (
                  <a
                    href={anime.streams[0].url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className={cn(buttonVariants(), "rounded-full")}
                  >
                    {anime.streams[0].site}&apos;de izle
                    <ExternalLink />
                  </a>
                ) : null}
              </div>
            </EmptyCard>

            <SourceManager
              anilistId={anilistId}
              episodeCount={anime?.episodes}
            />
          </div>
        ) : (
          <div className="mt-5 grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px] xl:gap-10">
            {/* ---------------------------------------------------- Main column */}
            <div className="min-w-0 space-y-5">
              <div>
                <h1 className="font-display text-xl font-extrabold sm:text-2xl">
                  {anime?.title}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {activeEpisode === 0 ? "Tek parça" : `Bölüm ${activeEpisode}`}
                  {" · "}
                  {activeSource.label}
                  {activeSource.language ? ` · ${activeSource.language}` : ""}
                </p>
              </div>

              <VideoPlayer
                key={`${activeSource.id}:${restartToken}`}
                url={activeSource.url}
                kind={activeSource.kind}
                title={anime?.title ?? "Anime"}
                subtitle={`${hostLabel(activeSource.url)} · ${KIND_LABELS[activeSource.kind]}`}
                poster={anime?.banner ?? anime?.cover}
                startAt={startAt}
                onProgress={(position, duration) =>
                  saveProgress(anilistId, activeEpisode, position, duration)
                }
                onEnded={() => {
                  clearProgress(anilistId, activeEpisode);
                  setFinishedEpisode(activeEpisode);
                }}
              />

              {/* progress / restart row */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                {startAt > 0 ? (
                  <span className="inline-flex items-center gap-1.5">
                    <RotateCcw className="size-3.5" />
                    {formatClock(startAt)} konumundan devam ediliyor
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    <MonitorPlay className="size-3.5" />
                    İlerlemen bu cihazda saklanır
                  </span>
                )}
                <button
                  type="button"
                  onClick={restart}
                  className="rounded-full border border-white/10 px-3 py-1 font-medium text-foreground transition-colors hover:border-brand/50"
                >
                  Baştan başlat
                </button>
                {finishedEpisode === activeEpisode && nextEpisode !== undefined ? (
                  <button
                    type="button"
                    onClick={() => selectEpisode(nextEpisode)}
                    className="rounded-full bg-brand px-3 py-1 font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    Sonraki bölüm: {nextEpisode}
                  </button>
                ) : null}
              </div>

              {/* source switcher */}
              {episodeSources.length > 1 ? (
                <div className="rounded-2xl border border-white/8 bg-surface-1/70 p-4">
                  <h2 className="font-display text-sm font-bold">
                    Bu bölümdeki kaynaklar
                  </h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {episodeSources.map((source) => (
                      <button
                        key={source.id}
                        type="button"
                        onClick={() => selectSource(source)}
                        className={cn(
                          "rounded-xl border px-3 py-2 text-left text-xs transition-colors",
                          source.id === activeSource.id
                            ? "border-brand/60 bg-brand/12 text-foreground"
                            : "border-white/10 bg-white/[0.03] text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <span className="block font-semibold">{source.label}</span>
                        <span className="mt-0.5 block text-[11px] opacity-80">
                          {hostLabel(source.url)} · {KIND_LABELS[source.kind]}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <SourceManager
                anilistId={anilistId}
                episodeCount={anime?.episodes}
              />
            </div>

            {/* ------------------------------------------------------- Sidebar */}
            <aside className="space-y-6">
              <div className="rounded-2xl border border-white/8 bg-surface-1/70 p-5">
                <h2 className="font-display flex items-center gap-2 text-sm font-bold">
                  <ListVideo className="size-4 text-brand-bright" />
                  Bölümler
                </h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {episodes.map(([episode]) => (
                    <button
                      key={episode}
                      type="button"
                      onClick={() => selectEpisode(episode)}
                      className={cn(
                        "flex size-9 items-center justify-center rounded-lg border text-xs font-semibold transition-colors",
                        episode === activeEpisode
                          ? "border-brand/60 bg-brand/18 text-foreground"
                          : "border-white/10 bg-white/[0.03] text-muted-foreground hover:text-foreground",
                      )}
                      aria-label={
                        episode === 0 ? "Tek parça" : `Bölüm ${episode}`
                      }
                    >
                      {episode === 0 ? "★" : episode}
                    </button>
                  ))}
                </div>
                {anime?.episodes &&
                anime.episodes > episodes.filter(([episode]) => episode > 0).length ? (
                  <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                    AniList bu yapım için {anime.episodes} bölüm bildiriyor;{" "}
                    {episodes.filter(([episode]) => episode > 0).length} bölümün
                    kaynağı eklenmiş.
                  </p>
                ) : null}
              </div>

              <div className="rounded-2xl border border-white/8 bg-surface-1/70 p-5">
                <h2 className="font-display text-sm font-bold">Kaynak bilgisi</h2>
                <dl className="mt-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">Sunucu</dt>
                    <dd className="truncate font-medium">
                      {hostLabel(activeSource.url)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">Biçim</dt>
                    <dd className="font-medium">{KIND_LABELS[activeSource.kind]}</dd>
                  </div>
                  {activeSource.language ? (
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-muted-foreground">Sürüm</dt>
                      <dd className="font-medium">{activeSource.language}</dd>
                    </div>
                  ) : null}
                </dl>
                {activeSource.note ? (
                  <p className="mt-3 flex items-start gap-2 border-t border-white/6 pt-3 text-[11px] leading-relaxed text-muted-foreground">
                    <Info className="mt-0.5 size-3.5 shrink-0" />
                    {activeSource.note}
                  </p>
                ) : null}
              </div>

              {anime?.streams && anime.streams.length > 0 ? (
                <div className="rounded-2xl border border-white/8 bg-surface-1/70 p-5">
                  <h2 className="font-display text-sm font-bold">
                    Lisanslı platformlar
                  </h2>
                  <ul className="mt-3 space-y-2">
                    {anime.streams.slice(0, 6).map((stream) => (
                      <li key={stream.site}>
                        <a
                          href={stream.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="flex items-center gap-2.5 rounded-lg border border-white/8 px-3 py-2 text-xs transition-colors hover:border-brand/50"
                        >
                          <span className="min-w-0 flex-1 truncate font-medium">
                            {stream.site}
                          </span>
                          <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <p className="flex items-start gap-2 rounded-2xl border border-white/8 bg-white/[0.02] p-4 text-[11px] leading-relaxed text-muted-foreground">
                <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
                Oynatıcıdaki akışlar site yöneticisi tarafından sağlanır. Anime
                Prime içerik barındırmaz ve hiçbir siteden akış çekmez; telif
                hakkına sahip olmadığın içeriği ekleme.
              </p>
            </aside>
          </div>
        )}
      </div>
    </SiteShell>
  );
}
