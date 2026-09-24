import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AlertTriangle, RefreshCw, SearchX } from "lucide-react";
import type { ReactNode } from "react";

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="aspect-[2/3] w-full animate-pulse rounded-[3px] bg-card" />
      <div className="h-3 w-4/5 animate-pulse rounded-[2px] bg-card" />
      <div className="h-2.5 w-2/5 animate-pulse rounded-[2px] bg-card" />
    </div>
  );
}

export function CardGridSkeleton({
  count = 12,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6",
        className,
      )}
    >
      {Array.from({ length: count }).map((_, index) => (
        <CardSkeleton key={index} />
      ))}
    </div>
  );
}

/** AniList-style inline notice. */
export function ErrorCard({
  title = "İçerik yüklenemedi",
  message,
  onRetry,
  className,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "panel flex flex-col items-start gap-4 p-4 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">
            {message ??
              "Katalog verisine ulaşılamadı. Bağlantını kontrol edip yeniden deneyebilirsin."}
          </p>
        </div>
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry} className="shrink-0">
          <RefreshCw className="size-3.5" />
          Tekrar dene
        </Button>
      ) : null}
    </div>
  );
}

export function EmptyCard({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-[3px] border border-dashed border-border bg-card/50 px-6 py-14 text-center",
        className,
      )}
    >
      <SearchX className="size-5 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description ? (
        <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
      {children}
    </div>
  );
}
