"use client";

import { useEffect, useState } from "react";

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
  corpus: 1 | 2;
  header: string;
  dayOfWeek: string;
  groups: string[];
  scheduleByGroup: Record<string, Lesson[]>;
  noLessons: boolean;
}

export interface CalendarEntry {
  date: string;
  corpus: 1 | 2;
  spreadsheetId: string | null;
  gid: string | null;
}

/**
 * Fallback list of all known TSPK groups, used by the GroupSelector when
 * the API hasn't returned a schedule yet (e.g. today is a weekend with no
 * spreadsheet and no groups list). These lists were extracted from live
 * CSVs in October 2026 — if new groups appear in the schedule, the API
 * will still surface them; this is only a UX fallback.
 */
export const FALLBACK_GROUPS_1: string[] = [
  "Д-11", "Д-21", "Д-31", "Д-41",
  "ИСиП-21", "ИСиП-22", "ИСиП-23", "ИСиП-31", "ИСиП-32", "ИСиП-33", "ИСиП-34",
  "ИСиП-41", "ИСиП-42", "ИСиП-43", "ИСиП-44",
  "КС-52",
  "НК-11", "НК-12", "НК-13", "НК-21", "НК-22", "НК-23", "НК-24",
  "НК-31", "НК-32", "НК-33", "НК-34", "НК-41", "НК-42",
  "ОИС-11", "ОИС-21",
  "ПДО-11", "ПДО-21", "ПДО-31", "ПДО-41",
  "РУПО-11", "РУПО-12", "РУПО-13",
  "СД-11", "СД-21", "СД-31", "СД-41",
];

/** Corpus 2 (Ленинградская, 28) — physical culture, adaptive FC, preschool
 *  edu, plus заочное отделение placeholder. */
export const FALLBACK_GROUPS_2: string[] = [
  // Физическая культура
  "ФК-11", "ФК-12", "ФК-13",
  "ФК-21", "ФК-22", "ФК-23",
  "ФК-31", "ФК-32", "ФК-33",
  "ФК-41", "ФК-42", "ФК-43", "ФК-44",
  // Адаптивная физическая культура
  "АФК-11", "АФК-12",
  "АФК-21", "АФК-22",
  "АФК-31", "АФК-32",
  "АФК-41", "АФК-42",
  // Дошкольное образование
  "ДОУ-11",
];

/** Backwards-compat alias — picks the right list based on corpus. */
export function fallbackGroups(corpus: 1 | 2): string[] {
  return corpus === 2 ? FALLBACK_GROUPS_2 : FALLBACK_GROUPS_1;
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
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря",
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

/** Fetch the schedule for a single ISO date + corpus. */
export function useDaySchedule(date: string | null, corpus: 1 | 2 = 1) {
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
    fetch(`/api/schedule/day?date=${encodeURIComponent(date)}&corpus=${corpus}`)
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
  }, [date, corpus]);

  return { data, error, loading };
}

/** Fetch several days at once (for the "week" view). */
export function useWeekSchedule(startDate: string | null, days: number, corpus: 1 | 2 = 1) {
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
        fetch(`/api/schedule/day?date=${encodeURIComponent(date)}&corpus=${corpus}`)
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
  }, [startDate, days, corpus]);

  return { items, loading };
}
