"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CalendarMinus } from "lucide-react";
import { DayCard } from "./WeekView";
import { todayIso, type DaySchedule, type Dept, type ViewMode } from "./use-tspk";

/**
 * Month view — every day of a month as a card (same DayCard as the week
 * view), filtered by the active group / teacher / room.
 *
 * Sundays are rendered from the client alone ("Занятий нет" — TSPK never
 * has Sunday classes) and are NOT fetched, which trims ~5 requests per
 * month. Remaining days are fetched in chunks of 6 parallel requests so a
 * month open doesn't fire ~26 simultaneous Google-Sheets reads.
 */

interface Item {
  date: string;
  schedule: DaySchedule | null;
  error: string | null;
  loading: boolean;
}

function monthMeta(now: Date, offset: number) {
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const label =
    first
      .toLocaleDateString("ru-RU", { month: "long", year: "numeric" })
      .replace(/ г\.?$/, "");
  const capitalized = label.charAt(0).toUpperCase() + label.slice(1);
  return { first, days, label: capitalized };
}

export function MonthView({
  monthOffset,
  mode,
  value,
  dept = "1",
}: {
  /** 0 = current month, -1 = previous month. */
  monthOffset: number;
  mode: ViewMode;
  value: string;
  dept?: Dept;
}) {
  const meta = useMemo(() => monthMeta(new Date(), monthOffset), [monthOffset]);

  const dates = useMemo(() => {
    const out: { iso: string; sunday: boolean }[] = [];
    for (let d = 1; d <= meta.days; d++) {
      const date = new Date(meta.first.getFullYear(), meta.first.getMonth(), d);
      out.push({ iso: todayIso(date), sunday: date.getDay() === 0 });
    }
    return out;
  }, [meta]);

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setItems(dates.map(({ iso }) => ({ date: iso, schedule: null, error: null, loading: true })));
    setLoading(true);

    (async () => {
      const fetchable = dates.filter((d) => !d.sunday);
      const byDate = new Map<string, Item>();
      // Chunks of 6 parallel requests — fast without hammering the API.
      for (let i = 0; i < fetchable.length; i += 6) {
        if (cancelled) return;
        const chunk = fetchable.slice(i, i + 6);
        const results = await Promise.all(
          chunk.map(({ iso }) =>
            fetch(`/api/schedule/day?date=${encodeURIComponent(iso)}&dept=${dept}`)
              .then(async (r) => {
                if (!r.ok) {
                  const j = await r.json().catch(() => null);
                  throw new Error(j?.error || `HTTP ${r.status}`);
                }
                return r.json();
              })
              .then((j): Item => ({
                date: iso,
                schedule: j.ok ? (j.schedule as DaySchedule) : null,
                error: j.ok ? null : j.error,
                loading: false,
              }))
              .catch((e): Item => ({
                date: iso,
                schedule: null,
                error: e instanceof Error ? e.message : "Network error",
                loading: false,
              })),
          ),
        );
        if (cancelled) return;
        for (const r of results) byDate.set(r.date, r);
        // Paint progress as chunks arrive.
        setItems((prev) =>
          prev.map((it) => byDate.get(it.date) ?? it),
        );
      }
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [dates, dept]);

  const Icon = monthOffset === 0 ? CalendarDays : CalendarMinus;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5 shrink-0" />
        {meta.label} — все дни месяца{loading ? " · загружаем…" : ""}.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 data-zoom-stack">
        {items.map((it) => (
          <DayCard
            key={it.date}
            date={it.date}
            schedule={it.schedule}
            loading={it.loading}
            error={it.error}
            mode={mode}
            value={value}
          />
        ))}
      </div>
    </div>
  );
}
