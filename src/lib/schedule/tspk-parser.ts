/**
 * TSPK schedule parser.
 *
 * Source: https://tspk.org/studentam/novoe-raspisanie-demo.html
 *
 * The TSPK page contains TWO calendars — one for building 1 ("1 корпус",
 * Мурысева 84) and one for building 2 ("2 корпус", Ленинградская 28).
 * Each day cell links to a Google Spreadsheet with the actual schedule.
 * We:
 *   1. Fetch the calendar HTML from tspk.org.
 *   2. For each day cell, extract: corpus (1/2), spreadsheetId, optional
 *      gid (sheet id — corpus-2 spreadsheets store the schedule on a
 *      non-default sheet).
 *   3. To get the schedule for a specific day, fetch the spreadsheet as
 *      CSV via https://docs.google.com/spreadsheets/d/{ID}/gviz/tq?tqx=out:csv
 *      (&gid={gid} if present) and parse the multi-table CSV structure.
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
  /** Corpus (building): 1 or 2 */
  corpus: 1 | 2;
  /** Google Spreadsheet ID or null if no lessons that day */
  spreadsheetId: string | null;
  /** Optional Google Sheets sheet ID (gid) — corpus-2 days use a
   * non-default sheet, so we must request it explicitly. */
  gid: string | null;
}

export interface Lesson {
  number: number;
  time: string;
  subject: string;
  teacher: string;
  room: string;
  raw: string;
}

export interface DaySchedule {
  /** ISO date YYYY-MM-DD */
  date: string;
  /** Corpus (1 or 2) */
  corpus: 1 | 2;
  /** Human-readable header from the CSV */
  header: string;
  /** Day of week in Russian */
  dayOfWeek: string;
  /** All groups mentioned across all sub-tables in this CSV */
  groups: string[];
  /** Schedule grouped by group name */
  scheduleByGroup: Record<string, Lesson[]>;
  /** True when the CSV says "нет занятий" or contains no lessons */
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

const normalizeGroupName = (raw: string): string => {
  if (!raw) return "";
  let s = raw.replace(/\s+/g, " ").trim();
  s = s.replace(/[.,;:]+$/g, "").trim();
  return s;
};

/**
 * Parse the TSPK calendar HTML and return a flat list of CalendarEntry.
 * Days with no lessons (link = #norasp / empty) still appear with
 * spreadsheetId === null.
 *
 * The two calendars on the page (corpus 1 and corpus 2) are distinguished
 * by the `name` attribute of the slider radio inputs inside their
 * container: "toggle" for corpus 1, "toggle2" for corpus 2.
 */
export function parseCalendarHtml(html: string): CalendarEntry[] {
  const $ = cheerio.load(html);
  const entries: CalendarEntry[] = [];

  // The HTML has THREE .table-raspisanie-cell containers:
  //   [0] — the outer wrapper containing BOTH corpora (has both toggle and
  //         toggle2 inputs as descendants, and ~20 .cal tables)
  //   [1] — corpus-1-only (has toggle, no toggle2, ~10 .cal tables)
  //   [2] — corpus-2-only (has toggle2, no toggle, ~10 .cal tables)
  // We want the inner ones ([1] and [2]) — they are distinguished by
  // having ONE of the names but not the other.
  const corpus1Container = $('div.table-raspisanie-cell')
    .filter(function () {
      const c = $(this);
      return c.find('input[name="toggle"]').length > 0 && c.find('input[name="toggle2"]').length === 0;
    })
    .first();
  const corpus2Container = $('div.table-raspisanie-cell')
    .filter(function () {
      const c = $(this);
      return c.find('input[name="toggle2"]').length > 0 && c.find('input[name="toggle"]').length === 0;
    })
    .first();

  const parseTables = (container: cheerio.Cheerio<cheerio.AnyNode>, corpus: 1 | 2) => {
    container.find(".cal").each((_, cal) => {
      const caption = $(cal).find("caption").first().text().replace(/[«»]/g, " ").trim();
      const m = caption.match(/([А-Яа-яЁё]+)\s+(\d{4})/);
      if (!m) return;
      const monthIdx = MONTH_NAMES_RU[m[1].toLowerCase()];
      if (monthIdx === undefined) return;
      const year = parseInt(m[2], 10);

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
          let gid: string | null = null;
          const idMatch = href.match(/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/);
          if (idMatch) spreadsheetId = idMatch[1];
          const gidMatch = href.match(/gid=(\d+)/);
          if (gidMatch) gid = gidMatch[1];

          const date = `${year}-${pad(monthIdx + 1)}-${pad(day)}`;
          entries.push({ date, corpus, spreadsheetId, gid });
        }
      }
    });
  };

  parseTables(corpus1Container, 1);
  parseTables(corpus2Container, 2);

  // De-duplicate per (corpus, date) — border days may appear in two months.
  const byKey = new Map<string, CalendarEntry>();
  for (const e of entries) {
    const key = `${e.corpus}:${e.date}`;
    const prev = byKey.get(key);
    if (!prev || (prev.spreadsheetId === null && e.spreadsheetId !== null)) {
      byKey.set(key, e);
    }
  }
  return Array.from(byKey.values()).sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.corpus - b.corpus;
  });
}

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

