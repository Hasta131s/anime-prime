/**
 * Public profile + the customisation editor.
 *
 * A profile is assembled from the account row (name, avatar, role) plus the
 * optional customisation row, so even an untouched account renders coherently.
 * Favourites, watch history and recent comments all come from real stored data.
 */

import { AnimeCard } from "@/components/site/anime-card";
import { Panel, StatStrip } from "@/components/site/panel";
import { Container, SiteShell } from "@/components/site/site-shell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  CHARACTER_SEARCH_MIN,
  MAX_BIO,
  MAX_DISPLAY_NAME,
  MAX_FAVORITES,
  MAX_TAGLINE,
  USERNAME_MAX,
  communityRoleLabel,
  initialsFor,
  normalizeUsername,
  usernameCooldownDaysLeft,
  usernameError,
  type CharacterPick,
  type CommentView,
  type ProfileResult,
  type ProfileView,
  type WatchEntryView,
} from "@/convex/communityView";
import { useAuth } from "@/hooks/use-auth";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useRemoteSearch } from "@/hooks/use-anime";
import { formatClock } from "@/lib/watch-progress";
import { formatDateTime, formatRelative, genreLabel } from "@/lib/anime-labels";
import { cn } from "@/lib/utils";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  CalendarDays,
  Clock,
  ImagePlus,
  Loader2,
  Lock,
  MapPin,
  Pencil,
  Search,
  Sparkles,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";

