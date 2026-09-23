import { cn } from "@/lib/utils";
import { Link } from "react-router";

/** Flat blue mark, matching AniList's flat-vector logo treatment. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-7 shrink-0", className)}>
      <rect width="32" height="32" rx="4" fill="#3db4f2" />
      <path d="M12 8.5 24.5 16 12 23.5Z" fill="#ffffff" />
      <circle cx="26" cy="6" r="3" fill="#0b1622" opacity="0.25" />
    </svg>
  );
}

export function Wordmark({
  className,
  to = "/",
}: {
  className?: string;
  to?: string;
}) {
  return (
    <Link
      to={to}
      aria-label="Anime Prime — ana sayfa"
      className={cn("group inline-flex items-center gap-2", className)}
    >
      <BrandMark />
      <span className="text-[17px] font-bold text-foreground transition-colors group-hover:text-primary">
        Anime<span className="text-primary">Prime</span>
      </span>
    </Link>
  );
}