/** Find calendar entry for a given ISO date + corpus. */
export function findCalendarEntry(
  entries: CalendarEntry[],
  isoDate: string,
  corpus: 1 | 2 = 1,
): CalendarEntry | undefined {
  return entries.find((e) => e.date === isoDate && e.corpus === corpus);
}

// ---------------------------------------------------------------------------
// DAY SCHEDULE PARSER (CSV)
// ---------------------------------------------------------------------------

/** Fetch the spreadsheet as CSV. If gid is given, requests that specific sheet. */
export async function fetchSpreadsheetCsv(
  spreadsheetId: string,
  gid: string | null = null,
): Promise<string> {
  let url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv`;
  if (gid) url += `&gid=${gid}`;
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
 * For corpus-2 schedules, the TSPK calendar on tspk.org links to outdated
 * 2022 spreadsheets. The ACTUAL corpus-2 schedule for a given day lives
 * inside the SAME spreadsheet as corpus-1 for that day, but on a different
 * sheet (gid). Different days use different gids.
 *
 * To find the right gid, we fetch the spreadsheet's htmlview page and
 * extract every gid mentioned, then probe each one and pick the sheet
 * whose header mentions corpus-2 group prefixes (ФК- / АФК- / ДОУ-).
 *
 * Returns null if no corpus-2 sheet is found in this spreadsheet.
 */
export async function findCorpus2Gid(spreadsheetId: string): Promise<string | null> {
  const htmlviewUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/htmlview`;
  const res = await fetchWithTimeout(
    htmlviewUrl,
    {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,*/*",
      },
    },
    20000,
  );
  if (!res.ok) {
    return null;
  }
  const html = await res.text();
  // Extract all gid values mentioned in the page (typically 3-5).
  const gidMatches = new Set<string>(
    Array.from(html.matchAll(/gid=(\d+)/g)).map((m) => m[1]),
  );
  // gid=0 is the default sheet (corpus-1); skip it.
  gidMatches.delete("0");

  // Probe each non-default sheet in parallel, look for corpus-2 group prefixes.
  const probes = await Promise.all(
    Array.from(gidMatches).map(async (gid) => {
      try {
        const csv = await fetchSpreadsheetCsv(spreadsheetId, gid);
        // Corpus-2 sheets always have headers mentioning ФК-/АФК-/ДОУ- groups.
        if (/ФК-\d|АФК-\d|ДОУ-\d/u.test(csv.slice(0, 4000))) {
          return gid;
        }
      } catch {
        /* ignore — try next */
      }
      return null;
    }),
  );
  const hit = probes.find((g) => g !== null);
  return hit ?? null;
}

