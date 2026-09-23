import { buttonVariants } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { CalendarDays, Compass, Flame, Home, Search, Trophy, User } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { BrandMark, Wordmark } from "./brand";

const NAV_ITEMS = [
  { label: "Ana sayfa", to: "/", icon: Home },
  { label: "Anime", to: "/anime", icon: Compass },
  { label: "Bu sezon", to: "/anime?sort=newest", icon: Flame },
  { label: "En iyiler", to: "/anime?sort=score", icon: Trophy },
  { label: "Takvim", to: "/takvim", icon: CalendarDays },
];

/** AniList keeps its content column at ~1000px. */
export function Container({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-[1040px] px-4 sm:px-6", className)}>
      {children}
    </div>
  );
}

function useIsActive() {
  const location = useLocation();
  const current = `${location.pathname}${location.search}`;

  return (to: string) =>
    to.includes("?")
      ? current === to
      : location.pathname === to && !location.search;
}

export function SiteShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="min-h-screen bg-background">
      <SiteSidebar />
      <div className="lg:pl-[200px]">
        <SiteHeader />
        <main className={cn("pb-24 lg:pb-12", className)}>{children}</main>
        <SiteFooter />
      </div>
      <MobileNav />
    </div>
  );
}

function SiteSidebar() {
  const isActive = useIsActive();
  const { isAuthenticated, isLoading, user } = useAuth();
  const isAdmin = user?.role === "admin";

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[200px] flex-col border-r border-border bg-card lg:flex">
      <div className="flex h-14 items-center border-b border-border px-4">
        <Wordmark />
      </div>

      <nav className="flex-1 space-y-0.5 p-2" aria-label="Ana menü">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "flex items-center gap-3 rounded-[3px] px-3 py-2.5 text-[14px] font-medium transition-colors",
              isActive(item.to)
                ? "bg-accent text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <item.icon className="size-4 shrink-0" aria-hidden="true" />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="border-t border-border p-3">
        {isLoading ? null : isAuthenticated ? (
          <div className="space-y-1.5">
            <Link
              to="/dashboard"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full")}
            >
              <User className="size-3.5" />
              Hesabım
            </Link>
            <Link
              to="/profil"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "w-full")}
            >
              Profilim
            </Link>
            {isAdmin ? (
              <Link
                to="/admin"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "w-full")}
              >
                Yönetim paneli
              </Link>
            ) : null}
          </div>
        ) : (
          <Link
            to="/auth"
            className={cn(buttonVariants({ size: "sm" }), "w-full")}
          >
            Giriş yap
          </Link>
        )}
        <p className="mt-2.5 px-0.5 text-[10px] leading-relaxed text-muted-foreground">
          Veriler AniList API üzerinden sağlanır.
        </p>
      </div>
    </aside>
  );
}

function SiteHeader() {
  const navigate = useNavigate();
  const [term, setTerm] = useState("");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = term.trim();
    navigate(query ? `/anime?q=${encodeURIComponent(query)}` : "/anime");
  };

  return (
    <header
      className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="mx-auto flex h-14 w-full max-w-[1040px] items-center gap-3 px-4 sm:px-6">
        <Link to="/" aria-label="Anime Prime — ana sayfa" className="lg:hidden">
          <BrandMark />
        </Link>

        <form role="search" onSubmit={submit} className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Anime, tür veya stüdyo ara"
            aria-label="Katalogda ara"
            className="h-9 w-full rounded-[3px] border border-input bg-card pr-3 pl-9 text-[13px] text-foreground transition-colors outline-none placeholder:text-muted-foreground/80 focus:border-primary"
          />
        </form>

        <Link
          to="/anime"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "hidden shrink-0 lg:inline-flex",
          )}
        >
          Kataloğu keşfet
        </Link>
      </div>
    </header>
  );
}

function MobileNav() {
  const isActive = useIsActive();
  const { isAuthenticated } = useAuth();

  const items = [
    ...NAV_ITEMS.slice(0, 3),
    {
      label: "Hesap",
      to: isAuthenticated ? "/dashboard" : "/auth",
      icon: User,
    },
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Alt menü"
    >
      <div className="grid grid-cols-4">
        {items.map((item) => (
          <Link
            key={item.label}
            to={item.to}
            className={cn(
              "flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
              isActive(item.to) ? "text-primary" : "text-muted-foreground",
            )}
          >
            <item.icon className="size-5" aria-hidden="true" />
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <Container className="flex flex-col gap-4 py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px]">
            <Link to="/" className="text-muted-foreground transition-colors hover:text-primary">
              Ana sayfa
            </Link>
            <Link
              to="/anime"
              className="text-muted-foreground transition-colors hover:text-primary"
            >
              Tüm katalog
            </Link>
            <Link
              to="/anime?sort=score"
              className="text-muted-foreground transition-colors hover:text-primary"
            >
              En yüksek puanlılar
            </Link>
            <a
              href="https://anilist.co"
              target="_blank"
              rel="noreferrer noopener"
              className="text-muted-foreground transition-colors hover:text-primary"
            >
              AniList API
            </a>
          </nav>
          <p className="text-[12px] text-muted-foreground">
            © {new Date().getFullYear()} Anime Prime
          </p>
        </div>

        <p className="border-t border-border pt-4 text-[11px] leading-relaxed text-muted-foreground">
          Tüm başlık, puan, kadro ve görsel verileri AniList API&apos;sinden canlı
          olarak sağlanır. Anime Prime video barındırmaz ve hiçbir siteden akış
          çekmez; &quot;Nerede izlenir&quot; bağlantıları lisanslı platformlara
          yönlendirir.
        </p>
      </Container>
    </footer>
  );
}
