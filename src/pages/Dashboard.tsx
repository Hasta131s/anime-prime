import { Panel, StatStrip } from "@/components/site/panel";
import { Container, SiteShell } from "@/components/site/site-shell";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { formatRelative } from "@/lib/anime-labels";
import { formatClock } from "@/lib/watch-progress";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import {
  CalendarDays,
  ChevronRight,
  Heart,
  LogOut,
  MessagesSquare,
  Play,
  ShieldCheck,
  User,
} from "lucide-react";
import { Link, useNavigate } from "react-router";

/**
 * The signed-in destination: a real overview of the account's saved state —
 * watch history, counters and shortcuts into the community features.
 */
export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  useDocumentTitle("Hesabım");

  const summary = useQuery(api.progress.summary);
  const continueWatching = useQuery(api.progress.continueWatching, { limit: 8 });
  const manageState = useQuery(api.sources.manageState);

  const isAdmin = user?.role === "admin" || manageState?.canManage === true;

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <SiteShell>
      <Container className="py-6">
        <h1 className="text-[20px] font-semibold text-foreground sm:text-[24px]">
          Hesabım
        </h1>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Merhaba{user?.name ? `, ${user.name}` : ""} — izleme geçmişin ve
          topluluk etkinliğin burada.
        </p>

        <StatStrip
          className="mt-4"
          stats={[
            { label: "İzlenen anime", value: summary?.titles ?? 0, tone: "text-primary" },
            { label: "İzlenen bölüm", value: summary?.episodes ?? 0 },
            { label: "Favori", value: summary?.favorites ?? 0 },
            { label: "Yorum", value: summary?.comments ?? 0 },
          ]}
        />

        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Panel
            title="İzlemeye devam et"
            bodyClassName="p-0"
            action={
              continueWatching && continueWatching.length > 0 ? (
                <Link
                  to="/profil"
                  className="text-[11px] font-medium text-primary hover:underline"
                >
                  Tüm geçmiş
                </Link>
              ) : null
            }
          >
            {continueWatching === undefined ? (
              <p className="p-3.5 text-[12px] text-muted-foreground">Yükleniyor…</p>
            ) : continueWatching.length === 0 ? (
              <div className="p-5 text-center">
                <p className="text-[13px] font-medium text-foreground">
                  Henüz izleme geçmişin yok
                </p>
                <p className="mx-auto mt-1 max-w-sm text-[11px] leading-relaxed text-muted-foreground">
                  Kaynağı eklenmiş bir yapımı oynatmaya başladığında kaldığın yer
                  burada ve profilinde görünür.
                </p>
                <Link
                  to="/anime"
                  className="mt-3 inline-flex h-8 items-center rounded-[3px] border border-border bg-card px-3 text-[12px] font-medium transition-colors hover:bg-accent"
                >
                  Kataloğu keşfet
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {continueWatching.map((entry) => {
                  const percent =
                    entry.duration > 0
                      ? Math.min(
                          100,
                          Math.round((entry.position / entry.duration) * 100),
                        )
                      : 0;
                  return (
                    <li key={`${entry.anilistId}:${entry.episode}`}>
                      <Link
                        to={`/anime/${entry.anilistId}/izle?b=${entry.episode}`}
                        className="flex items-center gap-3 p-3 transition-colors hover:bg-accent"
                      >
                        <span className="w-10 shrink-0 overflow-hidden rounded-[2px] border border-border">
                          {entry.anime?.cover ? (
                            <img
                              src={entry.anime.cover}
                              alt=""
                              loading="lazy"
                              className="aspect-[2/3] w-full object-cover"
                            />
                          ) : (
                            <span className="block aspect-[2/3] w-full bg-accent" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-1 text-[13px] font-medium text-foreground">
                            {entry.anime?.title ?? `AniList #${entry.anilistId}`}
                          </span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                            <span>
                              {entry.episode === 0
                                ? "Tek parça"
                                : `Bölüm ${entry.episode}`}
                            </span>
                            <span>{formatClock(entry.position)}</span>
                            <span>{formatRelative(entry.watchedAt)}</span>
                          </span>
                          {entry.duration > 0 ? (
                            <span className="mt-1.5 block h-1 w-full overflow-hidden rounded-full bg-accent">
                              <span
                                className={cn(
                                  "block h-full",
                                  entry.completed ? "bg-brand-live" : "bg-primary",
                                )}
                                style={{ width: `${Math.max(percent, 2)}%` }}
                              />
                            </span>
                          ) : null}
                        </span>
                        <Play className="size-3.5 shrink-0 fill-current text-primary" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <div className="space-y-4">
            <Panel title="Hesap">
              <dl className="space-y-2 text-[13px]">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-muted-foreground">E-posta</dt>
                  <dd className="truncate font-medium">
                    {user?.email ?? (
                      <span className="text-muted-foreground">
                        {user?.isAnonymous ? "Misafir oturumu" : "—"}
                      </span>
                    )}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-muted-foreground">Doğrulama</dt>
                  <dd className="font-medium">
                    {user?.emailVerificationTime ? "Doğrulandı" : "Bekliyor"}
                  </dd>
                </div>
              </dl>

              {user?.isAnonymous ? (
                <p className="mt-3 rounded-[3px] border border-border bg-background/40 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
                  Misafir oturumunda izleme geçmişin kaydedilir; yorum yazmak ve
                  profilini düzenlemek için e-posta ile giriş yap.
                </p>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  to="/profil"
                  className="inline-flex h-8 items-center gap-1.5 rounded-[3px] bg-primary px-3 text-[12px] font-medium text-primary-foreground transition-colors hover:bg-brand-strong"
                >
                  <User className="size-3.5" />
                  Profilim
                </Link>
                {isAdmin ? (
                  <Link
                    to="/admin"
                    className="inline-flex h-8 items-center gap-1.5 rounded-[3px] border border-border bg-card px-3 text-[12px] font-medium transition-colors hover:bg-accent"
                  >
                    <ShieldCheck className="size-3.5" />
                    Yönetim paneli
                  </Link>
                ) : null}
              </div>
            </Panel>

            <Panel title="Keşfet" bodyClassName="p-0">
              <Shortcut
                to="/takvim"
                icon={CalendarDays}
                title="Yayın takvimi"
                description="Önümüzdeki yedi günün bölümleri"
              />
              <Shortcut
                to="/anime"
                icon={Heart}
                title="Katalog ve favoriler"
                description="Yeni yapımlar bul, favorilerine ekle"
              />
              <Shortcut
                to="/profil"
                icon={MessagesSquare}
                title="Yorumların"
                description="Profilinde son yorumlarını gör"
              />
            </Panel>

            <Button variant="outline" className="w-full" onClick={handleSignOut}>
              <LogOut className="size-4" />
              Çıkış yap
            </Button>
          </div>
        </div>
      </Container>
    </SiteShell>
  );
}

function Shortcut({
  to,
  icon: Icon,
  title,
  description,
}: {
  to: string;
  icon: typeof Heart;
  title: string;
  description: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 border-b border-border px-3.5 py-2.5 transition-colors last:border-b-0 hover:bg-accent"
    >
      <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] font-medium text-foreground">{title}</span>
        <span className="block text-[10px] text-muted-foreground">{description}</span>
      </span>
      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
    </Link>
  );
}
