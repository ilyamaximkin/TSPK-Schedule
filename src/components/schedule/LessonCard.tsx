"use client";

import { Clock, MapPin, User, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Lesson } from "./use-tspk";

/**
 * LessonCard — accepts ALL sub-lessons for a single pair (most pairs have
 * exactly one; pairs with a "Классный час" prepended have two).
 *
 * When `showGroup` is true (filtering by teacher/room), each sub-lesson
 * shows its group as a small badge next to the title — otherwise the user
 * has no idea which group each pair is for.
 */
export function LessonCard({ lessons, showGroup = false }: { lessons: Lesson[]; showGroup?: boolean }) {
  if (lessons.length === 0) return null;
  const num = lessons[0].number;
  const overallTime = lessons.length > 1 ? combineTimes(lessons) : lessons[0].time;
  const multiple = lessons.length > 1;

  return (
    <Card className="overflow-hidden border-l-4 border-l-primary/80 hover:shadow-md transition-shadow">
      <CardContent className="p-4 sm:p-5 flex gap-2.5 sm:gap-4 items-start">
        <div className="flex flex-col items-center justify-center shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-primary/10 text-primary">
          <span className="hidden sm:inline text-xs font-medium uppercase tracking-wide opacity-70">Пара</span>
          <span className="text-2xl sm:text-2xl font-bold leading-none">{num}</span>
        </div>
        <div className="flex-1 min-w-0 space-y-2 sm:space-y-3">
          {lessons.map((lesson, i) => {
            const group = (lesson as Lesson & { group?: string }).group;
            return (
              <SubLesson
                key={i}
                lesson={lesson}
                multiple={multiple}
                overallTimeBadge={i === 0 ? overallTime : undefined}
                showGroup={showGroup && !!group}
                group={group}
              />
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function SubLesson({
  lesson,
  multiple,
  overallTimeBadge,
  showGroup,
  group,
}: {
  lesson: Lesson;
  multiple: boolean;
  overallTimeBadge?: string;
  showGroup: boolean;
  group?: string;
}) {
  return (
    <div className={cn("min-w-0", multiple && "border-b border-border/60 last:border-b-0 pb-2 sm:pb-3 last:pb-0")}>
      {showGroup && group && (
        <div className="mb-1">
          <Badge variant="secondary" className="font-mono text-sm sm:text-xs">
            <Users className="w-3.5 h-3.5 mr-1" />
            {group}
          </Badge>
        </div>
      )}
      <h3 className="font-semibold text-xl sm:text-lg leading-tight break-words">
        {lesson.subject}
      </h3>
      <div className="mt-1 sm:mt-1.5 flex flex-wrap items-center gap-x-3 sm:gap-x-4 gap-y-1 text-lg sm:text-sm text-muted-foreground">
        {multiple && lesson.time ? (
          <span className="inline-flex items-center gap-1 sm:gap-1.5">
            <Clock className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
            <span className="font-mono">{lesson.time}</span>
          </span>
        ) : overallTimeBadge ? (
          <span className="inline-flex items-center gap-1 sm:gap-1.5">
            <Clock className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
            <span className="font-mono">{overallTimeBadge}</span>
          </span>
        ) : null}
        {lesson.teacher && (
          <span className="inline-flex items-center gap-1 sm:gap-1.5">
            <User className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
            {lesson.teacher}
          </span>
        )}
        {lesson.room && (
          <span className="inline-flex items-center gap-1 sm:gap-1.5">
            <MapPin className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
            {lesson.room}
          </span>
        )}
      </div>
    </div>
  );
}

/** Combine the start of the first lesson with the end of the last one. */
function combineTimes(lessons: Lesson[]): string {
  const first = lessons[0].time.match(/^(\d{1,2}\.\d{2})/)?.[1] ?? "";
  const last = lessons[lessons.length - 1].time.match(/(\d{1,2}\.\d{2})$/)?.[1] ?? "";
  if (first && last) return `${first}-${last}`;
  return lessons[0].time;
}

export function LessonCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 sm:p-5 flex gap-4 items-start animate-pulse">
        <div className="shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-5 bg-muted rounded w-3/4" />
          <div className="h-3 bg-muted rounded w-1/2" />
        </div>
      </CardContent>
    </Card>
  );
}

export function EmptyState({
  title,
  description,
  tone = "muted",
}: {
  title: string;
  description?: string;
  tone?: "muted" | "positive" | "warning";
}) {
  const toneClass =
    tone === "positive"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200"
        : "border-muted bg-muted/30 text-muted-foreground";
  return (
    <Card className={toneClass}>
      <CardContent className="p-6 text-center">
        <p className="font-medium text-lg sm:text-base">{title}</p>
        {description && <p className="text-base sm:text-sm mt-1 opacity-80">{description}</p>}
      </CardContent>
    </Card>
  );
}

export { Badge };
