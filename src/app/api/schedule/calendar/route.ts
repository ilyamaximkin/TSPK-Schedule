import { NextResponse } from "next/server";
import { fetchTspkCalendar } from "@/lib/schedule/tspk-parser";
import { cached } from "@/lib/schedule/cache";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/schedule/calendar
 * Returns all known calendar entries from tspk.org:
 *   [{ date: "2026-10-01", spreadsheetId: "1LFAta0j..." | null }, ...]
 *
 * Cached for 5 minutes in-process.
 */
export async function GET() {
  try {
    const entries = await cached("tspk:calendar", 5 * 60 * 1000, () =>
      fetchTspkCalendar(),
    );
    return NextResponse.json({ ok: true, entries });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: `Failed to fetch calendar: ${msg}` },
      { status: 502 },
    );
  }
}
