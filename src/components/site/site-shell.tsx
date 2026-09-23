import { Button, buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { Menu, Search } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { Wordmark } from "./brand";

const NAV_ITEMS = [
  { label: "Ana sayfa", to: "/" },
  { label: "Katalog", to: "/anime" },
  { label: "En iyiler", to: "/anime?sort=score" },
];

export function SiteShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      {/* Ambient brand glow so the dark stage never reads as flat black. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(120%_75%_at_50%_-15%,oklch(0.55_0.2_258/0.16),transparent_62%)]"
      />
      <SiteHeader />
      <main className={cn("flex-1", className)}>{children}</main>
      <SiteFooter />
    </div>
  );
}

export function SiteHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [term, setTerm] = useState("");

  const current = `${location.pathname}${location.search}`;
  const isActive = (to: string) =>
    to.includes("?") ? current === to : location.pathname === to && !location.search;

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = term.trim();
    navigate(query ? `/anime?q=${encodeURIComponent(query)}` : "/anime");
    setMenuOpen(false);
  };

  return (
    <header
      className="sticky top-0 z-50 border-b border-white/6 bg-background/85 backdrop-blur-xl"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Wordmark />

        <nav className="ml-2 hidden items-center gap-1 lg:flex" aria-label="Ana menü">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "rounded-full px-3.5 py-2 text-sm font-medium transition-colors",
                isActive(item.to)
                  ? "bg-white/8 text-foreground"
                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <form
            role="search"
            onSubmit={submitSearch}
            className="relative hidden md:block"
          >
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="search"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Anime, tür veya stüdyo ara"
              aria-label="Katalogda ara"
              className="h-10 w-56 rounded-full border border-white/10 bg-white/5 pr-3 pl-9 text-sm text-foreground transition outline-none placeholder:text-muted-foreground/80 focus:border-brand/60 focus:bg-white/8 focus:ring-2 focus:ring-ring/40 lg:w-72"
            />
          </form>

          {!isLoading &&
            (isAuthenticated ? (
              <Link
                to="/dashboard"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "hidden rounded-full sm:inline-flex",
                )}
              >
                Hesabım
              </Link>
            ) : (
              <Link
                to="/auth"
                className={cn(
                  buttonVariants({ size: "sm" }),
                  "hidden rounded-full sm:inline-flex",
                )}
              >
                Giriş yap
              </Link>
            ))}

          <Button
            variant="ghost"
            size="icon"
            aria-label="Menüyü aç"
            className="rounded-full lg:hidden"
            onClick={() => setMenuOpen(true)}
          >
            <Menu className="size-5" />
          </Button>
        </div>
      </div>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent
          side="right"
          className="w-[min(20rem,90vw)] border-white/10 bg-surface-1 p-0"
        >
          <SheetHeader className="border-b border-white/6 px-5 py-4">
            <Wordmark />
            <SheetTitle className="sr-only">Menü</SheetTitle>
            <SheetDescription className="sr-only">
              Ana menü, arama ve hesap bağlantıları.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-6 px-5 py-5">
            <form role="search" onSubmit={submitSearch} className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                type="search"
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="Anime, tür veya stüdyo ara"
                aria-label="Katalogda ara"
                className="h-11 w-full rounded-xl border border-white/10 bg-white/5 pr-3 pl-9 text-sm text-foreground outline-none placeholder:text-muted-foreground/80 focus:border-brand/60 focus:ring-2 focus:ring-ring/40"
              />
            </form>

            <nav className="flex flex-col" aria-label="Mobil menü">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    "rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                    isActive(item.to)
                      ? "bg-white/8 text-foreground"
                      : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            {!isLoading ? (
              isAuthenticated ? (
                <Link
                  to="/dashboard"
                  onClick={() => setMenuOpen(false)}
                  className={cn(buttonVariants({ variant: "outline" }), "w-full rounded-xl")}
                >
                  Hesabım
                </Link>
              ) : (
                <Link
                  to="/auth"
                  onClick={() => setMenuOpen(false)}
                  className={cn(buttonVariants(), "w-full rounded-xl")}
                >
                  Giriş yap
                </Link>
              )
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer
      className="mt-20 border-t border-white/6 bg-surface-1/60"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.4fr_1fr_1fr] lg:px-8">
        <div className="space-y-4">
          <Wordmark />
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            Anime Prime; puanlar, kadro, bölüm bilgileri ve fragmanlar dahil tüm
            içeriği AniList kataloğundan anlık olarak çeker. Katalog sayfasında
            tür ve puana göre filtreleyip binlerce yapım arasında gezinebilirsin.
          </p>
        </div>

        <div className="space-y-3">
          <p className="font-display text-xs font-bold tracking-[0.18em] text-muted-foreground uppercase">
            Keşfet
          </p>
          <ul className="space-y-2 text-sm">
            <li>
              <Link to="/" className="text-muted-foreground transition-colors hover:text-foreground">
                Ana sayfa
              </Link>
            </li>
            <li>
              <Link to="/anime" className="text-muted-foreground transition-colors hover:text-foreground">
                Tüm katalog
              </Link>
            </li>
            <li>
              <Link
                to="/anime?sort=score"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                En yüksek puanlılar
              </Link>
            </li>
            <li>
              <Link
                to="/anime?sort=newest"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                En yeni yapımlar
              </Link>
            </li>
          </ul>
        </div>

        <div className="space-y-3">
          <p className="font-display text-xs font-bold tracking-[0.18em] text-muted-foreground uppercase">
            Veri ve kaynak
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <a
                href="https://anilist.co"
                target="_blank"
                rel="noreferrer noopener"
                className="transition-colors hover:text-foreground"
              >
                AniList API
              </a>
            </li>
            <li>Poster ve görseller AniList CDN&apos;inden gelir.</li>
            <li>
              Anime Prime video barındırmaz; &quot;Nerede izlenir&quot; bağlantıları
              lisanslı platformlara gider.
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/6">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} Anime Prime</p>
          <p>Veriler AniList API üzerinden sağlanır.</p>
        </div>
      </div>
    </footer>
  );
}
