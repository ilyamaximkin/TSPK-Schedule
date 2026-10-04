"use client";

import { useMemo } from "react";
import { CalendarClock, GraduationCap, Library, PartyPopper } from "lucide-react";
import {
  formatDateRu,
  dayOfWeekRu,
  type DaySchedule,
} from "./use-tspk";
import { EmptyState, LessonCard, LessonCardSkeleton } from "./LessonCard";

interface Props {
  schedule: DaySchedule | null;
  loading: boolean;
  error: string | null;
  group: string;
  /** When true, render a compact header (used inside the week view). */
  compact?: boolean;
}

/**
 * Renders the lessons for the given group on the given day's schedule.
 * Handles all edge cases: no group selected, no lessons, group not found, etc.
 */
export function ScheduleForGroup({ schedule, loading, error, group, compact = false }: Props) {
  const lessons = useMemo(() => {
    if (!schedule || !group) return [];
    return schedule.scheduleByGroup[group] ?? [];
  }, [schedule, group]);

  // Group lessons by pair number — a single pair may contain multiple
  // sub-lessons (e.g. "Классный час" + "МДК 09.01") sharing one pair number.
  const grouped = useMemo(() => {
    const map = new Map<number, typeof lessons>();
    for (const l of lessons) {
      const arr = map.get(l.number) ?? [];
      arr.push(l);
      map.set(l.number, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a - b);
  }, [lessons]);

  const header = useMemo(() => {
    if (!schedule) return null;
    return {
      date: formatDateRu(schedule.date),
      dow: schedule.dayOfWeek || dayOfWeekRu(schedule.date),
    };
  }, [schedule]);

  // ----- loading state -----
  if (loading) {
    return (
      <div className="space-y-3">
        {!compact && header && (
          <ScheduleHeader date={header.date} dow={header.dow} />
        )}
        <LessonCardSkeleton />
        <LessonCardSkeleton />
        <LessonCardSkeleton />
      </div>
    );
  }

  // ----- error state -----
  if (error) {
    return (
      <EmptyState
        tone="warning"
        title="Не удалось загрузить расписание"
        description={error}
      />
    );
  }

  // ----- no schedule (e.g., weekend) -----
  if (!schedule) {
    return (
      <EmptyState title="Расписание не найдено" description="Попробуйте другую дату." />
    );
  }

  // ----- group not chosen -----
  if (!group) {
    return (
      <EmptyState
        title="Выберите свою группу"
        description="Группа сохранится в этом браузере — повторно выбирать не нужно."
      />
    );
  }

  // ----- explicit "no lessons" day (weekend / holiday) -----
  if (schedule.noLessons || (schedule.groups.length === 0 && !schedule.header)) {
    return (
      <div className="space-y-3">
        {!compact && header && (
          <ScheduleHeader date={header.date} dow={header.dow} />
        )}
        <EmptyState
          tone="positive"
          title="Занятий нет"
          description="Выходной или праздничный день. Можно отдохнуть."
        />
      </div>
    );
  }

  // ----- group exists in today's list but has no lessons -----
  if (lessons.length === 0) {
    const inList = schedule.groups.includes(group);
    return (
      <div className="space-y-3">
        {!compact && header && (
          <ScheduleHeader date={header.date} dow={header.dow} />
        )}
        <EmptyState
          tone={inList ? "positive" : "warning"}
          title={inList ? "Пар для вашей группы сегодня нет" : `Группа «${group}» не найдена в расписании`}
          description={
            inList
              ? "Скорее всего, у вашей группы выходной или практика вне колледжа."
              : "Проверьте название группы или выберите другую из списка."
          }
        />
      </div>
    );
  }

  // ----- normal render -----
  return (
    <div className="space-y-3">
      {!compact && header && (
        <ScheduleHeader date={header.date} dow={header.dow} count={grouped.length} />
      )}
      {grouped.map(([num, subLessons]) => (
        <LessonCard key={num} lessons={subLessons} />
      ))}
    </div>
  );
}

function ScheduleHeader({
  date,
  dow,
  count,
}: {
  date: string;
  dow: string;
  count?: number;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
      <div className="flex items-baseline gap-2">
        <CalendarClock className="h-5 w-5 text-primary self-center" />
        <h2 className="text-lg sm:text-xl font-semibold">{dow}</h2>
        <span className="text-sm text-muted-foreground">{date}</span>
      </div>
      {typeof count === "number" && (
        <span className="text-xs text-muted-foreground">
          {count} {pluralPairs(count)}
        </span>
      )}
    </div>
  );
}

function pluralPairs(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "пара";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "пары";
  return "пар";
}

export { GraduationCap, Library, PartyPopper };
