import { NextRequest, NextResponse } from "next/server";
import {
  fetchTspkCalendar,
  findCalendarEntry,
  fetchDaySchedule,
} from "@/lib/schedule/tspk-parser";
import { cached } from "@/lib/schedule/cache";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/schedule/groups?date=YYYY-MM-DD&corpus=1|2
 * Returns just the list of group names that have lessons on the given day.
 */
export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  const corpusRaw = req.nextUrl.searchParams.get("corpus") || "1";
  const corpus: 1 | 2 = corpusRaw === "2" ? 2 : 1;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { ok: false, error: "Query param 'date' must be in YYYY-MM-DD format" },
      { status: 400 },
    );
  }

  try {
    const calendar = await cached("tspk:calendar", 5 * 60 * 1000, () =>
      fetchTspkCalendar(),
    );
    const entry = findCalendarEntry(calendar, date, corpus);
    if (!entry || !entry.spreadsheetId) {
      return NextResponse.json({ ok: true, groups: [] });
    }

    const schedule = await cached(
      `tspk:day:${corpus}:${date}`,
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
