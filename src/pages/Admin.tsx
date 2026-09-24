/**
 * Admin panel.
 *
 * Everything read here is gated on the `admin` role server-side, so a
 * non-admin who reaches the route only ever sees an explanation. Admins get
 * totals, the member list with moderation actions, and the site-wide comment
 * queue.
 */

import { Panel } from "@/components/site/panel";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { api } from "@/convex/_generated/api";
import {
  ROLE_OPTIONS,
  SITE_PALETTES,
  communityRoleLabel,
  communityRoleTone,
  initialsFor,
  paletteById,
  type CommunityRole,
  type MemberCardView,
} from "@/convex/communityView";
import { useAuth } from "@/hooks/use-auth";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { formatDateTime, formatRelative } from "@/lib/anime-labels";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  Check,
  Loader2,
  Palette,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

export default function Admin() {
  useDocumentTitle("Yönetim paneli");
  const { isLoading } = useAuth();
  const overview = useQuery(api.admin.overview);

  if (isLoading || overview === undefined) {
    return (
      <SiteShell>
        <Container className="flex items-center justify-center gap-2 py-24 text-[13px] text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Yetki kontrol ediliyor…
        </Container>
      </SiteShell>
    );
  }

  if (overview === null) {
    return (
      <SiteShell>
        <Container className="py-20">
          <Panel>
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
              <div>
                <p className="text-[14px] font-semibold text-foreground">
                  Bu alan yöneticilere açıktır
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                  Yönetim paneline erişmek için yönetici yetkisiyle giriş yapmış
                  olman gerekir. Site sahibiysen ilk yönetici yetkisini bir yapım
                  sayfasındaki &quot;Kaynak yönetimi&quot; kartından bir kez
                  devralabilirsin.
                </p>
                <Link
                  to="/anime"
                  className="mt-3 inline-flex h-8 items-center rounded-[3px] border border-border bg-card px-3 text-[12px] font-medium transition-colors hover:bg-accent"
                >
                  Kataloğa dön
                </Link>
              </div>
            </div>
          </Panel>
        </Container>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <Container className="py-6">
        <header className="border-b border-border pb-4">
          <h1 className="flex items-center gap-2 text-[20px] font-semibold text-foreground sm:text-[24px]">
            <ShieldCheck className="size-5 text-primary" aria-hidden="true" />
            Yönetim paneli
          </h1>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Üyeleri yönet, yorumları denetle ve sitenin durumunu izle.
          </p>
        </header>

        <Tabs defaultValue="overview" className="mt-5">
          <TabsList>
            <TabsTrigger value="overview">Genel bakış</TabsTrigger>
            <TabsTrigger value="members">Üyeler</TabsTrigger>
            <TabsTrigger value="comments">Yorumlar</TabsTrigger>
            <TabsTrigger value="bans">Ban listesi</TabsTrigger>
            <TabsTrigger value="theme">Görünüm</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard label="Üye" value={overview.members} tone="text-primary" />
              <StatCard label="Misafir oturum" value={overview.guests} />
              <StatCard label="Yönetici" value={overview.admins} />
              <StatCard label="Moderatör" value={overview.moderators} />
              <StatCard
                label="Askıya alınan"
                value={overview.banned}
                tone={overview.banned > 0 ? "text-destructive" : undefined}
              />
              <StatCard label="Yorum" value={overview.comments} />
              <StatCard label="Bu hafta yorum" value={overview.commentsThisWeek} />
              <StatCard label="Yanıt" value={overview.replies} />
              <StatCard label="Eklenen kaynak" value={overview.sources} />
              <StatCard label="Kaynağı olan yapım" value={overview.titlesWithSources} />
            </div>

            <Panel className="mt-4" title="Oynatılabilir kaynaklar">
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                Kaynaklar (HLS/MP4) her yapımın kendi sayfasındaki{" "}
                <span className="font-medium text-foreground">
                  &quot;Kaynak yönetimi&quot;
                </span>{" "}
                panelinden eklenir ve silinir. Yapım sayfasına gitmek için
                katalogdan bir başlık aç.
              </p>
              <Link
                to="/anime"
                className="mt-3 inline-flex h-8 items-center rounded-[3px] bg-primary px-3 text-[12px] font-medium text-primary-foreground transition-colors hover:bg-brand-strong"
              >
                Kataloğu aç
              </Link>
            </Panel>
          </TabsContent>

          <TabsContent value="members" className="mt-4">
            <MembersTab />
          </TabsContent>

          <TabsContent value="comments" className="mt-4">
            <CommentsTab />
          </TabsContent>

          <TabsContent value="bans" className="mt-4">
            <BannedTab />
          </TabsContent>

          <TabsContent value="theme" className="mt-4">
            <ThemeTab />
          </TabsContent>
        </Tabs>
      </Container>
    </SiteShell>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <div className="panel px-3.5 py-3">
      <p className="stat-label">{label}</p>
      <p className={cn("mt-1 text-[22px] font-semibold", tone ?? "text-foreground")}>
        {value}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

function MembersTab() {
  const [term, setTerm] = useState("");
  const members = useQuery(api.admin.members, { q: term || undefined });

  return (
    <Panel
      title={`Üyeler${members ? ` (${members.length})` : ""}`}
      action={
        <div className="relative w-[180px] sm:w-[240px]">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Ara"
            className="h-8 pl-8 text-[12px]"
          />
        </div>
      }
      bodyClassName="p-0"
    >
      {members === undefined ? (
        <p className="flex items-center justify-center gap-2 py-8 text-[12px] text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Yükleniyor…
        </p>
      ) : members.length === 0 ? (
        <p className="p-3.5 text-[12px] text-muted-foreground">Üye bulunamadı.</p>
      ) : (
        <ul className="divide-y divide-border">
          {members.map((member) => (
            <MemberRow key={member.userId} member={member} />
          ))}
        </ul>
      )}
    </Panel>
  );
}

function MemberRow({ member }: { member: MemberCardView }) {
  const { user } = useAuth();
  const ban = useMutation(api.admin.ban);
  const unban = useMutation(api.admin.unban);
  const setRole = useMutation(api.admin.setRole);

  const [banOpen, setBanOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await action();
      toast.success(done);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "İşlem başarısız.");
    } finally {
      setBusy(false);
    }
  };

  const isAdmin = member.role === "admin";
  const isSelf = user?._id === member.userId;
  // The chosen character is the member's face; the account avatar is the fallback.
  const portrait = member.characterImage ?? member.image;

  return (
    <li className="flex flex-wrap items-center gap-3 p-3">
      <span className="flex min-w-0 flex-1 items-center gap-2.5">
        {portrait ? (
          <img src={portrait} alt="" className="size-9 shrink-0 rounded-[2px] object-cover object-top" />
        ) : (
          <span
            aria-hidden="true"
            className="flex size-9 shrink-0 items-center justify-center rounded-[2px] bg-secondary text-[12px] font-semibold text-muted-foreground"
          >
            {initialsFor(member.displayName)}
          </span>
        )}
        <span className="min-w-0">
          <Link
            to={`/profil/${member.userId}`}
            className="flex flex-wrap items-center gap-x-2 text-[13px] font-medium text-foreground transition-colors hover:text-primary"
          >
            {member.displayName}
            {communityRoleLabel(member.role) ? (
              <span
                className={cn(
                  "rounded-[2px] px-1.5 py-0.5 text-[10px] font-medium",
                  communityRoleTone(member.role),
                )}
              >
                {communityRoleLabel(member.role)}
              </span>
            ) : null}
            {member.isAnonymous ? (
              <span className="rounded-[2px] bg-accent px-1.5 py-0.5 text-[10px] text-muted-foreground">
                Misafir
              </span>
            ) : null}
            {member.banned ? (
              <span className="inline-flex items-center gap-1 rounded-[2px] bg-destructive/15 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                <TriangleAlert className="size-2.5" />
                Askıda
              </span>
            ) : null}
          </Link>
          <span className="mt-0.5 block text-[10px] text-muted-foreground">
            {member.comments} yorum · {member.titles} anime · {member.episodes} bölüm ·{" "}
            {formatDateTime(member.joinedAt, false)} katıldı
          </span>
        </span>
      </span>

      <span className="flex flex-wrap items-center gap-1.5">
        <Select
          value={member.role ?? "member"}
          disabled={busy || isSelf}
          onValueChange={(value) =>
            void run(
              () => setRole({ userId: member.userId, role: value as CommunityRole }),
              "Rol güncellendi.",
            )
          }
        >
          <SelectTrigger className="h-8 w-[148px] text-[12px]" aria-label="Rol ver">
            <UserRound className="size-3.5 shrink-0 text-muted-foreground" />
            <SelectValue placeholder="Rol" />
          </SelectTrigger>
          <SelectContent>
            {ROLE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <span className="flex flex-col">
                  <span className="text-[12px] font-medium">{option.label}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {option.hint}
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {member.banned ? (
          <Button
            size="sm"
            disabled={busy}
            onClick={() =>
              void run(() => unban({ userId: member.userId }), "Hesap geri açıldı.")
            }
          >
            <ShieldCheck className="size-3.5" />
            Yasağı kaldır
          </Button>
        ) : (
          <Button
            size="sm"
            variant="destructive"
            disabled={busy || isAdmin || isSelf}
            onClick={() => setBanOpen(true)}
          >
            <ShieldAlert className="size-3.5" />
            Askıya al
          </Button>
        )}
      </span>

      <Dialog open={banOpen} onOpenChange={setBanOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{member.displayName} askıya alınsın mı?</DialogTitle>
            <DialogDescription>
              Askıya alınan hesap okumaya devam eder ama yorum yazamaz ve
              profilini düzenleyemez.
            </DialogDescription>
          </DialogHeader>
          <label className="block space-y-1.5">
            <span className="stat-label">Sebep (isteğe bağlı)</span>
            <Input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Örn. spam yorumlar"
            />
          </label>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBanOpen(false)}>
              Vazgeç
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() =>
                void run(
                  () =>
                    ban({
                      userId: member.userId,
                      reason: reason || undefined,
                    }),
                  "Hesap askıya alındı.",
                ).then(() => setBanOpen(false))
              }
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Askıya al
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Ban list
// ---------------------------------------------------------------------------

/** Everyone the moderators suspended, with the reason and who did it. */
function BannedTab() {
  const banned = useQuery(api.admin.bannedMembers);
  const unban = useMutation(api.admin.unban);
  const [busy, setBusy] = useState<string | null>(null);

  const restore = async (userId: MemberCardView["userId"], name: string) => {
    setBusy(userId);
    try {
      await unban({ userId });
      toast.success(`${name} için yasak kaldırıldı.`);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "İşlem başarısız.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Panel
      title={`Ban listesi${banned ? ` (${banned.length})` : ""}`}
      action={
        <span className="text-[10px] text-muted-foreground">
          Askıya alınan hesaplar okumaya devam eder
        </span>
      }
      bodyClassName="p-0"
    >
      {banned === undefined ? (
        <p className="flex items-center justify-center gap-2 py-8 text-[12px] text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Yükleniyor…
        </p>
      ) : banned.length === 0 ? (
        <p className="p-3.5 text-[12px] text-muted-foreground">
          Şu an askıya alınmış hesap yok.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {banned.map((member) => (
            <li key={member.userId} className="flex flex-wrap items-center gap-3 p-3">
              <span className="flex min-w-0 flex-1 items-start gap-2.5">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-[2px] bg-destructive/15 text-destructive">
                  <ShieldAlert className="size-4" />
                </span>
                <span className="min-w-0">
                  <Link
                    to={`/profil/${member.userId}`}
                    className="block truncate text-[13px] font-medium text-foreground transition-colors hover:text-primary"
                  >
                    {member.displayName}
                  </Link>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    {member.banReason ?? "Sebep belirtilmedi"}
                  </span>
                  <span className="mt-0.5 block text-[10px] text-muted-foreground">
                    {member.bannedAt
                      ? `${formatDateTime(member.bannedAt, false)} askıya alındı`
                      : "Askıya alındı"}
                    {member.bannedByName ? ` · ${member.bannedByName}` : ""}
                  </span>
                </span>
              </span>

              <Button
                size="sm"
                disabled={busy === member.userId}
                onClick={() => void restore(member.userId, member.displayName)}
              >
                {busy === member.userId ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <ShieldCheck className="size-3.5" />
                )}
                Yasağı kaldır
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Appearance
// ---------------------------------------------------------------------------

/**
 * Palette picker. One tap repaints the whole site for everyone, because the
 * choice is stored in Convex and every client applies it on load.
 */
function ThemeTab() {
  const palette = useQuery(api.settings.theme);
  const setPalette = useMutation(api.settings.setPalette);
  const [busy, setBusy] = useState<string | null>(null);

  const current = paletteById(palette).id;

  const apply = async (id: string, label: string) => {
    if (id === current) return;
    setBusy(id);
    try {
      await setPalette({ palette: id });
      toast.success(`Tema değişti: ${label}`);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Tema değiştirilemedi.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Panel
      title="Tema renk paleti"
      action={
        <span className="text-[10px] text-muted-foreground">
          Değişiklik herkeste anında geçerli
        </span>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SITE_PALETTES.map((option) => {
          const active = option.id === current;
          return (
            <button
              key={option.id}
              type="button"
              disabled={busy !== null}
              onClick={() => void apply(option.id, option.label)}
              className={cn(
                "flex items-center gap-3 rounded-[3px] border p-3 text-left transition-colors",
                active
                  ? "border-primary bg-primary/10"
                  : "border-border bg-background/40 hover:border-primary/50",
              )}
            >
              <span className="flex shrink-0 overflow-hidden rounded-[2px] border border-border">
                {option.swatch.map((color) => (
                  <span
                    key={color}
                    className="block size-6"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-[12px] font-medium text-foreground">
                  {option.label}
                  {active ? <Check className="size-3.5 text-primary" /> : null}
                </span>
                <span className="mt-0.5 block text-[10px] text-muted-foreground">
                  {option.hint}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-3 flex items-center gap-1.5 border-t border-border pt-3 text-[11px] text-muted-foreground">
        <Palette className="size-3.5 shrink-0" />
        Tema yalnızca renk paletini değiştirir; düzen ve içerik aynı kalır.
      </p>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

function CommentsTab() {
  const feed = useQuery(api.admin.recentComments);
  const remove = useMutation(api.comments.remove);

  return (
    <Panel
      title={`Son yorumlar${feed ? ` (${feed.length})` : ""}`}
      action={
        <span className="text-[10px] text-muted-foreground">
          Site genelinde en yeni 40
        </span>
      }
      bodyClassName="p-0"
    >
      {feed === undefined ? (
        <p className="flex items-center justify-center gap-2 py-8 text-[12px] text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Yükleniyor…
        </p>
      ) : feed.length === 0 ? (
        <p className="p-3.5 text-[12px] text-muted-foreground">
          Henüz yorum yok.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {feed.map(({ comment, animeTitle }) => (
            <li key={comment.id} className="flex items-start gap-3 p-3">
              <span
                aria-hidden="true"
                className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-[2px] bg-secondary text-[11px] font-semibold text-muted-foreground"
              >
                {initialsFor(comment.author.name)}
              </span>

              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-2 text-[12px]">
                  <Link
                    to={`/profil/${comment.author.userId}`}
                    className="font-medium text-foreground hover:text-primary"
                  >
                    {comment.author.name}
                  </Link>
                  {comment.author.banned ? (
                    <span className="rounded-[2px] bg-destructive/15 px-1.5 py-0.5 text-[10px] text-destructive">
                      Askıda
                    </span>
                  ) : null}
                  <span className="text-muted-foreground">·</span>
                  <Link
                    to={`/anime/${comment.anilistId}`}
                    className="text-primary hover:underline"
                  >
                    {animeTitle ?? `Yapım #${comment.anilistId}`}
                  </Link>
                </p>
                <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-foreground/90">
                  {comment.deleted ? (
                    <span className="italic text-muted-foreground">
                      Silinmiş yorum
                    </span>
                  ) : (
                    comment.body
                  )}
                </p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {formatRelative(comment.createdAt)}
                  {comment.isReply ? " · yanıt" : ""}
                  {comment.likeCount > 0 ? ` · ${comment.likeCount} beğeni` : ""}
                </p>
              </div>

              {!comment.deleted ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() =>
                    void remove({ id: comment.id })
                      .then(() => toast.success("Yorum kaldırıldı."))
                      .catch((cause) =>
                        toast.error(
                          cause instanceof Error ? cause.message : "Silinemedi.",
                        ),
                      )
                  }
                >
                  <Trash2 className="size-3.5" />
                  Kaldır
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
