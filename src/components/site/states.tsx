import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AlertTriangle, RefreshCw, SearchX } from "lucide-react";
import type { ReactNode } from "react";

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-2.5", className)}>
      <div className="aspect-[2/3] w-full animate-pulse rounded-xl bg-white/[0.04] ring-1 ring-white/5" />
      <div className="h-3 w-4/5 animate-pulse rounded-full bg-white/[0.06]" />
      <div className="h-3 w-2/5 animate-pulse rounded-full bg-white/[0.04]" />
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
        "grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-4 xl:grid-cols-5",
        className,
      )}
    >
      {Array.from({ length: count }).map((_, index) => (
        <CardSkeleton key={index} />
      ))}
    </div>
  );
}

export function RailSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="rail-scroll no-scrollbar -mx-4 gap-3 px-4 pb-2 sm:gap-4">
      {Array.from({ length: count }).map((_, index) => (
        <CardSkeleton
          key={index}
          className="w-[140px] shrink-0 sm:w-[160px] md:w-[176px]"
        />
      ))}
    </div>
  );
}

/** Error panel that always shows the real upstream message. */
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
        "flex flex-col items-start gap-4 rounded-2xl border border-white/8 bg-surface-1 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6",
        className,
      )}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-destructive/12 text-destructive">
          <AlertTriangle className="size-4" aria-hidden="true" />
        </span>
        <div>
          <p className="font-display text-sm font-bold">{title}</p>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            {message ??
              "AniList verisine ulaşılamadı. Bağlantını kontrol edip yeniden deneyebilirsin."}
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
        "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-14 text-center",
        className,
      )}
    >
      <span className="flex size-11 items-center justify-center rounded-full bg-white/5 text-muted-foreground">
        <SearchX className="size-5" aria-hidden="true" />
      </span>
      <p className="font-display text-base font-bold">{title}</p>
      {description ? (
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      ) : null}
      {children}
    </div>
  );
}
