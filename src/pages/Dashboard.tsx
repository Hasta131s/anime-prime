import { Panel } from "@/components/site/panel";
import { Container, SiteShell } from "@/components/site/site-shell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { LogOut } from "lucide-react";
import { Link, useNavigate } from "react-router";

/**
 * The signed-in destination. Browsing is public, so this stays a small honest
 * overview instead of a fake dashboard.
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
      <Container className="py-6">
        <h1 className="text-[20px] font-semibold text-foreground sm:text-[24px]">
          Hesabım
        </h1>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Merhaba{user?.name ? `, ${user.name}` : ""} — oturum bilgilerin aşağıda.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Panel title="Oturum">
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
            <p className="mt-3 border-t border-border pt-3 text-[11px] leading-relaxed text-muted-foreground">
              Oturumlar e-posta doğrulama koduyla açılır; kaydedilmiş kişisel veri
              tutulmaz.
            </p>
          </Panel>

          <Panel title="Katalog">
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              Gerçek AniList verisiyle çalışan katalog: tür filtreleri, puan
              sıralaması, canlı arama ve oynatılabilir kaynaklar.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                to="/anime"
                className="inline-flex h-9 items-center rounded-[3px] border border-border bg-card px-4 text-[13px] font-medium transition-colors hover:bg-accent"
              >
                Kataloğu aç
              </Link>
            </div>
          </Panel>
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] text-muted-foreground">
            İzleme ilerlemen bu cihazda saklanır; hesabına yazılmaz.
          </p>
          <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="size-4" />
            Çıkış yap
          </Button>
        </div>
      </Container>
    </SiteShell>
  );
}