function normalizeFallbackTime(s: string): string {
  const parts = s
    .replace(/\r/g, "")
    .split(/[\n\s]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  return `${parts[0]}-${parts[1]}`;
}

/** Regex for a time range like "8.30-9.05" or "9.10 – 9.45". */
const TIME_RANGE_RE = /(\d{1,2}\.\d{2})\s*[-–]\s*(\d{1,2}\.\d{2})/g;
/** Regex for a teacher name like "Кондурар М.В." or "Шаров С.А.". */
const TEACHER_RE = /([А-ЯЁ][а-яё]+(?:-[А-ЯЁ][а-яё]+)?)\s+([А-ЯЁ]\.\s*[А-ЯЁ]\.)/;
/** Regex for a room like "каб.111" / "ауд. 12" / "корп.2". */
const ROOM_RE = /((?:каб|ауд|корпус|корп)\.?\s*[\d\w-]+)/i;

/**
 * Parse a single chunk of a lesson cell — extract subject, teacher, room.
 * `chunk` is the text BETWEEN two time markers (or from start to first
 * time marker). The time itself is passed separately as `rangeStr`.
 */
function parseLessonChunk(chunk: string, rangeStr: string): {
  subject: string;
  teacher: string;
  room: string;
} {
  const lines = chunk
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  let teacher = "";
  let room = "";

  for (const line of lines) {
    const tr = line.match(TEACHER_RE);
    if (tr && !teacher) teacher = tr[0].trim();
    const rm = line.match(ROOM_RE);
    if (rm && !room) room = rm[0].trim();
  }

  // Subject: first non-empty line, with time / teacher / room stripped.
  const firstLine = lines[0] || "";
  let subj = firstLine;
  subj = subj.replace(/^\s*\d{1,2}\.\d{2}\s*[-–]\s*\d{1,2}\.\d{2}\s*/, "");
  subj = subj.replace(/^\s*\d{1,2}\.\d{2}\s+/, "");
  if (teacher) subj = subj.replace(teacher, "").trim();
  if (room) subj = subj.replace(room, "").trim();
  subj = subj.replace(/^[—\-:\s,]+/, "").trim();

  if (!subj) {
    subj = firstLine
      .replace(/^\s*\d{1,2}\.\d{2}\s*[-–]\s*\d{1,2}\.\d{2}\s*/, "")
      .replace(/^\s*\d{1,2}\.\d{2}\s+/, "")
      .trim();
  }
  if (!subj) subj = chunk.trim();
  if (subj.length > 200) subj = subj.slice(0, 200) + "…";

  return { subject: subj, teacher, room };
}

/**
 * Parse a lesson cell. A cell may contain MULTIPLE lessons when a single
 * pair is split (e.g. "8.30-9.05 Классный час … Кондурар М.В. каб.111
 *   9.10-9.45 МДК 09.01 … Шаров С.А. каб.314"). In that case we return
 * one Lesson per time range found.
 *
 * Returns an empty array if the cell is empty.
 */
function parseLessonCell(cell: string, fallbackTimeRaw: string): Lesson[] {
  const raw = (cell || "").trim();
  if (!raw) return [];
  const fallbackTime = normalizeFallbackTime(fallbackTimeRaw);

  // "ПРАКТИКА" — single virtual lesson.
  if (raw === "ПРАКТИКА" || raw === "Практика" || raw === "ПРАКТИКА.") {
    return [
      {
        number: 0,
        time: fallbackTime,
        subject: "Практика",
        teacher: "",
        room: "",
        raw,
      },
    ];
  }

  // Find every time range in the cell. Each one starts a new sub-lesson.
  // We collect matches with their start index, then split the cell text
  // into chunks: text BEFORE the first range, then text BETWEEN ranges,
  // then text AFTER the last range (the trailing chunk belongs to the
  // last range's subject).
  const matches: { start: number; end: number; from: string; to: string }[] = [];
  // Reset regex state by using a fresh exec loop.
  const re = new RegExp(TIME_RANGE_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    matches.push({
      start: m.index,
      end: m.index + m[0].length,
      from: m[1],
      to: m[2],
    });
  }

  // No time ranges in the cell → single lesson with fallback time.
  if (matches.length === 0) {
    const { subject, teacher, room } = parseLessonChunk(raw, "");
    return [
      {
        number: 0,
        time: fallbackTime,
        subject,
        teacher,
        room,
        raw,
      },
    ];
  }

  // For each match i, the chunk it owns is the text from match[i].end
  // up to match[i+1].start (or end of cell for the last one). The text
  // BEFORE match[0].start (the cell prefix) is prepended to the first
  // chunk — sometimes the subject starts on a line before the time.
  const lessons: Lesson[] = [];
  const prefix = raw.slice(0, matches[0].start).trim();

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const chunkStart = i === 0 ? m.end : m.end;
    const chunkEnd = i + 1 < matches.length ? matches[i + 1].start : raw.length;
    let chunk = raw.slice(chunkStart, chunkEnd);
    if (i === 0 && prefix) {
      chunk = prefix + "\n" + chunk;
    }
    const rangeStr = `${m.from}-${m.to}`;
    const { subject, teacher, room } = parseLessonChunk(chunk, rangeStr);
    lessons.push({
      number: 0,
      time: rangeStr,
      subject,
      teacher,
      room,
      raw: chunk.trim() || raw,
    });
  }
  return lessons;
}

