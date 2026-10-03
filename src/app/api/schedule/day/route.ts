import { NextRequest, NextResponse } from "next/server";
import {
  fetchTspkCalendar,
  findCalendarEntry,
  fetchDaySchedule,
  getDayOfWeekRu,
  type DaySchedule,
} from "@/lib/schedule/tspk-parser";
import { cached } from "@/lib/schedule/cache";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/schedule/day?date=YYYY-MM-DD
 * Returns the full schedule for that day (all groups + all lessons).
 *
 * If ?group=Д-41 is provided, the response still contains the full schedule
 * (the client filters) — but groups[] is reduced to just the requested group
 * for convenience.
 *
 * Cached per-day for 5 minutes.
 */
export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
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
    const entry = findCalendarEntry(calendar, date);
    if (!entry) {
      const fallback: DaySchedule = {
        date,
        header: "",
        dayOfWeek: getDayOfWeekRu(date),
        groups: [],
        scheduleByGroup: {},
        noLessons: true,
      };
      return NextResponse.json({ ok: true, schedule: fallback });
    }

    const schedule = await cached<DaySchedule>(
      `tspk:day:${date}`,
      5 * 60 * 1000,
      async () => {
        const s = await fetchDaySchedule(entry);
        return (
          s ?? {
            date,
            header: "",
            dayOfWeek: getDayOfWeekRu(date),
            groups: [],
            scheduleByGroup: {},
            noLessons: true,
          }
        );
      },
    );

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
