/* Quick sanity check for the TSPK parser. Run with: bun run scripts/test-parser.ts */
import {
  fetchTspkCalendar,
  fetchDaySchedule,
  findCalendarEntry,
} from "../src/lib/schedule/tspk-parser";

async function main() {
  console.log("Fetching TSPK calendar...");
  const cal = await fetchTspkCalendar();
  console.log(`  -> ${cal.length} calendar entries`);
  console.log(
    `  -> first 5:`,
    cal.slice(0, 5).map((e) => e.date),
  );
  console.log(
    `  -> days with lessons:`,
    cal.filter((e) => e.spreadsheetId).length,
  );

  // Find a known working date from the snapshot — 2026-10-01 had spreadsheetId 1LFAta0j...
  const target = "2026-10-01";
  const entry = findCalendarEntry(cal, target);
  console.log(`\nLooking up ${target}:`, entry);

  if (entry?.spreadsheetId) {
    console.log(`Fetching day schedule...`);
    const sched = await fetchDaySchedule(entry);
    if (!sched) {
      console.log("No schedule returned.");
      return;
    }
    console.log(`  -> header: ${sched.header}`);
    console.log(`  -> dayOfWeek: ${sched.dayOfWeek}`);
    console.log(`  -> groups (${sched.groups.length}):`, sched.groups.slice(0, 15).join(", "));
    const sampleGroup = sched.groups[0];
    if (sampleGroup) {
      console.log(`\nSchedule for group ${sampleGroup}:`);
      for (const l of sched.scheduleByGroup[sampleGroup] || []) {
        console.log(
          `  #${l.number} | ${l.time} | ${l.subject} | ${l.teacher} | ${l.room}`,
        );
      }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
