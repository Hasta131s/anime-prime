import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import { KIND_LABELS, hostLabel, type SourceKind } from "@/convex/sourceView";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  CheckCircle2,
  Info,
  Loader2,
  Lock,
  Plus,
  ShieldPlus,
  Trash2,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useLocation } from "react-router";

/**
 * Source management panel.
 *
 * Only two states are ever rendered for a visitor: the panel for an admin, or
 * the first-run "claim ownership" card while no admin exists. Everyone else
 * sees nothing at all.
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
      setError(
        cause instanceof Error ? cause.message : "İşlem tamamlanamadı.",
      );
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

  // ------------------------------------------------------------- first run
  if (!state.canManage) {
    return (
      <div className="rounded-2xl border border-white/8 bg-surface-1/70 p-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand/12 text-brand-bright">
            <ShieldPlus className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-sm font-bold">
              Kaynak yönetimini devral
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Bu sitede henüz yönetici yok. Oynatılabilir kaynakları yalnızca bir
              yönetici ekleyebilir. E-posta adresini doğrulamış ilk hesap bu
              yetkiyi bir kez devralabilir.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-3">
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
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <Lock className="size-3.5" />
                  E-posta ile giriş yap
                </Link>
              )}
              <span className="text-[11px] text-muted-foreground">
                {state.signedIn
                  ? state.canClaim
                    ? `Hesap: ${state.email ?? "doğrulanmış e-posta"}`
                    : "Hesabın doğrulanmış bir e-posta adresi yok."
                  : "Misafir oturumları yönetici olamaz."}
              </span>
            </div>

            {error ? (
              <p className="mt-3 text-xs text-destructive">{error}</p>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------ admin panel
  return (
    <div className="space-y-5 rounded-2xl border border-brand/25 bg-brand/[0.06] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-sm font-bold">
            Kaynak yönetimi <span className="text-brand-bright">(yönetici)</span>
          </h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
            HLS (`.m3u8`) veya MP4 bağlantısı ekle. Yalnızca yayınlama hakkına
            sahip olduğun içerikleri ekle — Anime Prime video barındırmaz.
          </p>
        </div>
      </div>

      <form onSubmit={handleAdd} className="grid gap-3 lg:grid-cols-12">
        <div className="lg:col-span-2">
          <label className="mb-1.5 block text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            Bölüm
          </label>
          <Input
            value={episode}
            onChange={(event) => setEpisode(event.target.value)}
            inputMode="numeric"
            list="episode-options"
            placeholder="1"
            aria-label="Bölüm numarası"
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
          <label className="mb-1.5 block text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            Başlık
          </label>
          <Input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Bölüm 1 · Türkçe altyazı"
            aria-label="Kaynak başlığı"
          />
        </div>

        <div className="lg:col-span-4">
          <label className="mb-1.5 block text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            Akış adresi
          </label>
          <Input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://ornek.com/bolum1.m3u8"
            type="url"
            required
            aria-label="Akış adresi"
          />
        </div>

        <div className="lg:col-span-3">
          <label className="mb-1.5 block text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            Dil / sürüm
          </label>
          <Input
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            placeholder="Türkçe altyazı"
            aria-label="Dil veya sürüm"
          />
        </div>

        <div className="lg:col-span-9">
          <label className="mb-1.5 block text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            Not (isteğe bağlı)
          </label>
          <Input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Örn. 1080p, altyazı gömülü"
            aria-label="Not"
          />
        </div>

        <div className="flex items-end lg:col-span-3">
          <Button type="submit" className="w-full rounded-xl" disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Kaynağı ekle
          </Button>
        </div>
      </form>

      {error ? (
        <p className="flex items-center gap-2 text-xs text-destructive">
          <Info className="size-3.5" />
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="flex items-center gap-2 text-xs text-emerald-300">
          <CheckCircle2 className="size-3.5" />
          {success}
        </p>
      ) : null}

      {sources && sources.length > 0 ? (
        <ul className="divide-y divide-white/6 overflow-hidden rounded-xl border border-white/8 bg-black/20">
          {sources.map((source) => (
            <li
              key={source.id}
              className="flex flex-wrap items-center gap-3 px-3 py-2.5"
            >
              <span className="rounded-md bg-white/8 px-2 py-0.5 text-[11px] font-semibold">
                {source.episode === 0 ? "Tek parça" : `Bölüm ${source.episode}`}
              </span>
              <span className="min-w-0 flex-1 text-xs">
                <span className="font-medium text-foreground">{source.label}</span>
                <span className="ml-2 text-muted-foreground">
                  {hostLabel(source.url)}
                </span>
              </span>
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase",
                  source.kind === "hls"
                    ? "border-brand/40 text-brand-bright"
                    : "border-white/15 text-muted-foreground",
                )}
              >
                {KIND_LABELS[source.kind as SourceKind]}
              </span>
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
        <p className="text-xs text-muted-foreground">
          Bu yapım için henüz kaynak eklenmemiş. Eklediğin kaynaklar tüm
          ziyaretçilere görünür.
        </p>
      )}
    </div>
  );
}
