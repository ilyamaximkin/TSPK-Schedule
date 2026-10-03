"use client";

import { useState } from "react";
import { CalendarDays, CalendarRange, CalendarClock, GraduationCap, ExternalLink, Info } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { GroupSelector } from "@/components/schedule/GroupSelector";
import { ScheduleForGroup } from "@/components/schedule/ScheduleForGroup";
import { WeekView } from "@/components/schedule/WeekView";
import {
  useDaySchedule,
  useLocalStorage,
  todayIso,
  offsetIso,
  formatDateRu,
} from "@/components/schedule/use-tspk";

const TSPK_URL = "https://tspk.org/studentam/novoe-raspisanie-demo.html";

export default function Home() {
  const [group, setGroup] = useLocalStorage<string>("tspk:group", "");
  const [tab, setTab] = useLocalStorage<string>("tspk:tab", "today");
  const [customDate, setCustomDate] = useState<Date | undefined>(new Date());

  const today = todayIso();
  const tomorrow = offsetIso(1);

  const todaySched = useDaySchedule(today);
  const tomorrowSched = useDaySchedule(tomorrow);
  // For the "by date" tab we use the selected Date object → ISO.
  const customIso = customDate ? isoFromJsDate(customDate) : today;
  const customSched = useDaySchedule(customIso);

  const weekStart = today;

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50/40 via-background to-background dark:from-sky-950/10">
      <header className="border-b bg-background/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shrink-0">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="font-semibold text-base sm:text-lg leading-tight truncate">
                Расписание ТСПК
              </h1>
              <p className="text-xs text-muted-foreground truncate">
                Бот для колледжа · {formatDateRu(today)}
              </p>
            </div>
          </div>
          <a
            href={TSPK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 shrink-0"
          >
            <span className="hidden sm:inline">Источник</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-5 sm:py-8 space-y-5 pb-16">
        {/* Group selector */}
        <Card>
          <CardContent className="p-4 sm:p-5">
            <GroupSelector
              schedule={todaySched.data}
              value={group}
              onChange={setGroup}
            />
            {group && (
              <p className="text-xs text-muted-foreground mt-2 pl-1">
                Группа «<span className="font-medium text-foreground">{group}</span>» сохранена в этом браузере.
                {" "}
                <button
                  onClick={() => setGroup("")}
                  className="underline hover:text-foreground"
                >
                  Сменить
                </button>
              </p>
            )}
          </CardContent>
        </Card>

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="today" className="flex flex-col sm:flex-row gap-1 items-center text-xs sm:text-sm">
              <CalendarClock className="w-4 h-4" />
              <span>Сегодня</span>
            </TabsTrigger>
            <TabsTrigger value="tomorrow" className="flex flex-col sm:flex-row gap-1 items-center text-xs sm:text-sm">
              <CalendarDays className="w-4 h-4" />
              <span>Завтра</span>
            </TabsTrigger>
            <TabsTrigger value="date" className="flex flex-col sm:flex-row gap-1 items-center text-xs sm:text-sm">
              <CalendarRange className="w-4 h-4" />
              <span className="hidden sm:inline">По дате</span>
              <span className="sm:hidden">Дата</span>
            </TabsTrigger>
            <TabsTrigger value="week" className="flex flex-col sm:flex-row gap-1 items-center text-xs sm:text-sm">
              <CalendarRange className="w-4 h-4" />
              <span>Неделя</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="today" className="mt-4 sm:mt-5">
            <ScheduleForGroup
              schedule={todaySched.data}
              loading={todaySched.loading}
              error={todaySched.error}
              group={group}
            />
          </TabsContent>

          <TabsContent value="tomorrow" className="mt-4 sm:mt-5">
            <ScheduleForGroup
              schedule={tomorrowSched.data}
              loading={tomorrowSched.loading}
              error={tomorrowSched.error}
              group={group}
            />
          </TabsContent>

          <TabsContent value="date" className="mt-4 sm:mt-5 space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start">
              <div className="rounded-lg border bg-card p-2">
                <Calendar
                  mode="single"
                  selected={customDate}
                  onSelect={(d) => setCustomDate(d)}
                  locale={ruLocale()}
                  className="scale-100"
                />
              </div>
              <div className="flex-1 min-w-0">
                {customDate && (
                  <div className="mb-3 flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="font-mono">
                      {isoFromJsDate(customDate)}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {formatDateRu(isoFromJsDate(customDate))}
                    </span>
                  </div>
                )}
                <ScheduleForGroup
                  schedule={customSched.data}
                  loading={customSched.loading}
                  error={customSched.error}
                  group={group}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="week" className="mt-4 sm:mt-5">
            <p className="text-sm text-muted-foreground mb-3 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" />
              Расписание на 7 дней, начиная с сегодняшнего.
            </p>
            <WeekView startDate={weekStart} group={group} />
          </TabsContent>
        </Tabs>
      </main>

      <footer className="mt-auto border-t bg-background/60">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 text-center text-xs text-muted-foreground">
          Данные берутся с{" "}
          <a
            href={TSPK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            tspk.org
          </a>{" "}
          и Google Sheets. Кэшируются на 5 минут.
        </div>
      </footer>
    </div>
  );
}

/** Convert JS Date → YYYY-MM-DD (local time, no TZ shift). */
function isoFromJsDate(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

/**
 * Build a minimal Russian locale for react-day-picker (avoids bundling the
 * full date-fns locale pack). We only need month and weekday names.
 */
function ruLocale() {
  const months = [
    "Январь",
    "Февраль",
    "Март",
    "Апрель",
    "Май",
    "Июнь",
    "Июль",
    "Август",
    "Сентябрь",
    "Октябрь",
    "Ноябрь",
    "Декабрь",
  ];
  return {
    localize: {
      month: (n: number) => months[n] ?? "",
      day: (n: number) =>
        ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"][n] ?? "",
      ordinal: (n: number) => `${n}`,
    },
    formatLong: {
      date: () => "dd.MM.yyyy",
    },
    options: {
      weekStartsOn: 1 as const,
    },
  };
}
