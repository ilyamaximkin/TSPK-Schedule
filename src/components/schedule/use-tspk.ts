"use client";

import { useCallback, useEffect, useState } from "react";

/** Type for the day schedule payload returned by GET /api/schedule/day. */
export interface Lesson {
  number: number;
  time: string;
  subject: string;
  teacher: string;
  room: string;
  raw: string;
}

export interface DaySchedule {
  date: string;
  header: string;
  dayOfWeek: string;
  groups: string[];
  scheduleByGroup: Record<string, Lesson[]>;
  noLessons: boolean;
}

export interface CalendarEntry {
  date: string;
  spreadsheetId: string | null;
}

/** Persist a value in localStorage (multi-tab safe). */
export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const v = window.localStorage.getItem(key);
      if (v !== null) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setValue(JSON.parse(v) as T);
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, [key]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  }, [key, value, hydrated]);

  return [value, setValue, hydrated] as const;
}

/** Format ISO date (YYYY-MM-DD) to human-readable Russian. */
export function formatDateRu(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const [, y, mo, d] = m;
  const months = [
    "января",
    "февраля",
    "марта",
    "апреля",
    "мая",
    "июня",
    "июля",
    "августа",
    "сентября",
    "октября",
    "ноября",
    "декабря",
  ];
  return `${parseInt(d, 10)} ${months[parseInt(mo, 10) - 1]} ${y}`;
}

const DAY_OF_WEEK_RU = [
  "Воскресенье",
  "Понедельник",
  "Вторник",
  "Среда",
  "Четверг",
  "Пятница",
  "Суббота",
];

export function dayOfWeekRu(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return DAY_OF_WEEK_RU[d.getDay()] || "";
}

/** Today's ISO date (server TZ-independent). */
export function todayIso(now = new Date()): string {
  const y = now.getFullYear();
  const mo = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${mo}-${d}`;
}

/** ISO date for `n` days from today. */
export function offsetIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return todayIso(d);
}

/** Fetch the schedule for a single ISO date. */
export function useDaySchedule(date: string | null) {
  const [data, setData] = useState<DaySchedule | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!date) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/schedule/day?date=${encodeURIComponent(date)}`)
      .then(async (r) => {
        if (!r.ok) {
          const j = await r.json().catch(() => null);
          throw new Error(j?.error || `HTTP ${r.status}`);
        }
        return r.json();
      })
      .then((j) => {
        if (cancelled) return;
        if (j.ok) setData(j.schedule);
        else setError(j.error || "Unknown error");
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Network error");
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [date]);

  return { data, error, loading };
}

/** Fetch several days at once (for the "week" view). */
export function useWeekSchedule(startDate: string | null, days: number) {
  const [items, setItems] = useState<Array<{ date: string; schedule: DaySchedule | null; error: string | null; loading: boolean }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!startDate) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setItems([]);
      return;
    }
    let cancelled = false;
    setLoading(true);

    // Build list of ISO dates
    const base = new Date(startDate + "T00:00:00");
    const dates: string[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      dates.push(todayIso(d));
    }

    setItems(dates.map((date) => ({ date, schedule: null, error: null, loading: true })));

    Promise.all(
      dates.map((date) =>
        fetch(`/api/schedule/day?date=${encodeURIComponent(date)}`)
          .then(async (r) => {
            if (!r.ok) {
              const j = await r.json().catch(() => null);
              throw new Error(j?.error || `HTTP ${r.status}`);
            }
            return r.json();
          })
          .then((j) => ({ date, schedule: j.ok ? (j.schedule as DaySchedule) : null, error: j.ok ? null : j.error, loading: false }))
          .catch((e) => ({
            date,
            schedule: null,
            error: e instanceof Error ? e.message : "Network error",
            loading: false,
          })),
      ),
    ).then((results) => {
      if (cancelled) return;
      setItems(results);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [startDate, days]);

  return { items, loading };
}
