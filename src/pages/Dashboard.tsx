import { SiteShell } from "@/components/site/site-shell";
import { Button, buttonVariants } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { cn } from "@/lib/utils";
import { Compass, LogOut, MailCheck, ShieldCheck } from "lucide-react";
import { Link, useNavigate } from "react-router";

/**
 * The signed-in destination. Browsing is public in this version, so the account
 * area stays a small, honest overview instead of a fake dashboard.
 */
export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  useDocumentTitle("Hesabım");

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <SiteShell>
      <div className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <p className="font-display text-xs font-bold tracking-[0.2em] text-brand-bright uppercase">
          Hesabım
        </p>
        <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">
          Merhaba{user?.name ? `, ${user.name}` : ""}
        </h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
          Hesabın hazır. Bu sürümde anime kataloğu herkese açık, bu yüzden
          aşağıdaki alan yalnızca oturum bilgini gösterir.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/8 bg-surface-1/70 p-5">
            <span className="flex size-9 items-center justify-center rounded-lg bg-brand/12 text-brand-bright">
              <MailCheck className="size-4" aria-hidden="true" />
            </span>
            <h2 className="font-display mt-4 text-base font-bold">Oturum</h2>
            <dl className="mt-3 space-y-2 text-sm">
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
          </div>

          <div className="rounded-2xl border border-white/8 bg-surface-1/70 p-5">
            <span className="flex size-9 items-center justify-center rounded-lg bg-brand/12 text-brand-bright">
              <Compass className="size-4" aria-hidden="true" />
            </span>
            <h2 className="font-display mt-4 text-base font-bold">Katalog</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Gerçek AniList verisiyle çalışan katalog; tür filtreleri, puan
              sıralaması ve canlı arama ile birlikte.
            </p>
            <Link
              to="/anime"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "mt-4 rounded-full",
              )}
            >
              Kataloğu aç
            </Link>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-white/8 bg-surface-1/40 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/5 text-muted-foreground">
              <ShieldCheck className="size-4" aria-hidden="true" />
            </span>
            <p className="text-sm text-muted-foreground">
              Oturumun yalnızca e-posta doğrulama koduyla açılır. Kaydedilmiş
              kişisel veri tutulmaz.
            </p>
          </div>
          <Button
            variant="outline"
            className="shrink-0 rounded-full"
            onClick={handleSignOut}
          >
            <LogOut className="size-4" />
            Çıkış yap
          </Button>
        </div>
      </div>
    </SiteShell>
  );
}
