/**
 * TSPK schedule parser.
 *
 * Source: https://tspk.org/studentam/novoe-raspisanie-demo.html
 *
 * The TSPK page is a calendar: each day cell contains a link to a Google
 * Spreadsheet with the actual schedule for that day. We:
 *   1. Fetch the calendar HTML from tspk.org.
 *   2. For every day cell, extract the Google Spreadsheet ID (or null if no
 *      lessons that day — link points to #norasp).
 *   3. To get the schedule for a specific day, fetch the spreadsheet as CSV
 *      via https://docs.google.com/spreadsheets/d/{ID}/gviz/tq?tqx=out:csv
 *      and parse the multi-table CSV structure (one spreadsheet can contain
 *      several sub-tables — one per course / corpus / building block).
 */

import * as cheerio from "cheerio";
import { parse as parseCsvString } from "csv-parse/sync";

const TSPK_URL = "https://tspk.org/studentam/novoe-raspisanie-demo.html";
const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const MONTH_NAMES_RU: Record<string, number> = {
  январь: 0,
  февраль: 1,
  март: 2,
  апрель: 3,
  май: 4,
  июнь: 5,
  июль: 6,
  август: 7,
  сентябрь: 8,
  октябрь: 9,
  ноябрь: 10,
  декабрь: 11,
};

export interface CalendarEntry {
  /** ISO date string YYYY-MM-DD */
  date: string;
  /** Google Spreadsheet ID or null if no lessons */
  spreadsheetId: string | null;
}

export interface Lesson {
  /** Pair number (1, 2, 3, ...) — from the first column */
  number: number;
  /** Lesson time, e.g. "14.40-15.40" (taken from row[1]) */
  time: string;
  /** Lesson subject (discipline), e.g. "МДК 03.05 Детская литература..." */
  subject: string;
  /** Teacher name, e.g. "Хлопова Е.Н." — or empty if not parsed */
  teacher: string;
  /** Room, e.g. "каб.214" — or empty if not parsed */
  room: string;
  /** Raw cell content (for debugging / fallback display) */
  raw: string;
}

export interface DaySchedule {
  /** ISO date YYYY-MM-DD */
  date: string;
  /** Human-readable header from the CSV (e.g. "Расписание занятий на 01 октября (среда) 2026-2027 уч.года") */
  header: string;
  /** Day of week in Russian, e.g. "Среда" — derived from header or fallback to JS Date */
  dayOfWeek: string;
  /** All groups mentioned across all sub-tables in this CSV */
  groups: string[];
  /** Schedule grouped by group name */
  scheduleByGroup: Record<string, Lesson[]>;
  /** True when the CSV explicitly says "нет занятий" or contains no lessons */
  noLessons: boolean;
}

const fetchWithTimeout = async (url: string, opts: RequestInit = {}, ms = 15000) => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
};

const pad = (n: number) => String(n).padStart(2, "0");

const DAY_OF_WEEK_RU = [
  "Воскресенье",
  "Понедельник",
  "Вторник",
  "Среда",
  "Четверг",
  "Пятница",
  "Суббота",
];

// ---------------------------------------------------------------------------
// CALENDAR PARSER
// ---------------------------------------------------------------------------

/** Strip junk from group name: "Д-41 " → "Д-41", also handles some edge cases. */
const normalizeGroupName = (raw: string): string => {
  if (!raw) return "";
  let s = raw.replace(/\s+/g, " ").trim();
  // Drop trailing punctuation
  s = s.replace(/[.,;:]+$/g, "").trim();
  return s;
};

/**
 * Parse the TSPK calendar page and return a list of {date, spreadsheetId}.
 * Days with no lessons (link = #norasp / empty) still appear with
 * spreadsheetId === null.
 */
export async function fetchTspkCalendar(): Promise<CalendarEntry[]> {
  const res = await fetchWithTimeout(TSPK_URL, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "ru-RU,ru;q=0.9",
    },
  });
  if (!res.ok) {
    throw new Error(`tspk.org returned ${res.status}`);
  }
  const html = await res.text();
  return parseCalendarHtml(html);
}