export default function Profile() {
  const { userId } = useParams<{ userId?: string }>();
  const { user, isLoading: authLoading } = useAuth();
  const targetId = userId ?? user?._id;
  const result = useQuery(
    api.profiles.detail,
    targetId ? { userId: targetId } : "skip",
  );
  useDocumentTitle(result?.profile?.displayName ?? "Profil");

  if (authLoading || result === undefined) {
    return (
      <SiteShell>
        <Container className="flex items-center justify-center gap-2 py-24 text-[13px] text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Profil yükleniyor…
        </Container>
      </SiteShell>
    );
  }

  if (!result.profile) {
    return (
      <SiteShell>
        <Container className="py-24 text-center">
          <h1 className="text-[20px] font-semibold text-foreground">
            Profil bulunamadı
          </h1>
          <p className="mt-2 text-[13px] text-muted-foreground">
            Bu hesap silinmiş ya da hiç var olmamış olabilir.
          </p>
        </Container>
      </SiteShell>
    );
  }

  const profile = result.profile;
  const banner =
    result.favorites.find((card) => card.anilistId === profile.bannerAnilistId) ??
    result.favorites[0];

  return (
    <SiteShell>
      <ProfileHeader profile={profile} banner={banner} stats={result.stats} />

      <Container className="space-y-6 py-6">
        {result.restricted ? (
          <Panel>
            <div className="flex items-start gap-3">
              <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-[13px] font-medium text-foreground">
                  Bu profil gizli
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                  {profile.displayName} profilini yalnızca kendisi görebilecek
                  şekilde ayarlamış.
                </p>
              </div>
            </div>
          </Panel>
        ) : (
          <>
            <Panel
              title={`Favori animeler (${profile.favoriteAnimeIds.length}/${MAX_FAVORITES})`}
              action={
                profile.isMe ? (
                  <span className="text-[10px] text-muted-foreground">
                    Profili düzenle ile seç
                  </span>
                ) : null
              }
            >
              {result.favorites.length > 0 ? (
                <div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                  {result.favorites.map((card) => (
                    <AnimeCard key={card.anilistId} anime={card} />
                  ))}
                </div>
              ) : (
                <p className="text-[12px] text-muted-foreground">
                  {profile.isMe
                    ? "Henüz favori eklemedin. Profili düzenle'den ara ve seç."
                    : "Bu üyenin henüz favori animasyonu yok."}
                </p>
              )}
            </Panel>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <Panel
                title={`Son izlenenler (${result.stats.episodes} bölüm)`}
                bodyClassName="p-0"
              >
                {result.history.length > 0 ? (
                  <ul className="divide-y divide-border">
                    {result.history.map((entry) => (
                      <HistoryRow
                        key={`${entry.anilistId}:${entry.episode}`}
                        entry={entry}
                      />
                    ))}
                  </ul>
                ) : (
                  <p className="p-3.5 text-[12px] text-muted-foreground">
                    {profile.isMe
                      ? "İzleme geçmişin boş. Bir bölüm izlediğinde burada görünür."
                      : "Bu üyenin kayıtlı izleme geçmişi yok."}
                  </p>
                )}
              </Panel>

              <div className="space-y-4">
                <Panel title="Hakkında">
                  <dl className="space-y-2 text-[12px]">
                    {profile.tagline ? (
                      <p className="text-[12px] leading-relaxed text-foreground/90">
                        {profile.tagline}
                      </p>
                    ) : null}
                    {profile.bio ? (
                      <p className="whitespace-pre-wrap border-t border-border pt-2 text-[12px] leading-relaxed text-muted-foreground">
                        {profile.bio}
                      </p>
                    ) : null}
                    {profile.favoriteGenre ? (
                      <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
                        <dt className="text-muted-foreground">Favori tür</dt>
                        <dd className="font-medium text-foreground">
                          {genreLabel(profile.favoriteGenre)}
                        </dd>
                      </div>
                    ) : null}
                    {profile.location ? (
                      <div className="flex items-center justify-between gap-3">
                        <dt className="flex items-center gap-1.5 text-muted-foreground">
                          <MapPin className="size-3" /> Konum
                        </dt>
                        <dd className="font-medium text-foreground">
                          {profile.location}
                        </dd>
                      </div>
                    ) : null}
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-muted-foreground">Katılım</dt>
                      <dd className="font-medium text-foreground">
                        {formatDateTime(profile.joinedAt, false)}
                      </dd>
                    </div>
                  </dl>
                  {profile.website ? (
                    <a
                      href={profile.website}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mt-3 block truncate border-t border-border pt-2.5 text-[12px] font-medium text-primary hover:underline"
                    >
                      {profile.website}
                    </a>
                  ) : null}
                </Panel>

                <ProfileCharacterPanel profile={profile} />

                <Panel
                  title="Son yorumlar"
                  action={
                    <span className="text-[10px] text-muted-foreground">
                      {result.stats.comments} yorum
                    </span>
                  }
                >
                  {result.comments.length > 0 ? (
                    <ul className="space-y-2.5">
                      {result.comments.map((comment) => (
                        <ProfileComment key={comment.id} comment={comment} />
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[12px] text-muted-foreground">
                      Henüz yorum yazılmamış.
                    </p>
                  )}
                </Panel>
              </div>
            </div>
          </>
        )}
      </Container>
    </SiteShell>
  );
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function ProfileHeader({
  profile,
  banner,
  stats,
}: {
  profile: ProfileView;
  banner?: ProfileResult["favorites"][number];
  stats: ProfileResult["stats"];
}) {
  // A gallery upload wins over the auto banner taken from a favourite anime.
  const hero = profile.bannerUrl ?? banner?.banner ?? banner?.cover;

  return (
    <section className="border-b border-border">
      <div className="relative h-[140px] w-full overflow-hidden sm:h-[180px] lg:h-[200px]">
        {hero ? (
          <img
            src={hero}
            alt=""
            aria-hidden="true"
            className="size-full object-cover object-center"
          />
        ) : (
          <div className="size-full bg-secondary" />
        )}
        <div className="absolute inset-0 bg-linear-to-t from-background via-background/75 to-background/25" />
      </div>

      <Container>
        <div className="-mt-[72px] flex flex-col gap-4 pb-5 sm:-mt-[92px] sm:flex-row sm:items-end sm:gap-6">
          <ProfilePortrait profile={profile} />

          <div className="min-w-0 flex-1 sm:pb-1">
            <h1 className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[20px] font-bold text-foreground sm:text-[26px]">
              {profile.displayName}
              {communityRoleLabel(profile.role) ? (
                <span className="rounded-[2px] bg-primary/15 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                  {communityRoleLabel(profile.role)}
                </span>
              ) : null}
              {profile.banned ? (
                <span className="inline-flex items-center gap-1 rounded-[2px] bg-destructive/15 px-1.5 py-0.5 text-[11px] font-medium text-destructive">
                  <TriangleAlert className="size-3" />
                  Askıda
                </span>
              ) : null}
            </h1>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-muted-foreground">
              {profile.handle ? <span>@{profile.handle}</span> : null}
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="size-3" />
                {formatRelative(profile.joinedAt)}
              </span>
              {profile.isAnonymous ? <span>Misafir oturumu</span> : null}
            </p>
          </div>

          {profile.isMe ? <ProfileEditor profile={profile} /> : null}
        </div>

        <StatStrip
          className="mb-5"
          stats={[
            { label: "İzlenen anime", value: stats.titles, tone: "text-primary" },
            { label: "İzlenen bölüm", value: stats.episodes },
            { label: "Favori", value: stats.favorites },
            { label: "Yorum", value: stats.comments },
          ]}
        />
      </Container>
    </section>
  );
}

/**
 * Square identity block.
 *
 * The frame is an `aspect-square` box with an absolutely positioned image
 * inside, so the avatar is always exactly as tall as it is wide — an uploaded
 * 3:4 photo or the character art is cropped into that square instead of
 * stretching it into a rectangle.
 */
function ProfilePortrait({ profile }: { profile: ProfileView }) {
  const uploaded = profile.avatarUrl;
  const portrait = uploaded ?? profile.characterImage ?? profile.image;
  const frame =
    "relative block aspect-square w-[120px] shrink-0 overflow-hidden rounded-[3px] border-2 border-background bg-secondary shadow-xl shadow-black/40 sm:w-[156px]";

  if (portrait) {
    return (
      <span className={frame}>
        <img
          src={portrait}
          alt={profile.characterName ?? profile.displayName}
          className={cn(
            "absolute inset-0 size-full object-cover",
            uploaded ? "object-center" : "object-top",
          )}
        />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        frame,
        "flex items-center justify-center text-[34px] font-bold text-muted-foreground sm:text-[44px]",
      )}
    >
      {initialsFor(profile.displayName)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// History / comments
// ---------------------------------------------------------------------------

function HistoryRow({ entry }: { entry: WatchEntryView }) {
  const percent =
    entry.duration > 0
      ? Math.min(100, Math.round((entry.position / entry.duration) * 100))
      : 0;

  const label = entry.anime?.title ?? `AniList #${entry.anilistId}`;

  return (
    <li className="flex items-center gap-3 p-3">
      <Link
        to={`/anime/${entry.anilistId}`}
        className="w-10 shrink-0 overflow-hidden rounded-[2px] border border-border"
      >
        {entry.anime?.cover ? (
          <img src={entry.anime.cover} alt="" loading="lazy" className="aspect-[2/3] w-full object-cover" />
        ) : (
          <div className="aspect-[2/3] w-full bg-accent" />
        )}
      </Link>

      <div className="min-w-0 flex-1">
        <Link
          to={`/anime/${entry.anilistId}/izle`}
          className="line-clamp-1 text-[13px] font-medium text-foreground transition-colors hover:text-primary"
        >
          {label}
        </Link>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
          <span>{entry.episode === 0 ? "Tek parça" : `Bölüm ${entry.episode}`}</span>
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3" />
            {formatClock(entry.position)}
          </span>
          <span>{formatRelative(entry.watchedAt)}</span>
        </p>
        {entry.duration > 0 ? (
          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-accent">
            <div
              className={cn("h-full", entry.completed ? "bg-brand-live" : "bg-primary")}
              style={{ width: `${Math.max(percent, 2)}%` }}
            />
          </div>
        ) : null}
      </div>
    </li>
  );
}

function ProfileComment({ comment }: { comment: CommentView }) {
  return (
    <li className="rounded-[3px] border border-border bg-background/40 p-2.5">
      <Link
        to={`/anime/${comment.anilistId}#yorumlar`}
        className="text-[11px] font-medium text-primary hover:underline"
      >
        Yapıma git
      </Link>
      {comment.deleted ? (
        <p className="mt-1 text-[12px] italic text-muted-foreground">
          Bu yorum silindi.
        </p>
      ) : (
        <p className="mt-1 line-clamp-3 text-[12px] leading-relaxed text-foreground/90">
          {comment.spoiler ? (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <TriangleAlert className="size-3" />
              Spoiler içeriyor
            </span>
          ) : (
            comment.body
          )}
        </p>
      )}
      <p className="mt-1 text-[10px] text-muted-foreground">
        {formatRelative(comment.createdAt)}
      </p>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------

function ProfileEditor({ profile }: { profile: ProfileView }) {
  const update = useMutation(api.profiles.update);
  const toggleFavorite = useMutation(api.profiles.toggleFavorite);
  const setBanner = useMutation(api.profiles.setBanner);
  const setCoverImage = useMutation(api.profiles.setCoverImage);

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [term, setTerm] = useState("");

  const [displayName, setDisplayName] = useState(profile.displayName);
  const [tagline, setTagline] = useState(profile.tagline ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [location, setLocation] = useState(profile.location ?? "");
  const [website, setWebsite] = useState(profile.website ?? "");
  const [favoriteGenre, setFavoriteGenre] = useState(profile.favoriteGenre ?? "");
  const [isPublic, setIsPublic] = useState(profile.isPublic);

  const search = useRemoteSearch(term, 2);
  const me = useQuery(api.profiles.me);
  const favorites = me?.favorites ?? [];
  const favoriteIds = new Set(favorites.map((card) => card.anilistId));

  // Seed the form each time the dialog opens so edits never leak between opens.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return;
    setDisplayName(profile.displayName);
    setTagline(profile.tagline ?? "");
    setBio(profile.bio ?? "");
    setLocation(profile.location ?? "");
    setWebsite(profile.website ?? "");
    setFavoriteGenre(profile.favoriteGenre ?? "");
    setIsPublic(profile.isPublic);
  }, [open]);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    try {
      await update({
        displayName,
        tagline,
        bio,
        location,
        website,
        favoriteGenre,
        isPublic,
      });
      toast.success("Profilin güncellendi.");
      setOpen(false);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Profil kaydedilemedi.");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (anilistId: number) => {
    try {
      const result = await toggleFavorite({ anilistId });
      toast.success(
        result.favorite ? "Favorilere eklendi." : "Favorilerden çıkarıldı.",
      );
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "İşlem tamamlanamadı.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" onClick={() => setOpen(true)} className="shrink-0">
        <Pencil className="size-4" />
        Profili düzenle
      </Button>

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Profili düzenle</DialogTitle>
          <DialogDescription>
            Görünen adını, imzanı ve favori animelerini buradan yönet.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={save} className="space-y-4">
          <UsernameField profile={profile} />

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Görünen ad">
              <Input
                value={displayName}
                maxLength={MAX_DISPLAY_NAME}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Örn. Sakura"
              />
            </Field>
            <Field label="Favori tür">
              <Input
                value={favoriteGenre}
                onChange={(event) => setFavoriteGenre(event.target.value)}
                placeholder="Örn. Action veya Aksiyon"
              />
            </Field>
          </div>

          <Field label="Kısa imza" hint={`${tagline.length}/${MAX_TAGLINE}`}>
            <Input
              value={tagline}
              maxLength={MAX_TAGLINE}
              onChange={(event) => setTagline(event.target.value)}
              placeholder="Tek cümlelik imza"
            />
          </Field>

          <Field label="Hakkında" hint={`${bio.length}/${MAX_BIO}`}>
            <textarea
              value={bio}
              maxLength={MAX_BIO}
              rows={3}
              onChange={(event) => setBio(event.target.value)}
              className="w-full resize-y rounded-[3px] border border-input bg-background/50 px-3 py-2 text-[13px] outline-none focus:border-primary"
              placeholder="Kendinden bahset"
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Konum">
              <Input
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="İstanbul"
              />
            </Field>
            <Field label="Web sitesi">
              <Input
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
                placeholder="ornek.com"
              />
            </Field>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-[12px] text-muted-foreground">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(event) => setIsPublic(event.target.checked)}
              className="size-3.5 accent-primary"
            />
            Profilim herkese açık olsun
          </label>

          <CharacterPicker />

          <ProfileImages profile={profile} />

          {/* -------------------------------------------------- favorites */}
          <div className="border-t border-border pt-4">
            <p className="stat-label">
              Favori animeler ({favoriteIds.size}/{MAX_FAVORITES})
            </p>

            {favorites.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {favorites.map((card) => (
                  <span
                    key={card.anilistId}
                    className="flex items-center gap-2 rounded-[3px] border border-border bg-background/40 p-1 pr-2"
                  >
                    {card.cover ? (
                      <img src={card.cover} alt="" className="size-8 rounded-[2px] object-cover" />
                    ) : (
                      <span className="size-8 rounded-[2px] bg-accent" />
                    )}
                    <span className="max-w-[140px] truncate text-[11px] font-medium">
                      {card.title}
                    </span>
                    <button
                      type="button"
                      aria-label="Banner yap"
                      title="Banner yap"
                      onClick={() => {
                        // A favourite banner replaces any uploaded banner image.
                        void setCoverImage({ storageId: null })
                          .then(() => setBanner({ anilistId: card.anilistId }))
                          .catch((cause) =>
                            toast.error(
                              cause instanceof Error
                                ? cause.message
                                : "Banner ayarlanamadı.",
                            ),
                          );
                      }}
                      className="text-[10px] text-muted-foreground transition-colors hover:text-primary"
                    >
                      banner
                    </button>
                    <button
                      type="button"
                      aria-label="Favoriden çıkar"
                      onClick={() => void toggle(card.anilistId)}
                      className="text-muted-foreground transition-colors hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Henüz favori yok. Aşağıdan ara ve ekle.
              </p>
            )}

            <div className="relative mt-3">
              <Search
                className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="Anime ara ve favorilere ekle"
                className="pl-9"
              />
            </div>

            {search.isSearching ? (
              <p className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                Katalogda aranıyor…
              </p>
            ) : null}

            {term.trim().length >= 2 && !search.isSearching ? (
              <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                {search.items.slice(0, 8).map((card) => {
                  const added = favoriteIds.has(card.anilistId);
                  return (
                    <li key={card.anilistId}>
                      <button
                        type="button"
                        onClick={() => void toggle(card.anilistId)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-[3px] border p-1.5 text-left transition-colors",
                          added
                            ? "border-primary bg-primary/10"
                            : "border-border bg-background/40 hover:border-primary/60",
                        )}
                      >
                        {card.cover ? (
                          <img src={card.cover} alt="" className="size-9 rounded-[2px] object-cover" />
                        ) : (
                          <span className="size-9 rounded-[2px] bg-accent" />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-1 text-[11px] font-medium">
                            {card.title}
                          </span>
                          <span className="block text-[10px] text-muted-foreground">
                            {added ? "Favorilerde · kaldır" : "Ekle"}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
                {search.items.length === 0 ? (
                  <li className="text-[11px] text-muted-foreground">
                    Sonuç bulunamadı.
                  </li>
                ) : null}
              </ul>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Vazgeç
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Kaydet
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The member's own @username.
 *
 * Availability is checked live against the server so the member sees "alınmış"
 * before they try to save, and a rename is only allowed once every two weeks —
 * the very first claim is always free.
 */
function UsernameField({ profile }: { profile: ProfileView }) {
  const setUsername = useMutation(api.profiles.setUsername);

  const [value, setValue] = useState(profile.username ?? "");
  const [busy, setBusy] = useState(false);

  // Keep the input in sync when the profile row changes elsewhere.
  useEffect(() => {
    setValue(profile.username ?? "");
  }, [profile.username]);

  const current = profile.username ?? "";
  const normalized = normalizeUsername(value);
  const changed = normalized !== current;
  const daysLeft = profile.usernameChangeAt
    ? usernameCooldownDaysLeft(profile.usernameChangeAt)
    : 0;
  const locked = Boolean(current) && daysLeft > 0;

  const check = useQuery(
    api.profiles.usernameAvailable,
    changed && normalized.length > 0 ? { username: normalized } : "skip",
  );

  const save = async () => {
    setBusy(true);
    try {
      const saved = await setUsername({ username: normalized });
      toast.success(`Kullanıcı adın @${saved} olarak kaydedildi.`);
      setValue(saved);
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Kullanıcı adı kaydedilemedi.",
      );
    } finally {
      setBusy(false);
    }
  };

  const hint = !changed
    ? current
      ? locked
        ? `Kullanıcı adını 2 haftada bir değiştirebilirsin. ${daysLeft} gün sonra tekrar dene.`
        : "Kullanıcı adını 2 haftada bir değiştirebilirsin."
      : "Herkesin kendine ait bir kullanıcı adı var; ilk seçimin hemen geçerli olur."
    : check === undefined
      ? "Kullanılabilirlik kontrol ediliyor…"
      : check === "ok"
        ? "Bu kullanıcı adı uygun."
        : check === "taken"
          ? "Bu kullanıcı adı başkası tarafından kullanılıyor."
          : check === "reserved"
            ? "Bu kullanıcı adı siteye ayrılmış."
            : (usernameError(normalized) ?? "Geçersiz kullanıcı adı.");

  const tone =
    changed && check === "ok"
      ? "text-emerald-400"
      : changed && (check === "taken" || check === "reserved" || check === "invalid")
        ? "text-destructive"
        : "text-muted-foreground";

  return (
    <div className="rounded-[3px] border border-border bg-background/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex min-w-0 flex-1 items-center rounded-[3px] border border-input bg-background/50 pl-2.5 focus-within:border-primary">
          <span className="text-[13px] text-muted-foreground">@</span>
          <input
            value={value}
            disabled={locked || busy}
            maxLength={USERNAME_MAX}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            onChange={(event) => setValue(event.target.value)}
            placeholder="kullanici_adi"
            className="min-w-0 flex-1 bg-transparent px-1.5 py-2 text-[13px] outline-none disabled:opacity-60"
          />
        </span>
        <Button
          type="button"
          size="sm"
          disabled={!changed || locked || busy || check !== "ok"}
          onClick={() => void save()}
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
          {current ? "Değiştir" : "Al"}
        </Button>
      </div>
      <p className={cn("mt-1.5 text-[11px] leading-relaxed", tone)}>{hint}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gallery images
// ---------------------------------------------------------------------------

/** Uploads a picked file to Convex file storage and returns its storage id. */
async function uploadImage(
  uploadUrl: string,
  file: File,
): Promise<Id<"_storage">> {
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!response.ok) throw new Error("Görsel yüklenemedi, tekrar dene.");
  const { storageId } = (await response.json()) as { storageId: string };
  return storageId as Id<"_storage">;
}

/**
 * Profile photo + banner uploads straight from the device gallery.
 * Images live in Convex file storage; the profile only keeps the id, and an
 * upload always wins over the character portrait and the anime banner.
 */
function ProfileImages({ profile }: { profile: ProfileView }) {
  const generateUploadUrl = useMutation(api.profiles.generateUploadUrl);
  const setAvatar = useMutation(api.profiles.setAvatar);
  const setCoverImage = useMutation(api.profiles.setCoverImage);

  const [busy, setBusy] = useState<"avatar" | "banner" | null>(null);

  const pick = async (file: File, target: "avatar" | "banner") => {
    if (!file.type.startsWith("image/")) {
      toast.error("Yalnızca görsel dosyası yükleyebilirsin.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Görsel en fazla 8 MB olabilir.");
      return;
    }

    setBusy(target);
    try {
      const uploadUrl = await generateUploadUrl();
      const storageId = await uploadImage(uploadUrl, file);
      if (target === "avatar") {
        await setAvatar({ storageId });
        toast.success("Profil fotoğrafın güncellendi.");
      } else {
        await setCoverImage({ storageId });
        toast.success("Bannerın güncellendi.");
      }
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Görsel yüklenemedi.");
    } finally {
      setBusy(null);
    }
  };

  const clear = async (target: "avatar" | "banner") => {
    try {
      if (target === "avatar") await setAvatar({ storageId: null });
      else await setCoverImage({ storageId: null });
      toast.success("Görsel kaldırıldı.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Kaldırılamadı.");
    }
  };

  return (
    <div className="border-t border-border pt-4">
      <p className="stat-label">Görseller</p>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
        Galerinden kendi profil fotoğrafını ve banner görselini seç. Yükleme
        yapmazsan profilinde seçtiğin karakter ve favori animen görünür.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <ImageSlot
          title="Profil fotoğrafı"
          hint="Kare olarak kırpılır"
          square
          current={profile.avatarUrl ?? profile.characterImage ?? profile.image}
          busy={busy === "avatar"}
          canClear={Boolean(profile.avatarUrl)}
          onPick={(file) => void pick(file, "avatar")}
          onClear={() => void clear("avatar")}
        />
        <ImageSlot
          title="Banner"
          hint="Geniş görsel önerilir"
          current={profile.bannerUrl}
          busy={busy === "banner"}
          canClear={Boolean(profile.bannerUrl)}
          onPick={(file) => void pick(file, "banner")}
          onClear={() => void clear("banner")}
        />
      </div>
    </div>
  );
}

/** One upload tile: preview, "galeriden seç" and an optional remove action. */
function ImageSlot({
  title,
  hint,
  current,
  busy,
  square,
  canClear,
  onPick,
  onClear,
}: {
  title: string;
  hint: string;
  current?: string;
  busy: boolean;
  square?: boolean;
  canClear: boolean;
  onPick: (file: File) => void;
  onClear: () => void;
}) {
  return (
    <div className="rounded-[3px] border border-border bg-background/40 p-2.5">
      <p className="text-[11px] font-medium text-foreground">{title}</p>
      <p className="text-[10px] text-muted-foreground">{hint}</p>

      <div className="mt-2 flex items-center gap-2.5">
        <span
          className={cn(
            "relative shrink-0 overflow-hidden rounded-[2px] border border-border bg-secondary",
            square ? "size-14" : "h-14 w-24",
          )}
        >
          {current ? (
            <img src={current} alt="" className="size-full object-cover" />
          ) : null}
        </span>

        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <label
            className={cn(
              "inline-flex cursor-pointer items-center gap-1.5 rounded-[3px] border border-border px-2.5 py-1.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground",
              busy && "pointer-events-none opacity-60",
            )}
          >
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) onPick(file);
              }}
            />
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <ImagePlus className="size-3.5" />
            )}
            Galeriden seç
          </label>

          {canClear ? (
            <button
              type="button"
              onClick={onClear}
              className="text-[11px] text-muted-foreground transition-colors hover:text-destructive"
            >
              Kaldır
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Profile character
// ---------------------------------------------------------------------------

/** Shows the character a member chose to represent their profile. */
function ProfileCharacterPanel({ profile }: { profile: ProfileView }) {
  if (!profile.characterName) return null;

  return (
    <Panel title="Profil karakteri">
      <div className="flex items-center gap-3">
        {profile.characterImage ? (
          <img
            src={profile.characterImage}
            alt={profile.characterName}
            className="size-16 shrink-0 rounded-[3px] border border-border object-cover object-top"
          />
        ) : (
          <span className="size-16 shrink-0 rounded-[3px] bg-accent" />
        )}
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-foreground">
            {profile.characterName}
          </p>
          {profile.characterMediaTitle ? (
            profile.characterMediaAnilistId ? (
              <Link
                to={`/anime/${profile.characterMediaAnilistId}`}
                className="block truncate text-[11px] text-primary hover:underline"
              >
                {profile.characterMediaTitle}
              </Link>
            ) : (
              <p className="truncate text-[11px] text-muted-foreground">
                {profile.characterMediaTitle}
              </p>
            )
          ) : null}
        </div>
      </div>
    </Panel>
  );
}

/**
 * Character picker: search the real AniList character catalogue, then save the
 * chosen one. Only the AniList id is sent — the server resolves the portrait and
 * the title it belongs to.
 */
function CharacterPicker() {
  const me = useQuery(api.profiles.me);
  const search = useAction(api.profiles.characterSearch);
  const setCharacter = useAction(api.profiles.setCharacter);
  const clearCharacter = useMutation(api.profiles.clearCharacter);

  const [term, setTerm] = useState("");
  const [items, setItems] = useState<CharacterPick[]>([]);
  const [searching, setSearching] = useState(false);
  const [picking, setPicking] = useState<number | null>(null);

  useEffect(() => {
    const q = term.trim();
    if (q.length < CHARACTER_SEARCH_MIN) {
      setItems([]);
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(() => {
      search({ q })
        .then((results) => {
          if (!cancelled) setItems(results);
        })
        .catch(() => {
          if (!cancelled) setItems([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term, search]);

  const current = me?.profile;

  const choose = async (characterId: number) => {
    setPicking(characterId);
    try {
      await setCharacter({ characterId });
      toast.success("Profil karakterin güncellendi.");
      setTerm("");
      setItems([]);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Karakter seçilemedi.");
    } finally {
      setPicking(null);
    }
  };

  return (
    <div className="border-t border-border pt-4">
      <p className="stat-label">Profil karakteri</p>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
        İstediğin animeden istediğin karakteri seç; profilin ve yorumların o
        karakterle görünür.
      </p>

      {current?.characterName ? (
        <div className="mt-2 flex items-center gap-2.5 rounded-[3px] border border-border bg-background/40 p-2">
          {current.characterImage ? (
            <img
              src={current.characterImage}
              alt={current.characterName}
              className="size-12 shrink-0 rounded-[2px] object-cover object-top"
            />
          ) : (
            <span className="size-12 shrink-0 rounded-[2px] bg-accent" />
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12px] font-medium text-foreground">
              {current.characterName}
            </span>
            {current.characterMediaTitle ? (
              <span className="block truncate text-[10px] text-muted-foreground">
                {current.characterMediaTitle}
              </span>
            ) : null}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
            onClick={() =>
              void clearCharacter()
                .then(() => toast.success("Profil karakteri kaldırıldı."))
                .catch((cause) =>
                  toast.error(cause instanceof Error ? cause.message : "Kaldırılamadı."),
                )
            }
          >
            <Trash2 className="size-3.5" />
            Kaldır
          </Button>
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Henüz karakter seçilmedi.
        </p>
      )}

      <div className="relative mt-3">
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Karakter ara — örn. Levi, Gojo, Naruto"
          className="pl-9"
        />
      </div>

      {searching ? (
        <p className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
          <Loader2 className="size-3 animate-spin" />
          Karakterler aranıyor…
        </p>
      ) : null}

      {term.trim().length >= CHARACTER_SEARCH_MIN && !searching ? (
        items.length > 0 ? (
          <ul className="mt-2 grid max-h-[240px] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
            {items.map((pick) => (
              <li key={pick.id}>
                <button
                  type="button"
                  disabled={picking !== null}
                  onClick={() => void choose(pick.id)}
                  className={cn(
                    "w-full overflow-hidden rounded-[3px] border text-left transition-colors",
                    current?.characterAnilistId === pick.id
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background/40 hover:border-primary/60",
                  )}
                >
                  {pick.image ? (
                    <img
                      src={pick.image}
                      alt={pick.name}
                      loading="lazy"
                      className="aspect-[3/4] w-full object-cover object-top"
                    />
                  ) : (
                    <span className="block aspect-[3/4] w-full bg-accent" />
                  )}
                  <span className="block p-1.5">
                    <span className="line-clamp-1 text-[11px] font-medium text-foreground">
                      {pick.name}
                    </span>
                    {pick.mediaTitle ? (
                      <span className="line-clamp-1 text-[10px] text-muted-foreground">
                        {pick.mediaTitle}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Sparkles className="size-3" />
            Sonuç bulunamadı.
          </p>
        )
      ) : null}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-center justify-between">
        <span className="stat-label">{label}</span>
        {hint ? (
          <span className="text-[10px] text-muted-foreground">{hint}</span>
        ) : null}
      </span>
      {children}
    </label>
  );
}
