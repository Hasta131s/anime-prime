import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { Link } from "react-router";

/**
 * AniList panel: a flat card with a hairline border, an optional header bar
 * (slightly darker, separated by a border) and no rounded-corner theatrics.
 */
export function Panel({
  title,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("panel overflow-hidden", className)}>
      {title ? (
        <header className="flex items-center justify-between gap-3 border-b border-border bg-card px-3.5 py-2.5">
          <h2 className="text-[13px] font-semibold text-foreground">{title}</h2>
          {action}
        </header>
      ) : null}
      <div className={cn("p-3.5", bodyClassName)}>{children}</div>
    </section>
  );
}

export type Stat = {
  label: string;
  value?: string | number;
  tone?: string;
};

/** The label-above-value strip AniList shows under a title. */
export function StatStrip({
  stats,
  className,
}: {
  stats: Stat[];
  className?: string;
}) {
  const visible = stats.filter(
    (stat) => stat.value !== undefined && stat.value !== null && stat.value !== "",
  );
  if (visible.length === 0) return null;

  return (
    <dl
      className={cn(
        "no-scrollbar flex items-stretch divide-x divide-border overflow-x-auto rounded-[3px] border border-border bg-card/85 backdrop-blur-sm",
        className,
      )}
    >
      {visible.map((stat) => (
        <div key={stat.label} className="min-w-[96px] shrink-0 px-3.5 py-2">
          <dt className="stat-label">{stat.label}</dt>
          <dd
            className={cn(
              "mt-0.5 text-[14px] font-semibold",
              stat.tone ?? "text-foreground",
            )}
          >
            {stat.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** AniList tag: small, sharp, blue on hover. Renders as a link when given `to`. */
export function Tag({
  to,
  children,
  className,
  active = false,
  count,
}: {
  to?: string;
  children: ReactNode;
  className?: string;
  active?: boolean;
  count?: number;
}) {
  const classes = cn(
    "tag",
    active && "bg-primary text-white",
    !active && to && "hover:bg-primary/20 hover:text-primary",
    className,
  );

  const content = (
    <>
      <span>{children}</span>
      {count !== undefined ? (
        <span className={cn("text-[10px]", active ? "text-white/80" : "opacity-70")}>
          {count}
        </span>
      ) : null}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={classes}>
        {content}
      </Link>
    );
  }
  return <span className={classes}>{content}</span>;
}