export function parseCalendarHtml(html: string): CalendarEntry[] {
  const $ = cheerio.load(html);
  const entries: CalendarEntry[] = [];

  $(".cal").each((_, cal) => {
    const caption = $(cal).find("caption").first().text().replace(/[«»]/g, " ").trim();
    // caption looks like "Сентябрь 2026" or "Октябрь 2026"
    const m = caption.match(/([А-Яа-яЁё]+)\s+(\d{4})/);
    if (!m) return;
    const monthIdx = MONTH_NAMES_RU[m[1].toLowerCase()];
    if (monthIdx === undefined) return;
    const year = parseInt(m[2], 10);

    // First row is the weekday header (Пн, Вт, ...); skip it.
    const rows = $(cal).find("tbody tr").toArray().slice(1);
    for (const tr of rows) {
      const cells = $(tr).find("td").toArray();
      for (const td of cells) {
        const cellText = $(td).text().trim();
        const dayMatch = cellText.match(/^(\d{1,2})/);
        if (!dayMatch) continue;
        const day = parseInt(dayMatch[1], 10);
        if (!day || day > 31) continue;

        const href = $(td).find("a").attr("href") || "";
        let spreadsheetId: string | null = null;
        const idMatch = href.match(/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/);
        if (idMatch) spreadsheetId = idMatch[1];

        const date = `${year}-${pad(monthIdx + 1)}-${pad(day)}`;
        entries.push({ date, spreadsheetId });
      }
    }
  });

  // De-duplicate: when the same date appears in two calendars (border days),
  // prefer entries that have a spreadsheetId.
  const byDate = new Map<string, CalendarEntry>();
  for (const e of entries) {
    const prev = byDate.get(e.date);
    if (!prev || (prev.spreadsheetId === null && e.spreadsheetId !== null)) {
      byDate.set(e.date, e);
    }
  }
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/** Find calendar entry for a given ISO date. */
export function findCalendarEntry(
  entries: CalendarEntry[],
  isoDate: string,
): CalendarEntry | undefined {
  return entries.find((e) => e.date === isoDate);
}

// ---------------------------------------------------------------------------
// DAY SCHEDULE PARSER (CSV)
// ---------------------------------------------------------------------------

/** Fetch the spreadsheet as CSV. Throws on non-200 / empty body. */
export async function fetchSpreadsheetCsv(spreadsheetId: string): Promise<string> {
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv`;
  const res = await fetchWithTimeout(
    url,
    {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/csv,*/*",
      },
    },
    20000,
  );
  if (!res.ok) {
    throw new Error(`Google Sheets returned ${res.status} for id ${spreadsheetId}`);
  }
  const text = await res.text();
  if (!text || text.trim().length === 0) {
    throw new Error(`Empty CSV for spreadsheet ${spreadsheetId}`);
  }
  return text;
}

/**
 * Normalize a fallback time string. The CSV often stores pair time as two
 * lines ("14.40\n15.40") instead of a proper range "14.40-15.40". We
 * collapse those into a single range string.
 */
function normalizeFallbackTime(s: string): string {
  const parts = s
    .replace(/\r/g, "")
    .split(/[\n\s]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  // Two time stamps → range
  return `${parts[0]}-${parts[1]}`;
}

/** Parse a single lesson cell — extract subject, teacher, room, embedded time. */
function parseLessonCell(cell: string, fallbackTimeRaw: string): Lesson | null {
  const raw = (cell || "").trim();
  const fallbackTime = normalizeFallbackTime(fallbackTimeRaw);
  if (!raw) return null;
  if (raw === "ПРАКТИКА" || raw === "Практика" || raw === "ПРАКТИКА.") {
    return {
      number: 0,
      time: fallbackTime,
      subject: "Практика",
      teacher: "",
      room: "",
      raw,
    };
  }

  // Normalize various newlines / weird spacing.
  const lines = raw
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  let subject = "";
  let teacher = "";
  let room = "";
  let time = fallbackTime;

  // Teacher pattern: "Фамилия И.О." — Cyrillic surname + initials
  const teacherRe = /([А-ЯЁ][а-яё]+(?:-[А-ЯЁ][а-яё]+)?)\s+([А-ЯЁ]\.\s*[А-ЯЁ]\.)/;
  // Room patterns: "каб.214", "каб. 305", "ауд. 12", "корп.2"
  const roomRe = /((?:каб|ауд|корпус|корп)\.?\s*[\d\w-]+)/i;

  // Time pattern: either "9.40-10.40" or just "9.40" at the start of a line
  const timeRangeRe = /(\d{1,2}\.\d{2})\s*[-–]\s*(\d{1,2}\.\d{2})/;
  const timeSingleRe = /^(\d{1,2}\.\d{2})/;

  // Try to find embedded time like "9.40-10.40" anywhere in the cell
  for (const line of lines) {
    const tm = line.match(timeRangeRe);
    if (tm) {
      time = `${tm[1]}-${tm[2]}`;
      continue;
    }
    // Single time at the very start of the first line — override fallback
    if (line === lines[0]) {
      const ts = line.match(timeSingleRe);
      if (ts && fallbackTime === "") {
        time = ts[1];
      }
    }
    const tr = line.match(teacherRe);
    if (tr && !teacher) teacher = tr[0].trim();
    const rm = line.match(roomRe);
    if (rm && !room) room = rm[0].trim();
  }

  // Subject: take the first line, strip leading time (range or single), strip
  // teacher/room suffixes.
  const firstLine = lines[0] || "";
  let subj = firstLine;
  // Strip leading embedded time range
  subj = subj.replace(/^\s*\d{1,2}\.\d{2}\s*[-–]\s*\d{1,2}\.\d{2}\s*/, "");
  // Strip leading single time stamp
  subj = subj.replace(/^\s*\d{1,2}\.\d{2}\s+/, "");
  // Strip teacher / room chunks from subject line
  if (teacher) subj = subj.replace(teacher, "").trim();
  if (room) subj = subj.replace(room, "").trim();
  subj = subj.replace(/^[—\-:\s,]+/, "").trim();

  // If subject is empty but raw has multiple lines, use first line as-is.
  if (!subj) {
    subj = firstLine
      .replace(/^\s*\d{1,2}\.\d{2}\s*[-–]\s*\d{1,2}\.\d{2}\s*/, "")
      .replace(/^\s*\d{1,2}\.\d{2}\s+/, "")
      .trim();
  }

  // If still empty, fall back to the whole cell.
  if (!subj) subj = raw;

  return {
    number: 0,
    time,
    subject: subj || raw,
    teacher,
    room,
    raw,
  };
}

/**
 * Parse the CSV (one Google Spreadsheet may contain several sub-tables, each
 * with its own header row mentioning "Время" and the list of groups).
 */
export function parseDayScheduleCsv(csv: string, isoDate: string): DaySchedule {
  // Google Sheets CSVs can be inconsistent; use a tolerant parser.
  const rows: string[][] = parseCsvString(csv, {
    relax_column_count: true,
    skip_empty_lines: false,
    trim: false,
  });

  const scheduleByGroup: Record<string, Lesson[]> = {};
  const groupSet = new Set<string>();
  let header = "";
  let dayOfWeek = "";
  let noLessons = false;

  // Try to extract header from the very first cell of the very first row.
  if (rows.length > 0 && rows[0].length > 0) {
    header = rows[0][0].replace(/\s+/g, " ").trim();
    // Looks like: "Расписание занятий на 01 сентября (вторник) 2026-2027 уч.года Пара"
    const dowMatch = header.match(/\(([А-Яа-яЁё]+)\)/);
    if (dowMatch) {
      dayOfWeek = capitalize(dowMatch[1]);
    }
  }
  if (!dayOfWeek) {
    const d = new Date(isoDate + "T00:00:00");
    dayOfWeek = DAY_OF_WEEK_RU[d.getDay()] || "";
  }

  // Detect "no lessons" markers.
  if (header.toLowerCase().includes("нет занятий") || header.toLowerCase().includes("выходной")) {
    noLessons = true;
  }

  // Walk through rows. A sub-table header row has "Время" in the second column
  // (index 1). All subsequent rows with a numeric first column are lessons
  // for the current sub-table's groups.
  let currentGroups: string[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || [];
    const col0 = (row[0] || "").toString().trim();
    const col1 = (row[1] || "").toString().trim();

    // Sub-table header row — column 1 contains "Время".
    if (col1.toLowerCase().includes("время")) {
      currentGroups = [];
      for (let c = 2; c < row.length; c++) {
        const g = normalizeGroupName(row[c] || "");
        if (!g) continue;
        // Skip non-group junk ("Согласовано:", "Зам. директора", etc.).
        if (g.length > 60 || /согласовано|директора|зам\./i.test(g)) continue;
        currentGroups.push(g);
        groupSet.add(g);
        if (!scheduleByGroup[g]) scheduleByGroup[g] = [];
      }
      continue;
    }

    // Lesson row — first column is a pair number (1, 2, 3, ...).
    const num = parseInt(col0, 10);
    if (!Number.isFinite(num) || num < 1 || num > 12) continue;

    const fallbackTime = col1.replace(/\s+/g, " ").trim();
    for (let gi = 0; gi < currentGroups.length; gi++) {
      const g = currentGroups[gi];
      const cell = row[2 + gi] || "";
      const lesson = parseLessonCell(cell, fallbackTime);
      if (!lesson) continue;
      lesson.number = num;
      scheduleByGroup[g].push(lesson);
    }
  }

  // De-duplicate lessons per group (some tables list the same pair twice).
  for (const g of Object.keys(scheduleByGroup)) {
    const seen = new Set<string>();
    scheduleByGroup[g] = scheduleByGroup[g].filter((l) => {
      const key = `${l.number}|${l.subject}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    scheduleByGroup[g].sort((a, b) => a.number - b.number);
  }

  const groups = Array.from(groupSet).sort();

  return {
    date: isoDate,
    header,
    dayOfWeek,
    groups,
    scheduleByGroup,
    noLessons,
  };
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/**
 * Fetch and parse the full schedule for a single day.
 * Returns null if there are no lessons that day (no spreadsheetId).
 */
export async function fetchDaySchedule(
  entry: CalendarEntry,
): Promise<DaySchedule | null> {
  if (!entry.spreadsheetId) {
    return {
      date: entry.date,
      header: "",
      dayOfWeek: getDayOfWeekRu(entry.date),
      groups: [],
      scheduleByGroup: {},
      noLessons: true,
    };
  }
  const csv = await fetchSpreadsheetCsv(entry.spreadsheetId);
  return parseDayScheduleCsv(csv, entry.date);
}

export function getDayOfWeekRu(isoDate: string): string {
  const d = new Date(isoDate + "T00:00:00");
  return DAY_OF_WEEK_RU[d.getDay()] || "";
}
