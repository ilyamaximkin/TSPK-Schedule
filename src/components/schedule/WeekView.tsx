"use client";

import { useMemo } from "react";
import { CalendarX2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateRu, dayOfWeekRu, useWeekSchedule, noLessonsIsFinal, filterLessons, type DaySchedule, type ViewMode, type LessonWithGroup } from "./use-tspk";
import { EmptyState } from "./LessonCard";

interface Props {
  /** ISO date — typically today's date. */
  startDate: string | null;
  /** Active view mode + selected value (group/teacher/room). */
  mode: ViewMode;
  value: string;
  /** Corpus: 1 or 2 — passed through to /api/schedule/day. */
  corpus?: 1 | 2;
}

/**
 * Compact 7-day week view. Each day is a card; inside each card we list the
 * lessons for the chosen group/teacher/room (or show a "no lessons" hint).
 */
export function WeekView({ startDate, mode, value, corpus = 1 }: Props) {
  const { items, loading } = useWeekSchedule(startDate, 7, corpus);

  if (!startDate) return null;

  if (loading && items.every((i) => i.loading)) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-4 bg-muted rounded w-1/3" />
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="h-3 bg-muted rounded w-2/3" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {items.map((it) => (
        <DayCard key={it.date} date={it.date} schedule={it.schedule} loading={it.loading} error={it.error} mode={mode} value={value} />
      ))}
    </div>
  );
}

function DayCard({
  date,
  schedule,
  loading,
  error,
  mode,
  value,
}: {
  date: string;
  schedule: DaySchedule | null;
  loading: boolean;
  error: string | null;
  mode: ViewMode;
  value: string;
}) {
  const dow = dayOfWeekRu(date);
  const isWeekend = ["Суббота", "Воскресенье"].includes(dow);

  const lessons = useMemo<LessonWithGroup[]>(() => {
    if (!schedule || !value) return [];
    return filterLessons(schedule, mode, value);
  }, [schedule, mode, value]);

  return (
    <Card className={isWeekend ? "opacity-70" : ""}>
      <CardHeader className="pb-2 pt-3 px-4 sm:px-5">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-semibold text-sm">{dow}</h3>
          <span className="text-xs text-muted-foreground">{formatDateRu(date)}</span>
        </div>
      </CardHeader>
      <CardContent className="px-4 sm:px-5 pb-4 pt-0 space-y-1.5">
        {loading ? (
          <div className="space-y-1.5 animate-pulse">
            <div className="h-3 bg-muted rounded w-2/3" />
            <div className="h-3 bg-muted rounded w-1/2" />
          </div>
        ) : error ? (
          <p className="text-xs text-destructive">{error}</p>
        ) : !value ? (
          <p className="text-xs text-muted-foreground">Выберите {mode === "group" ? "группу" : mode === "teacher" ? "преподавателя" : "кабинет"} выше.</p>
        ) : !schedule || schedule.noLessons || (schedule.groups.length === 0 && !schedule.header) ? (
          (() => {
            const isFinal = schedule ? noLessonsIsFinal(schedule.date) : noLessonsIsFinal(date);
            return isFinal ? (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <CalendarX2 className="h-3.5 w-3.5" />
                Занятий нет
              </p>
            ) : (
              <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <CalendarX2 className="h-3.5 w-3.5" />
                Расписания пока нет
              </p>
            );
          })()
        ) : lessons.length === 0 ? (
          (() => {
            const inList =
              mode === "group"
                ? schedule.groups.includes(value)
                : mode === "teacher"
                  ? Object.values(schedule.scheduleByGroup).flat().some(l => l.teacher === value)
                  : Object.values(schedule.scheduleByGroup).flat().some(l => l.room === value);
            return inList
              ? <p className="text-xs text-muted-foreground">Пар для вашего выбора нет.</p>
              : <p className="text-xs text-muted-foreground">«{value}» не найден в этот день.</p>;
          })()
        ) : (
          <ul className="space-y-1.5">
            {lessons.map((l, i) => {
              const lg = l as LessonWithGroup;
              return (
                <li key={i} className="text-sm flex gap-2 items-start">
                  <Badge variant="secondary" className="font-mono text-xs shrink-0 mt-0.5">
                    #{l.number}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    {mode !== "group" && lg.group && (
                      <div className="text-xs text-muted-foreground/80 font-mono mb-0.5">
                        {lg.group}
                      </div>
                    )}
                    <div className="flex items-baseline gap-2 flex-wrap">
                      {l.time && (
                        <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                          {l.time}
                        </span>
                      )}
                      <span className="font-medium break-words leading-snug">{l.subject}</span>
                    </div>
                    {(l.teacher || l.room) && (
                      <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-2">
                        {l.teacher && <span>{l.teacher}</span>}
                        {l.room && <span>{l.room}</span>}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export { EmptyState };
