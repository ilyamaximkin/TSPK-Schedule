"use client";

import { useState } from "react";
import { CalendarDays, CalendarRange, CalendarClock, History, CalendarMinus, GraduationCap, ExternalLink, Info, Building2 } from "lucide-react";
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
  const [corpus, setCorpus] = useLocalStorage<1 | 2>("tspk:corpus", 1);
  const [customDate, setCustomDate] = useState<Date | undefined>(new Date());

  const today = todayIso();
  const yesterday = offsetIso(-1);
  const tomorrow = offsetIso(1);
  // "Назад Неделя" — past 7 days starting 7 days ago (как в ShellShock Live "Назад Коток")
  const backWeekStart = offsetIso(-7);

  const yesterdaySched = useDaySchedule(yesterday, corpus);
  const todaySched = useDaySchedule(today, corpus);
  const tomorrowSched = useDaySchedule(tomorrow, corpus);
  // For the "by date" tab we use the selected Date object → ISO.
  const customIso = customDate ? isoFromJsDate(customDate) : today;
  const customSched = useDaySchedule(customIso, corpus);

  const weekStart = today;

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50/60 via-background to-background dark:from-sky-950/20 dark:via-background dark:to-background">
      <header className="border-b border-sky-200/60 dark:border-sky-900/40 bg-gradient-to-r from-[#2e8db2] to-[#83bed4] dark:from-[#1d5a78] dark:to-[#2e6080] text-white backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-white/15 ring-1 ring-white/30 flex items-center justify-center shrink-0">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="font-semibold text-base sm:text-lg leading-tight truncate">
                Расписание ТСПК
              </h1>
              <p className="text-xs text-white/80 truncate">
                Бот для колледжа · {formatDateRu(today)}
              </p>
            </div>
          </div>
          <a
            href={TSPK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-white/80 hover:text-white inline-flex items-center gap-1 shrink-0"
          >
            <span className="hidden sm:inline">Источник</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-5 sm:py-8 space-y-5 pb-16">
        {/* Corpus selector */}
        <Card>
          <CardContent className="p-4 sm:p-5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide pl-1 mb-2 block">
              Корпус
            </label>
            <div className="grid grid-cols-2 gap-2">
              <CorpusButton
                active={corpus === 1}
                onClick={() => setCorpus(1)}
                title="1 корпус"
                subtitle="Мурысева, 84"
              />
              <CorpusButton
                active={corpus === 2}
                onClick={() => setCorpus(2)}
                title="2 корпус"
                subtitle="Ленинградская, 28"
              />
            </div>
          </CardContent>
        </Card>

        {/* Group selector */}
        <Card>
          <CardContent className="p-4 sm:p-5">
            <GroupSelector
              schedule={todaySched.data}
              date={today}
              corpus={corpus}
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
          <TabsList className="grid grid-cols-3 sm:grid-cols-6 w-full overflow-x-auto">
            <TabsTrigger value="yesterday" className="flex flex-col sm:flex-row gap-1 items-center text-xs sm:text-sm">
              <History className="w-4 h-4" />
              <span>Вчера</span>
            </TabsTrigger>
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
            <TabsTrigger value="back-week" className="flex flex-col sm:flex-row gap-1 items-center text-xs sm:text-sm">
              <CalendarMinus className="w-4 h-4" />
              <span className="hidden sm:inline">Назад Неделя</span>
              <span className="sm:hidden">Назад</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="yesterday" className="mt-4 sm:mt-5">
            <ScheduleForGroup
              schedule={yesterdaySched.data}
              loading={yesterdaySched.loading}
              error={yesterdaySched.error}
              group={group}
            />
          </TabsContent>

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
            <WeekView startDate={weekStart} group={group} corpus={corpus} />
          </TabsContent>

          <TabsContent value="back-week" className="mt-4 sm:mt-5">
            <p className="text-sm text-muted-foreground mb-3 flex items-center gap-1.5">
              <CalendarMinus className="w-3.5 h-3.5" />
              Назад Неделя — расписание за прошлые 7 дней (как «Назад Коток» в ShellShock Live).
            </p>
            <WeekView startDate={backWeekStart} group={group} corpus={corpus} />
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

/** Corpus toggle button — used to switch between corpus 1 (Мурысева 84)
 * and corpus 2 (Ленинградская 28). */
function CorpusButton({
  active,
  onClick,
  title,
  subtitle,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex items-center gap-3 px-4 py-3 rounded-lg border-2 transition-all text-left " +
        (active
          ? "border-primary bg-primary/5"
          : "border-border hover:border-muted-foreground/40 bg-background")
      }
      aria-pressed={active}
    >
      <Building2 className={"w-5 h-5 shrink-0 " + (active ? "text-primary" : "text-muted-foreground")} />
      <div className="min-w-0">
        <div className={"font-semibold text-sm " + (active ? "text-primary" : "")}>{title}</div>
        <div className="text-xs text-muted-foreground truncate">{subtitle}</div>
      </div>
    </button>
  );
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
