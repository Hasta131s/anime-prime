import { SourceManager } from "@/components/player/source-manager";
import { VideoPlayer } from "@/components/player/video-player";
import { Panel } from "@/components/site/panel";
import { Container, SiteShell } from "@/components/site/site-shell";
import { CardGridSkeleton, EmptyCard } from "@/components/site/states";
import { Button } from "@/components/ui/button";
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
import { useMutation, useQuery } from "convex/react";
import { ChevronRight, ExternalLink, MonitorPlay } from "lucide-react";
import { useMemo, useRef, useState } from "react";
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
  const sources = useQuery(api.sources.list, valid ? { anilistId } : "skip");
  const recordProgress = useMutation(api.progress.record);
  /** Throttle: the player writes a position at most once every ten seconds. */
  const lastSyncRef = useRef(0);

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
    () =>
      valid && sources && sources.length > 0 ? latestProgressFor(anilistId) : null,
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

  // The account's own position for this episode, so a different device resumes
  // where the last one stopped.
  const serverEntry = useQuery(
    api.progress.forEpisode,
    valid ? { anilistId, episode: activeEpisode } : "skip",
  );

  // Reads the saved position once per episode/source so the player can seek into
  // it on attach without the parent ever re-seeking mid-playback.
  const startAt = useMemo(() => {
    if (!valid || !activeSource) return 0;
    const local = getProgress(anilistId, activeEpisode)?.position ?? 0;
    if (local > 0) return local;
    return serverEntry?.position ?? 0;
  }, [valid, anilistId, activeEpisode, activeSource, restartToken, serverEntry]);

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

  if (!valid) {
    return (
      <SiteShell>
        <Container className="py-24 text-center">
          <h1 className="text-[20px] font-semibold">Geçersiz bağlantı</h1>
          <p className="mt-2 text-[13px] text-muted-foreground">
            Bu adres bir AniList kaydına karşılık gelmiyor.
          </p>
        </Container>
      </SiteShell>
    );
  }

  const loading = animeLoading || sources === undefined;

  if (loading || (!anime && episodes.length === 0)) {
    return (
      <SiteShell>
        <Container className="py-6">
          <div className="aspect-video w-full animate-pulse rounded-[3px] bg-card" />
          <CardGridSkeleton count={6} className="mt-6" />
        </Container>
      </SiteShell>
    );
  }

  const nextEpisode = episodes.find(([episode]) => episode > activeEpisode)?.[0];

  return (
    <SiteShell>
      <Container className="py-6">
        <nav className="mb-3 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
          <Link
            to={`/anime/${anilistId}`}
            className="transition-colors hover:text-primary"
          >
            {anime?.title ?? "Yapım sayfası"}
          </Link>
          <ChevronRight className="size-3" aria-hidden="true" />
          <span className="text-foreground">İzle</span>
        </nav>

        {episodes.length === 0 || !activeSource ? (
          <div className="space-y-5">
            <EmptyCard
              title="Bu yapım için oynatılabilir kaynak yok"
              description="Anime Prime hiçbir siteden akış çekmez. Kaynaklar site yöneticisi tarafından eklenir; eklenene kadar aşağıdaki lisanslı platformlara bakabilirsin."
            >
              <div className="flex flex-wrap justify-center gap-2">
                <Link
                  to={`/anime/${anilistId}`}
                  className="inline-flex h-9 items-center rounded-[3px] border border-border bg-card px-4 text-[13px] font-medium transition-colors hover:bg-accent"
                >
                  Yapım sayfasına dön
                </Link>
                {anime?.streams?.[0] ? (
                  <a
                    href={anime.streams[0].url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex h-9 items-center gap-2 rounded-[3px] bg-primary px-4 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-brand-strong"
                  >
                    {anime.streams[0].site}
                    <ExternalLink className="size-3.5" />
                  </a>
                ) : null}
              </div>
            </EmptyCard>

            <SourceManager anilistId={anilistId} episodeCount={anime?.episodes} />
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
            {/* ---------------------------------------------------- Main column */}
            <div className="min-w-0 space-y-4">
              <div>
                <h1 className="text-[18px] font-semibold text-foreground sm:text-[20px]">
                  {anime?.title}
                </h1>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
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
                onProgress={(position, duration) => {
                  saveProgress(anilistId, activeEpisode, position, duration);
                  const now = Date.now();
                  if (now - lastSyncRef.current < 10_000) return;
                  lastSyncRef.current = now;
                  void recordProgress({
                    anilistId,
                    episode: activeEpisode,
                    position: Math.round(position),
                    duration: Math.round(duration),
                  }).catch(() => undefined);
                }}
                onEnded={() => {
                  clearProgress(anilistId, activeEpisode);
                  void recordProgress({
                    anilistId,
                    episode: activeEpisode,
                    position: 0,
                    duration: 0,
                    completed: true,
                  }).catch(() => undefined);
                  setFinishedEpisode(activeEpisode);
                }}
              />

              <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <MonitorPlay className="size-3.5" aria-hidden="true" />
                  {startAt > 0
                    ? `${formatClock(startAt)} konumundan devam ediliyor`
                    : "İlerlemen bu cihazda saklanır"}
                </span>
                <Button variant="outline" size="sm" onClick={restart}>
                  Baştan başlat
                </Button>
                {finishedEpisode === activeEpisode && nextEpisode !== undefined ? (
                  <Button size="sm" onClick={() => selectEpisode(nextEpisode)}>
                    Sonraki bölüm: {nextEpisode}
                  </Button>
                ) : null}
              </div>

              {episodeSources.length > 1 ? (
                <Panel title="Bu bölümdeki kaynaklar">
                  <div className="flex flex-wrap gap-1.5">
                    {episodeSources.map((source) => (
                      <button
                        key={source.id}
                        type="button"
                        onClick={() => selectSource(source)}
                        className={cn(
                          "rounded-[3px] border px-2.5 py-1.5 text-left text-[11px] transition-colors",
                          source.id === activeSource.id
                            ? "border-primary bg-primary/15 text-foreground"
                            : "border-border bg-background/40 text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <span className="block font-medium">{source.label}</span>
                        <span className="mt-0.5 block opacity-80">
                          {hostLabel(source.url)} · {KIND_LABELS[source.kind]}
                        </span>
                      </button>
                    ))}
                  </div>
                </Panel>
              ) : null}

              <SourceManager anilistId={anilistId} episodeCount={anime?.episodes} />
            </div>

            {/* ------------------------------------------------------- Sidebar */}
            <aside className="space-y-4">
              <Panel title="Bölümler">
                <div className="flex flex-wrap gap-1.5">
                  {episodes.map(([episode]) => (
                    <button
                      key={episode}
                      type="button"
                      onClick={() => selectEpisode(episode)}
                      aria-label={episode === 0 ? "Tek parça" : `Bölüm ${episode}`}
                      className={cn(
                        "flex size-8 items-center justify-center rounded-[3px] border text-[12px] font-medium transition-colors",
                        episode === activeEpisode
                          ? "border-primary bg-primary/15 text-foreground"
                          : "border-border bg-background/40 text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {episode === 0 ? "★" : episode}
                    </button>
                  ))}
                </div>
                {anime?.episodes &&
                anime.episodes >
                  episodes.filter(([episode]) => episode > 0).length ? (
                  <p className="mt-3 border-t border-border pt-2.5 text-[10px] leading-relaxed text-muted-foreground">
                    AniList bu yapım için {anime.episodes} bölüm bildiriyor;{" "}
                    {episodes.filter(([episode]) => episode > 0).length} bölümün
                    kaynağı eklenmiş.
                  </p>
                ) : null}
              </Panel>

              <Panel title="Kaynak bilgisi">
                <dl className="space-y-2 text-[12px]">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">Sunucu</dt>
                    <dd className="truncate font-medium text-foreground">
                      {hostLabel(activeSource.url)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">Biçim</dt>
                    <dd className="font-medium text-foreground">
                      {KIND_LABELS[activeSource.kind]}
                    </dd>
                  </div>
                  {activeSource.language ? (
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-muted-foreground">Sürüm</dt>
                      <dd className="font-medium text-foreground">
                        {activeSource.language}
                      </dd>
                    </div>
                  ) : null}
                </dl>
                {activeSource.note ? (
                  <p className="mt-3 border-t border-border pt-2.5 text-[10px] leading-relaxed text-muted-foreground">
                    {activeSource.note}
                  </p>
                ) : null}
              </Panel>

              {anime?.streams && anime.streams.length > 0 ? (
                <Panel title="Lisanslı platformlar">
                  <ul className="space-y-1.5">
                    {anime.streams.slice(0, 6).map((stream) => (
                      <li key={stream.site}>
                        <a
                          href={stream.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="flex items-center gap-2.5 rounded-[3px] border border-border bg-background/40 px-2.5 py-2 text-[12px] transition-colors hover:border-primary/60"
                        >
                          <span className="min-w-0 flex-1 truncate font-medium">
                            {stream.site}
                          </span>
                          <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </Panel>
              ) : null}

              <p className="rounded-[3px] border border-border bg-card/50 p-3 text-[10px] leading-relaxed text-muted-foreground">
                Oynatıcıdaki akışlar site yöneticisi tarafından sağlanır. Anime
                Prime içerik barındırmaz ve hiçbir siteden akış çekmez; telif
                hakkına sahip olmadığın içeriği ekleme.
              </p>
            </aside>
          </div>
        )}
      </Container>
    </SiteShell>
  );
}
