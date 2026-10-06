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

/** View mode: filter by group / teacher / room. */
export type ViewMode = "group" | "teacher" | "room";

/** A Lesson with the group name attached — used when filtering by teacher
 *  or room (where the user needs to know which group the lesson belongs to). */
export interface LessonWithGroup extends Lesson {
  group: string;
}

/** Flatten scheduleByGroup into a single array of {Lesson + group}. */
export function flattenSchedule(schedule: DaySchedule): LessonWithGroup[] {
  const out: LessonWithGroup[] = [];
  for (const [group, lessons] of Object.entries(schedule.scheduleByGroup)) {
    for (const lesson of lessons) {
      out.push({ ...lesson, group });
    }
  }
  return out;
}

/** All distinct teacher names in the schedule. */
export function extractTeachers(schedule: DaySchedule): string[] {
  const set = new Set<string>();
  for (const lessons of Object.values(schedule.scheduleByGroup)) {
    for (const l of lessons) {
      if (l.teacher) set.add(l.teacher);
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "ru"));
}

/** All distinct room labels in the schedule. */
export function extractRooms(schedule: DaySchedule): string[] {
  const set = new Set<string>();
  for (const lessons of Object.values(schedule.scheduleByGroup)) {
    for (const l of lessons) {
      if (l.room) set.add(l.room);
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "ru"));
}

/**
 * Filter the schedule's flat lesson list by the active view mode and value.
 * Returns lessons sorted by (pair number, start time, group).
 */
export function filterLessons(
  schedule: DaySchedule,
  mode: ViewMode,
  value: string,
): LessonWithGroup[] {
  const flat = flattenSchedule(schedule);
  const matches = flat.filter((l) => {
    if (mode === "group") return l.group === value;
    if (mode === "teacher") return l.teacher === value;
    if (mode === "room") return l.room === value;
    return false;
  });
  matches.sort((a, b) => {
    if (a.number !== b.number) return a.number - b.number;
    const at = a.time.match(/^(\d{1,2}\.\d{2})/)?.[1] ?? "";
    const bt = b.time.match(/^(\d{1,2}\.\d{2})/)?.[1] ?? "";
    if (at !== bt) return at.localeCompare(bt);
    return a.group.localeCompare(b.group);
  });
  return matches;
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

/** Timezone for the bot — Samara / GMT+4 (no DST). Override via param. */
export const TSPK_TZ = "Europe/Samara";

/**
 * Returns the current hour (0-23) in the bot's timezone (Samara / GMT+4).
 */
export function currentHourInTz(now = new Date(), tz: string = TSPK_TZ): number {
  // en-GB gives "HH:MM:SS" — hour is the first 2 chars.
  const s = now.toLocaleTimeString("en-GB", { timeZone: tz, hour: "2-digit" });
  return parseInt(s.slice(0, 2), 10);
}

/**
 * Decide whether the "no lessons" state for a given date is FINAL (the day
 * is genuinely over — weekend, past, or today's 22:00 deadline has passed)
 * or TEMPORARY (a weekday we're still waiting on the TSPK editors to upload).
 *
 *  - Weekend (Sat/Sun) → final — "Выходной"
 *  - Past weekday → final — "Занятий нет" (the day is gone, schedule
 *    won't appear anymore)
 *  - Today + hour >= 22:00 → final — TSPK uploads by 22:00; if we still
 *    don't have a schedule, it's a real holiday
 *  - Today + hour < 22:00 → temporary — "Расписания пока нет"
 *  - Future weekday → temporary — "Расписания пока нет"
 */
export function noLessonsIsFinal(
  isoDate: string,
  now: Date = new Date(),
  tz: string = TSPK_TZ,
): boolean {
  const d = new Date(isoDate + "T00:00:00");
  // Day of week: 0=Sun, 6=Sat. Weekend = Sat/Sun.
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return true;

  const today = todayIso(now);
  if (isoDate < today) return true; // past day
  if (isoDate === today) {
    return currentHourInTz(now, tz) >= 22;
  }
  // future day → still waiting
  return false;
}

/**
 * ISO date of the Monday of the week containing `now` (or the week offset
 * by `weekOffset` weeks). Week starts on Monday (Russian calendar).
 *
 * weekOffset=0 → Monday of the current week.
 * weekOffset=-1 → Monday of the previous week.
 *
 * Works regardless of which day of the week `now` is — Sunday will still
 * give the Monday that started THIS week, not next week.
 */
export function weekStartIso(weekOffset: number = 0, now = new Date()): string {
  const d = new Date(now);
  // JS getDay(): 0=Sun, 1=Mon, ..., 6=Sat. We want days since Monday.
  // If today is Sunday (0) → 6 days since Monday. Else (getDay() - 1).
  const daysSinceMonday = d.getDay() === 0 ? 6 : d.getDay() - 1;
  d.setDate(d.getDate() - daysSinceMonday + weekOffset * 7);
  return todayIso(d);
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
    // Reset stale data IMMEDIATELY when date/corpus changes — otherwise
    // the UI flashes "group not found" because the previous schedule
    // (for the other corpus) doesn't contain the new corpus's groups.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData(null);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(null);
    setLoading(true);
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
    // Reset stale data immediately when corpus/startDate changes — same
    // race condition as in useDaySchedule (otherwise we briefly render
    // yesterday's corpus with today's selected group).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems([]);
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
