import { NextRequest, NextResponse } from "next/server";
import {
  fetchTspkCalendar,
  findCalendarEntry,
  fetchDaySchedule,
  fetchZaochSheetCsvs,
  parseZaochSchedule,
  fetchDpoSchedule,
  type DaySchedule,
  type Dept,
} from "@/lib/schedule/tspk-parser";
import { cached } from "@/lib/schedule/cache";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/schedule/groups?date=YYYY-MM-DD&dept=1|2|zaoch|dpo
 * (legacy: ?corpus=1|2 is still accepted and maps to dept 1|2)
 *
 * Returns just the list of group names that have lessons on the given day
 * (for ДПО — the list of ДПО programs).
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

  try {
    if (dept === "zaoch") {
      const csvs = await cached("tspk:zaoch:csvs", 30 * 60 * 1000, () =>
        fetchZaochSheetCsvs(),
      );
      const parsed = parseZaochSchedule(csvs, date);
      return NextResponse.json({ ok: true, groups: parsed?.groups ?? [] });
    }

    const calendar = await cached("tspk:calendar", 5 * 60 * 1000, () =>
      fetchTspkCalendar(),
    );
    // For dept 2 / dpo, always use corpus-1's spreadsheetId (the TSPK
    // calendar's corpus-2 entries point to outdated 2022 spreadsheets).
    const lookupEntry = findCalendarEntry(calendar, date, 1);
    if (!lookupEntry || !lookupEntry.spreadsheetId) {
      return NextResponse.json({ ok: true, groups: [] });
    }

    if (dept === "dpo") {
      const schedule = await cached<DaySchedule | null>(
        `tspk:day:dpo:${date}`,
        5 * 60 * 1000,
        async () => {
          const s = await fetchDpoSchedule(lookupEntry.spreadsheetId!, date);
          return s;
        },
      );
      return NextResponse.json({ ok: true, groups: schedule?.groups ?? [] });
    }

    const entry = {
      date,
      corpus: dept === "2" ? (2 as const) : (1 as const),
      spreadsheetId: lookupEntry.spreadsheetId,
      gid: lookupEntry.gid,
    };

    const schedule = await cached<DaySchedule | null>(
      `tspk:day:${dept}:${date}`,
      5 * 60 * 1000,
      async () => {
        const s = await fetchDaySchedule(entry);
        return s ?? null;
      },
    );

    if (!schedule) {
      return NextResponse.json({ ok: true, groups: [] });
    }
    return NextResponse.json({ ok: true, groups: schedule.groups });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: `Failed to fetch groups: ${msg}` },
      { status: 502 },
    );
  }
}
