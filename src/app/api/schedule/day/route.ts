import { NextRequest, NextResponse } from "next/server";
import {
  fetchTspkCalendar,
  findCalendarEntry,
  fetchDaySchedule,
  fetchZaochSheetCsvs,
  parseZaochSchedule,
  fetchDpoSchedule,
  getDayOfWeekRu,
  type DaySchedule,
  type Dept,
} from "@/lib/schedule/tspk-parser";
import { cached } from "@/lib/schedule/cache";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/schedule/day?date=YYYY-MM-DD&dept=1|2|zaoch|dpo
 * (legacy: ?corpus=1|2 is still accepted and maps to dept 1|2)
 *
 * Returns the full schedule for that day + отделение.
 *
 * If ?group=Д-41 is provided, the response still contains the full schedule
 * (the client filters) — but groups[] is reduced to just the requested group
 * for convenience.
 *
 * Cached per (dept, date) for 5 minutes; the заочное semester spreadsheet's
 * raw sheet CSVs are cached for 30 minutes.
 */
export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  const deptRaw = req.nextUrl.searchParams.get("dept") || "";
  const corpusRaw = req.nextUrl.searchParams.get("corpus") || "1";
  const dept: Dept =
    deptRaw === "zaoch" || deptRaw === "dpo"
      ? deptRaw
      : deptRaw === "2" || corpusRaw === "2"
        ? "2"
        : "1";

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { ok: false, error: "Query param 'date' must be in YYYY-MM-DD format" },
      { status: 400 },
    );
  }

  const noLessonsFallback: DaySchedule = {
    date,
    corpus: 1,
    header: "",
    dayOfWeek: getDayOfWeekRu(date),
    groups: [],
    scheduleByGroup: {},
    noLessons: true,
    ...(dept === "zaoch" || dept === "dpo" ? { dept } : {}),
  };

  try {
    let schedule: DaySchedule;

    if (dept === "zaoch") {
      // Static semester spreadsheet: cache the raw sheet CSVs for 30 min,
      // then pick the requested date's block.
      const csvs = await cached("tspk:zaoch:csvs", 30 * 60 * 1000, () =>
        fetchZaochSheetCsvs(),
      );
      const parsed = parseZaochSchedule(csvs, date);
      schedule = parsed ?? noLessonsFallback;
    } else {
      const calendar = await cached("tspk:calendar", 5 * 60 * 1000, () =>
        fetchTspkCalendar(),
      );
      // For dept 2 / dpo the TSPK calendar's corpus-2 links are outdated
      // (2022 spreadsheets); everything for a given date lives in the
      // corpus-1 spreadsheet — on different sheets for 2 корпус and ДПО.
      const lookupEntry = findCalendarEntry(calendar, date, 1);
      if (!lookupEntry || !lookupEntry.spreadsheetId) {
        schedule = noLessonsFallback;
      } else if (dept === "dpo") {
        schedule =
          (await cached<DaySchedule | null>(
            `tspk:day:dpo:${date}`,
            5 * 60 * 1000,
            async () => {
              const s = await fetchDpoSchedule(lookupEntry.spreadsheetId!, date);
              return s;
            },
          )) ?? noLessonsFallback;
      } else {
        const entry = {
          date,
          corpus: dept === "2" ? (2 as const) : (1 as const),
          spreadsheetId: lookupEntry.spreadsheetId,
          gid: lookupEntry.gid,
        };
        schedule = await cached<DaySchedule>(
          `tspk:day:${dept}:${date}`,
          5 * 60 * 1000,
          async () => {
            const s = await fetchDaySchedule(entry);
            return (
              s ?? {
                ...noLessonsFallback,
                corpus: dept === "2" ? (2 as const) : (1 as const),
              }
            );
          },
        );
      }
    }

    const group = req.nextUrl.searchParams.get("group");
    if (group) {
      const lessons = schedule.scheduleByGroup[group] ?? [];
      return NextResponse.json({
        ok: true,
        schedule: {
          ...schedule,
          groups: schedule.groups.includes(group) ? [group] : [],
          scheduleByGroup: { [group]: lessons },
        },
      });
    }

    return NextResponse.json({ ok: true, schedule });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: `Failed to fetch day schedule: ${msg}` },
      { status: 502 },
    );
  }
}
