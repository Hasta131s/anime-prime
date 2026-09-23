import { BrandMark } from "@/components/site/brand";
import { SiteShell } from "@/components/site/site-shell";
import { buttonVariants } from "@/components/ui/button";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { cn } from "@/lib/utils";
import { Link } from "react-router";

export default function NotFound() {
  useDocumentTitle("Sayfa bulunamadı");

  return (
    <SiteShell>
      <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-5 px-4 py-24 text-center sm:py-32">
        <BrandMark className="size-12" />
        <p className="font-display text-6xl font-extrabold text-brand-bright">404</p>
        <h1 className="text-2xl font-extrabold sm:text-3xl">
          Bu sayfa kataloğumuzda yok
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground sm:text-base">
          Aradığın adres taşınmış ya da hiç var olmamış olabilir. Katalogdan
          devam edebilirsin.
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <Link to="/anime" className={cn(buttonVariants(), "rounded-full px-6")}>
            Kataloğu aç
          </Link>
          <Link
            to="/"
            className={cn(buttonVariants({ variant: "outline" }), "rounded-full px-6")}
          >
            Ana sayfa
          </Link>
        </div>
      </div>
    </SiteShell>
  );
}