export function parseDayScheduleCsv(
  csv: string,
  isoDate: string,
  corpus: 1 | 2 = 1,
): DaySchedule {
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

  if (rows.length > 0 && rows[0].length > 0) {
    header = rows[0][0].replace(/\s+/g, " ").trim();
    const dowMatch = header.match(/\(([А-Яа-яЁё]+)\)/);
    if (dowMatch) {
      dayOfWeek = capitalize(dowMatch[1]);
    }
  }
  if (!dayOfWeek) {
    const d = new Date(isoDate + "T00:00:00");
    dayOfWeek = DAY_OF_WEEK_RU[d.getDay()] || "";
  }

  if (header.toLowerCase().includes("нет занятий") || header.toLowerCase().includes("выходной")) {
    noLessons = true;
  }

  let currentGroups: string[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || [];
    const col0 = (row[0] || "").toString().trim();
    const col1 = (row[1] || "").toString().trim();

    if (col1.toLowerCase().includes("время")) {
      currentGroups = [];
      for (let c = 2; c < row.length; c++) {
        const g = normalizeGroupName(row[c] || "");
        if (!g) continue;
        if (g.length > 60 || /согласовано|директора|зам\./i.test(g)) continue;
        currentGroups.push(g);
        groupSet.add(g);
        if (!scheduleByGroup[g]) scheduleByGroup[g] = [];
      }
      continue;
    }

    const num = parseInt(col0, 10);
    if (!Number.isFinite(num) || num < 1 || num > 12) continue;

    const fallbackTime = col1.replace(/\s+/g, " ").trim();
    for (let gi = 0; gi < currentGroups.length; gi++) {
      const g = currentGroups[gi];
      const cell = row[2 + gi] || "";
      const lessons = parseLessonCell(cell, fallbackTime);
      if (lessons.length === 0) continue;
      for (const lesson of lessons) {
        lesson.number = num;
        scheduleByGroup[g].push(lesson);
      }
    }
  }

  // De-duplicate lessons per group (some tables list the same pair twice).
  // We de-dup by (number, time, subject) — so two different subjects in the
  // same pair (e.g. "Классный час" + "МДК 09.01") are BOTH kept.
  for (const g of Object.keys(scheduleByGroup)) {
    const seen = new Set<string>();
    scheduleByGroup[g] = scheduleByGroup[g].filter((l) => {
      const key = `${l.number}|${l.time}|${l.subject}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    scheduleByGroup[g].sort((a, b) => {
      if (a.number !== b.number) return a.number - b.number;
      // Within the same pair, sort by start time.
      const aStart = a.time.match(/^(\d{1,2}\.\d{2})/)?.[1] ?? "";
      const bStart = b.time.match(/^(\d{1,2}\.\d{2})/)?.[1] ?? "";
      return aStart.localeCompare(bStart);
    });
  }

  const groups = Array.from(groupSet).sort();

  return {
    date: isoDate,
    corpus,
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

/** Fetch and parse the full schedule for a single day. */
export async function fetchDaySchedule(
  entry: CalendarEntry,
): Promise<DaySchedule | null> {
  if (!entry.spreadsheetId) {
    return {
      date: entry.date,
      corpus: entry.corpus,
      header: "",
      dayOfWeek: getDayOfWeekRu(entry.date),
      groups: [],
      scheduleByGroup: {},
      noLessons: true,
    };
  }
  // For corpus 2, the spreadsheetId from the TSPK calendar is outdated
  // (links to 2022 spreadsheets). The real corpus-2 schedule lives in the
  // SAME spreadsheet as corpus-1 for that day, but on a different sheet
  // (gid). We probe that spreadsheet's htmlview to find the right gid.
  if (entry.corpus === 2) {
    // entry.spreadsheetId here is the corpus-1 spreadsheet's id (set by
    // the API route, which looks up the corpus-1 entry for this date).
    const gid = await findCorpus2Gid(entry.spreadsheetId);
    if (gid === null) {
      return {
        date: entry.date,
        corpus: entry.corpus,
        header: "",
        dayOfWeek: getDayOfWeekRu(entry.date),
        groups: [],
        scheduleByGroup: {},
        noLessons: true,
      };
    }
    const csv = await fetchSpreadsheetCsv(entry.spreadsheetId, gid);
    return parseDayScheduleCsv(csv, entry.date, entry.corpus);
  }
  const csv = await fetchSpreadsheetCsv(entry.spreadsheetId, entry.gid);
  return parseDayScheduleCsv(csv, entry.date, entry.corpus);
}

export function getDayOfWeekRu(isoDate: string): string {
  const d = new Date(isoDate + "T00:00:00");
  return DAY_OF_WEEK_RU[d.getDay()] || "";
}
