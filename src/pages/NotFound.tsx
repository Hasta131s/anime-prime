import { BrandMark } from "@/components/site/brand";
import { Container, SiteShell } from "@/components/site/site-shell";
import { buttonVariants } from "@/components/ui/button";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { Link } from "react-router";

export default function NotFound() {
  useDocumentTitle("Sayfa bulunamadı");

  return (
    <SiteShell>
      <Container className="flex flex-col items-center gap-3 py-24 text-center">
        <BrandMark className="size-10 opacity-80" />
        <p className="text-[40px] leading-none font-bold text-primary">404</p>
        <h1 className="text-[18px] font-semibold text-foreground">
          Bu sayfa kataloğumuzda yok
        </h1>
        <p className="max-w-sm text-[13px] leading-relaxed text-muted-foreground">
          Aradığın adres taşınmış ya da hiç var olmamış olabilir. Katalogdan devam
          edebilirsin.
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Link to="/anime" className={buttonVariants()}>
            Kataloğu aç
          </Link>
          <Link to="/" className={buttonVariants({ variant: "outline" })}>
            Ana sayfa
          </Link>
        </div>
      </Container>
    </SiteShell>
  );
}
