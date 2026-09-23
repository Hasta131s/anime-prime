import { Panel, Tag } from "@/components/site/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import { KIND_LABELS, hostLabel, type SourceKind } from "@/convex/sourceView";
import { useMutation, useQuery } from "convex/react";
import {
  CheckCircle2,
  Loader2,
  Lock,
  Plus,
  ShieldPlus,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useLocation } from "react-router";

/**
 * Source management panel.
 *
 * Visitors only ever see one of two states: the editor for an admin, or the
 * first-run ownership card while no admin exists. Everyone else sees nothing.
 */
export function SourceManager({
  anilistId,
  episodeCount,
}: {
  anilistId: number;
  episodeCount?: number;
}) {
  const state = useQuery(api.sources.manageState);
  const sources = useQuery(api.sources.list, { anilistId });
  const addSource = useMutation(api.sources.add);
  const removeSource = useMutation(api.sources.remove);
  const claimAdmin = useMutation(api.sources.claimAdmin);
  const location = useLocation();

  const [episode, setEpisode] = useState("1");
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [language, setLanguage] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();

  if (state === undefined) return null;
  if (!state.canManage && state.adminExists) return null;

  const run = async (action: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setError(undefined);
    setSuccess(undefined);
    try {
      await action();
      setSuccess(done);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "İşlem tamamlanamadı.");
    } finally {
      setBusy(false);
    }
  };

  const handleAdd = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsedEpisode = Number.parseInt(episode, 10);

    void run(
      () =>
        addSource({
          anilistId,
          episode: Number.isFinite(parsedEpisode) ? parsedEpisode : 0,
          label,
          url,
          language: language || undefined,
          note: note || undefined,
        }),
      "Kaynak eklendi.",
    ).then(() => {
      setUrl("");
      setLabel("");
      setNote("");
    });
  };

  // --------------------------------------------------------------- first run
  if (!state.canManage) {
    return (
      <Panel title="Kaynak yönetimi">
        <div className="flex items-start gap-3">
          <ShieldPlus className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-foreground">
              Kaynak yönetimini devral
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
              Bu sitede henüz yönetici yok. Oynatılabilir kaynakları yalnızca bir
              yönetici ekleyebilir; e-posta adresini doğrulamış ilk hesap bu
              yetkiyi bir kez devralabilir.
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {state.signedIn && state.canClaim ? (
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    void run(
                      () => claimAdmin({}),
                      "Yetki verildi. Artık kaynak ekleyebilirsin.",
                    )
                  }
                >
                  {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
                  Yönetici ol ve devral
                </Button>
              ) : (
                <Link
                  to={`/auth?returnTo=${encodeURIComponent(location.pathname)}`}
                  className="inline-flex h-7 items-center gap-2 rounded-[3px] bg-primary px-3 text-[12px] font-medium text-primary-foreground transition-colors hover:bg-brand-strong"
                >
                  <Lock className="size-3.5" />
                  E-posta ile giriş yap
                </Link>
              )}
              <span className="text-[11px] text-muted-foreground">
                {state.signedIn
                  ? state.canClaim
                    ? `Hesap: ${state.email ?? "doğrulanmış e-posta"}`
                    : "Hesabında doğrulanmış e-posta yok."
                  : "Misafir oturumları yönetici olamaz."}
              </span>
            </div>

            {error ? (
              <p className="mt-3 text-[12px] text-destructive">{error}</p>
            ) : null}
          </div>
        </div>
      </Panel>
    );
  }

  // -------------------------------------------------------------- admin view
  return (
    <Panel
      title="Kaynak yönetimi (yönetici)"
      action={
        <span className="text-[10px] text-muted-foreground">
          HLS / MP4 · yalnızca sen ekleyebilirsin
        </span>
      }
      bodyClassName="p-3.5 space-y-3"
    >
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Yalnızca yayınlama hakkına sahip olduğun içerikleri ekle. Anime Prime
        video barındırmaz ve hiçbir siteden akış çekmez.
      </p>

      <form onSubmit={handleAdd} className="grid gap-2 lg:grid-cols-12">
        <div className="lg:col-span-2">
          <label className="stat-label mb-1 block">Bölüm</label>
          <Input
            value={episode}
            onChange={(event) => setEpisode(event.target.value)}
            inputMode="numeric"
            list="episode-options"
            placeholder="1"
            aria-label="Bölüm numarası"
            className="h-9 rounded-[3px] border-input bg-card text-[13px]"
          />
          {episodeCount ? (
            <datalist id="episode-options">
              {Array.from({ length: Math.min(episodeCount, 200) }).map((_, index) => (
                <option key={index + 1} value={index + 1} />
              ))}
            </datalist>
          ) : null}
        </div>

        <div className="lg:col-span-3">
          <label className="stat-label mb-1 block">Başlık</label>
          <Input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Bölüm 1 · Türkçe altyazı"
            aria-label="Kaynak başlığı"
            className="h-9 rounded-[3px] border-input bg-card text-[13px]"
          />
        </div>

        <div className="lg:col-span-4">
          <label className="stat-label mb-1 block">Akış adresi</label>
          <Input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://ornek.com/bolum1.m3u8"
            type="url"
            required
            aria-label="Akış adresi"
            className="h-9 rounded-[3px] border-input bg-card text-[13px]"
          />
        </div>

        <div className="lg:col-span-3">
          <label className="stat-label mb-1 block">Dil / sürüm</label>
          <Input
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            placeholder="Türkçe altyazı"
            aria-label="Dil veya sürüm"
            className="h-9 rounded-[3px] border-input bg-card text-[13px]"
          />
        </div>

        <div className="lg:col-span-9">
          <label className="stat-label mb-1 block">Not (isteğe bağlı)</label>
          <Input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Örn. 1080p, altyazı gömülü"
            aria-label="Not"
            className="h-9 rounded-[3px] border-input bg-card text-[13px]"
          />
        </div>

        <div className="flex items-end lg:col-span-3">
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Kaynağı ekle
          </Button>
        </div>
      </form>

      {error ? (
        <p className="flex items-center gap-2 text-[12px] text-destructive">
          <TriangleAlert className="size-3.5 shrink-0" />
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="flex items-center gap-2 text-[12px] text-brand-live">
          <CheckCircle2 className="size-3.5 shrink-0" />
          {success}
        </p>
      ) : null}

      {sources && sources.length > 0 ? (
        <ul className="divide-y divide-border overflow-hidden rounded-[3px] border border-border">
          {sources.map((source) => (
            <li
              key={source.id}
              className="flex flex-wrap items-center gap-2 px-2.5 py-2"
            >
              <Tag>{source.episode === 0 ? "Tek parça" : `Bölüm ${source.episode}`}</Tag>
              <span className="min-w-0 flex-1 truncate text-[12px]">
                <span className="font-medium text-foreground">{source.label}</span>
                <span className="ml-2 text-muted-foreground">
                  {hostLabel(source.url)}
                </span>
              </span>
              <Tag
                className={
                  source.kind === "hls" ? "text-primary" : "text-muted-foreground"
                }
              >
                {KIND_LABELS[source.kind as SourceKind]}
              </Tag>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Kaynağı sil"
                disabled={busy}
                className="text-muted-foreground hover:text-destructive"
                onClick={() =>
                  void run(() => removeSource({ id: source.id }), "Kaynak silindi.")
                }
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Bu yapım için henüz kaynak yok. Eklediğin kaynaklar tüm ziyaretçilere
          görünür.
        </p>
      )}
    </Panel>
  );
}
