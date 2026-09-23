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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { api } from "@/convex/_generated/api";
import {
  communityRoleLabel,
  initialsFor,
  type MemberCardView,
} from "@/convex/communityView";
import { useAuth } from "@/hooks/use-auth";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { formatDateTime, formatRelative } from "@/lib/anime-labels";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Loader2,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  TriangleAlert,
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
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard label="Üye" value={overview.members} tone="text-primary" />
              <StatCard label="Misafir oturum" value={overview.guests} />
              <StatCard label="Yönetici" value={overview.admins} />
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

  return (
    <li className="flex flex-wrap items-center gap-3 p-3">
      <span className="flex min-w-0 flex-1 items-center gap-2.5">
        {member.image ? (
          <img src={member.image} alt="" className="size-9 shrink-0 rounded-[2px] object-cover" />
        ) : (
          <span
            aria-hidden="true"
            className="flex size-9 shrink-0 items-center justify-center rounded-[2px] text-[12px] font-semibold text-white"
            style={{ backgroundColor: member.accent }}
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
              <span className="rounded-[2px] bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
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
        {!isAdmin ? (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() =>
              void run(
                () => setRole({ userId: member.userId, role: "admin" }),
                "Yönetici yapıldı.",
              )
            }
          >
            <ArrowUpCircle className="size-3.5" />
            Yönetici yap
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() =>
              void run(
                () => setRole({ userId: member.userId, role: "member" }),
                "Yöneticilik kaldırıldı.",
              )
            }
          >
            <ArrowDownCircle className="size-3.5" />
            Yetkiyi al
          </Button>
        )}

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
            disabled={busy || isAdmin}
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
                className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-[2px] text-[11px] font-semibold text-white"
                style={{ backgroundColor: comment.author.accent ?? "#3db4f2" }}
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
                    {animeTitle ?? `AniList #${comment.anilistId}`}
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
