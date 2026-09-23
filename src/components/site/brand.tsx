import { cn } from "@/lib/utils";
import { Link } from "react-router";

/** The play-glyph mark used in the header, footer and empty states. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={cn("size-8 shrink-0", className)}>
      <defs>
        <linearGradient
          id="anime-prime-mark"
          x1="6"
          y1="2"
          x2="59"
          y2="62"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#3d92ff" />
          <stop offset="0.55" stopColor="#0063e5" />
          <stop offset="1" stopColor="#00246b" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="17" fill="url(#anime-prime-mark)" />
      <path d="M24.2 18.4 47.4 32 24.2 45.6Z" fill="#ffffff" />
      <path d="M49.6 8.6l1.6 4.3 4.3 1.6-4.3 1.6-1.6 4.3-1.6-4.3-4.3-1.6 4.3-1.6z" fill="#cbe4ff" />
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
      className={cn("group inline-flex items-center gap-2.5", className)}
    >
      <BrandMark className="size-8 transition-transform duration-300 group-hover:scale-105" />
      <span className="font-display text-[15px] font-extrabold tracking-[0.16em] text-foreground uppercase">
        Anime<span className="text-brand-bright">Prime</span>
      </span>
    </Link>
  );
}
