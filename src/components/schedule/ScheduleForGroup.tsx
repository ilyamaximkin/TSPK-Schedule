"use client";

import { useMemo } from "react";
import { CalendarClock, GraduationCap, Library, PartyPopper } from "lucide-react";
import {
  formatDateRu,
  dayOfWeekRu,
  noLessonsIsFinal,
  filterLessons,
  type DaySchedule,
  type ViewMode,
  type LessonWithGroup,
} from "./use-tspk";
import { EmptyState, LessonCard, LessonCardSkeleton } from "./LessonCard";

interface Props {
  schedule: DaySchedule | null;
  loading: boolean;
  error: string | null;
  /** Active view mode — group / teacher / room. */
  mode: ViewMode;
  /** Currently selected group/teacher/room (depending on mode). */
  value: string;
  /** When true, render a compact header (used inside the week view). */
  compact?: boolean;
}

/**
 * Renders lessons for the given schedule, filtered by the active mode +
 * value (group / teacher / room). Handles all edge cases.
 */
export function ScheduleForGroup({ schedule, loading, error, mode, value, compact = false }: Props) {
  const lessons = useMemo<LessonWithGroup[]>(() => {
    if (!schedule || !value) return [];
    return filterLessons(schedule, mode, value);
  }, [schedule, mode, value]);

  // Group lessons by pair number — a single pair may contain multiple
  // sub-lessons (e.g. "Классный час" + "МДК 09.01") sharing one pair number.
  const grouped = useMemo(() => {
    const map = new Map<number, LessonWithGroup[]>();
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

  // ----- value not chosen -----
  if (!value) {
    const label =
      mode === "group" ? "группу"
      : mode === "teacher" ? "преподавателя"
      : "кабинет";
    return (
      <EmptyState
        title={`Выберите ${label}`}
        description={`Выбор сохранится в этом браузере — повторно выбирать не нужно.`}
      />
    );
  }

  // ----- explicit "no lessons" day (weekend / holiday / not-yet-uploaded) -----
  if (schedule.noLessons || (schedule.groups.length === 0 && !schedule.header)) {
    const isFinal = noLessonsIsFinal(schedule.date);
    return (
      <div className="space-y-3">
        {!compact && header && (
          <ScheduleHeader date={header.date} dow={header.dow} />
        )}
        {isFinal ? (
          <EmptyState
            tone="positive"
            title="Занятий нет"
            description="Выходной или праздничный день. Можно отдохнуть."
          />
        ) : (
          <EmptyState
            tone="warning"
            title="Расписания пока нет"
            description="ТСПК обычно выкладывает расписание к 22:00 предыдущего дня. Загляните позже — или попробуйте вкладку «Назад Неделя», там уже есть."
          />
        )}
      </div>
    );
  }

  // ----- value exists in schedule but has no lessons -----
  if (lessons.length === 0) {
    const inList =
      mode === "group"
        ? schedule.groups.includes(value)
        : mode === "teacher"
          ? Object.values(schedule.scheduleByGroup).flat().some(l => l.teacher === value)
          : Object.values(schedule.scheduleByGroup).flat().some(l => l.room === value);
    const what =
      mode === "group" ? `Группа «${value}»`
      : mode === "teacher" ? `Преподаватель «${value}»`
      : `Кабинет «${value}»`;
    return (
      <div className="space-y-3">
        {!compact && header && (
          <ScheduleHeader date={header.date} dow={header.dow} />
        )}
        <EmptyState
          tone={inList ? "positive" : "warning"}
          title={inList
            ? mode === "group"
              ? "Пар для вашей группы сегодня нет"
              : "Пар для вашего выбора сегодня нет"
            : `${what} не найден в расписании`}
          description={
            inList
              ? "Скорее всего, выходной или практика вне колледжа."
              : "Проверьте название или выберите другой из списка."
          }
        />
      </div>
    );
  }

  // ----- normal render -----
  // Pass mode to LessonCard so it knows to show the group badge when filtering
  // by teacher/room (otherwise the user has no idea which group each pair is for).
  return (
    <div className="space-y-3">
      {!compact && header && (
        <ScheduleHeader date={header.date} dow={header.dow} count={grouped.length} />
      )}
      {grouped.map(([num, subLessons]) => (
        <LessonCard key={num} lessons={subLessons} showGroup={mode !== "group"} />
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
