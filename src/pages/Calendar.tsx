/**
 * Airing calendar.
 *
 * Seven days of real broadcast entries mirrored from AniList. The page reads the
 * window from the local cache and asks for a guarded sync when it is stale, so
 * the timetable fills in without the visitor waiting on an upstream request.
 */

import { Button } from "@/components/ui/button";
import { Container, SiteShell } from "@/components/site/site-shell";
import { EmptyCard, ErrorCard } from "@/components/site/states";
import { api } from "@/convex/_generated/api";
import {
  CALENDAR_DAYS,
  WEEKDAY_LABELS,
  addDays,
  buildCalendarDays,
  dayStartOf,
  formatCountdown,
  formatSlotDate,
  formatSlotTime,
  type CalendarSlotView,
} from "@/convex/communityView";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { cn } from "@/lib/utils";
import { useAction, useQuery } from "convex/react";
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, Radio } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";

export default function Calendar() {
  useDocumentTitle("Yayın takvimi");

  const [weekOffset, setWeekOffset] = useState(0);
  const start = useMemo(
    () => addDays(dayStartOf(Date.now()), weekOffset * CALENDAR_DAYS),
    [weekOffset],
  );

  const result = useQuery(api.calendar.week, { start });
  const syncCalendar = useAction(api.calendar.syncCalendar);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!result?.needsSync || inFlight.current) return;
    inFlight.current = true;
    syncCalendar({ start })
      .catch(() => undefined)
      .finally(() => {
        inFlight.current = false;
      });
  }, [result?.needsSync, start, syncCalendar]);

  const now = Date.now();
  const days = useMemo(
    () => buildCalendarDays(result?.slots ?? [], { start, days: CALENDAR_DAYS, now }),
    [result?.slots, start, now],
  );

  const total = result?.slots.length ?? 0;

  return (
    <SiteShell>
      <Container className="py-6">
        <header className="border-b border-border pb-4">
          <h1 className="flex items-center gap-2 text-[20px] font-semibold text-foreground sm:text-[24px]">
            <CalendarDays className="size-5 text-primary" aria-hidden="true" />
            Yayın takvimi
          </h1>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Gerçek yayın saatleriyle yedi günlük program.{" "}
            {result?.status === "syncing" ? (
              <span className="inline-flex items-center gap-1.5 text-brand-live">
                <Loader2 className="size-3 animate-spin" />
                güncelleniyor
              </span>
            ) : (
              `${total} bölüm`
            )}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWeekOffset((value) => value - 1)}
            >
              <ChevronLeft className="size-3.5" />
              Önceki hafta
            </Button>
            <Button
              variant={weekOffset === 0 ? "default" : "outline"}
              size="sm"
              onClick={() => setWeekOffset(0)}
            >
              Bu hafta
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWeekOffset((value) => value + 1)}
            >
              Sonraki hafta
              <ChevronRight className="size-3.5" />
            </Button>
            <span className="text-[11px] text-muted-foreground">
              {formatSlotDate(start)} — {formatSlotDate(addDays(start, CALENDAR_DAYS - 1))}
            </span>
          </div>
        </header>

        {result?.status === "error" ? (
          <ErrorCard
            className="mt-6"
            title="Takvim yüklenemedi"
            message={result.message}
            onRetry={() => void syncCalendar({ start })}
          />
        ) : null}

        {result === undefined ? (
          <div className="flex items-center justify-center gap-2 py-24 text-[13px] text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Takvim yükleniyor…
          </div>
        ) : total === 0 && result.status !== "syncing" ? (
          <EmptyCard
            className="mt-6"
            title="Bu hafta için kayıt yok"
            description="Bu aralıkta yayınlanan bir bölüm yok. Sonraki haftaya geçmeyi dene."
          >
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWeekOffset((value) => value + 1)}
            >
              Sonraki hafta
            </Button>
          </EmptyCard>
        ) : (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {days.map((day) => (
              <section
                key={day.start}
                className={cn(
                  "panel flex flex-col overflow-hidden",
                  day.isToday && "border-primary/60",
                )}
              >
                <header
                  className={cn(
                    "flex items-center justify-between gap-2 border-b border-border px-3 py-2",
                    day.isToday ? "bg-primary/10" : "bg-card",
                  )}
                >
                  <div>
                    <p className="text-[12px] font-semibold text-foreground">
                      {WEEKDAY_LABELS[day.weekday]}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatSlotDate(day.start)}
                    </p>
                  </div>
                  {day.isToday ? (
                    <span className="inline-flex items-center gap-1 rounded-[2px] bg-primary/20 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      <Radio className="size-2.5" />
                      Bugün
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">
                      {day.slots.length} bölüm
                    </span>
                  )}
                </header>

                <ul className="flex-1 divide-y divide-border">
                  {day.slots.length === 0 ? (
                    <li className="px-3 py-4 text-[11px] text-muted-foreground">
                      Yayın yok
                    </li>
                  ) : (
                    day.slots.map((slot) => (
                      <SlotRow key={`${slot.anilistId}:${slot.episode}`} slot={slot} now={now} />
                    ))
                  )}
                </ul>
              </section>
            ))}
          </div>
        )}
      </Container>
    </SiteShell>
  );
}

function SlotRow({ slot, now }: { slot: CalendarSlotView; now: number }) {
  const title = slot.anime?.title ?? `Yapım #${slot.anilistId}`;
  const aired = slot.airingAt <= now;

  return (
    <li>
      <Link
        to={`/anime/${slot.anilistId}`}
        className="flex items-center gap-2.5 px-3 py-2 transition-colors hover:bg-accent"
      >
        <span className="w-[42px] shrink-0 text-[11px] font-semibold tabular-nums text-primary">
          {formatSlotTime(slot.airingAt)}
        </span>

        {slot.anime?.cover ? (
          <img
            src={slot.anime.cover}
            alt=""
            loading="lazy"
            className="size-11 shrink-0 rounded-[2px] object-cover"
          />
        ) : (
          <span className="size-11 shrink-0 rounded-[2px] bg-accent" />
        )}

        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 text-[12px] font-medium text-foreground">
            {title}
          </span>
          <span
            className={cn(
              "mt-0.5 block text-[10px]",
              aired ? "text-muted-foreground" : "text-brand-live",
            )}
          >
            Bölüm {slot.episode} ·{" "}
            {aired ? "yayınlandı" : formatCountdown(slot.airingAt, now)}
          </span>
        </span>
      </Link>
    </li>
  );
}
