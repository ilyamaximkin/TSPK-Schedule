"use client";

import { useEffect, useState } from "react";
import { CalendarDays, CalendarRange, CalendarClock, History, CalendarMinus, GraduationCap, ExternalLink, Info, Building2, Laptop, Award } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { ru } from "react-day-picker/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { ThemePicker } from "@/components/theme-picker";
import { LiveClock } from "@/components/live-clock";
import { AccessibilityZoom } from "@/components/accessibility-zoom";
import { EntrySelector } from "@/components/schedule/EntrySelector";
import { ScheduleForGroup } from "@/components/schedule/ScheduleForGroup";
import { WeekView } from "@/components/schedule/WeekView";
import { MonthView } from "@/components/schedule/MonthView";
import { ScheduleWatcher } from "@/components/schedule/schedule-watcher";
import {
  useDaySchedule,
  useLocalStorage,
  todayIso,
  offsetIso,
  weekStartIso,
  formatDateRu,
  type Dept,
  type ViewMode,
} from "@/components/schedule/use-tspk";

const TSPK_URL = "https://tspk.org/studentam/novoe-raspisanie-demo.html";

export default function Home() {
  const [tab, setTab] = useLocalStorage<string>("tspk:tab", "today");
  // Отделение: очный 1/2 корпус, заочное, ДПО. One-time migration from the
  // legacy "tspk:corpus" (1|2) key for users who picked a corpus before.
  const [dept, setDept] = useLocalStorage<Dept>("tspk:dept", "1");
  useEffect(() => {
    try {
      if (localStorage.getItem("tspk:dept") === null) {
        const legacy = JSON.parse(localStorage.getItem("tspk:corpus") || "1");
        if (legacy === 2) setDept("2");
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // View mode: filter the schedule by group / teacher / room.
  const [mode, setMode] = useLocalStorage<ViewMode>("tspk:mode", "group");
  // Per-dept group: each отделение remembers its own group independently,
  // so switching dept auto-restores the previously chosen group for it.
  const [group1, setGroup1] = useLocalStorage<string>("tspk:group:1", "");
  const [group2, setGroup2] = useLocalStorage<string>("tspk:group:2", "");
  const [groupZaoch, setGroupZaoch] = useLocalStorage<string>("tspk:group:zaoch", "");
  const [groupDpo, setGroupDpo] = useLocalStorage<string>("tspk:group:dpo", "");
  // Per-mode teacher/room selection (shared across departments).
  const [teacher, setTeacher] = useLocalStorage<string>("tspk:teacher", "");
  const [room, setRoom] = useLocalStorage<string>("tspk:room", "");

  // The "value" we filter by depends on the active mode.
  const value =
    mode === "group"
      ? (dept === "1" ? group1 : dept === "2" ? group2 : dept === "zaoch" ? groupZaoch : groupDpo)
      : mode === "teacher"
        ? teacher
        : room;
  const setValue =
    mode === "group"
      ? (dept === "1" ? setGroup1 : dept === "2" ? setGroup2 : dept === "zaoch" ? setGroupZaoch : setGroupDpo)
      : mode === "teacher"
        ? setTeacher
        : setRoom;

  const [customDate, setCustomDate] = useState<Date | undefined>(new Date());

  const today = todayIso();
  const yesterday = offsetIso(-1);
  const tomorrow = offsetIso(1);
  // "Неделя" = current calendar week (Mon-Sun). "Назад Неделя" = previous
  // calendar week (last Mon - last Sun). Both are calculated from the
  // Monday of the relevant week — independent of today's weekday.
  const weekStart = weekStartIso(0);
  const backWeekStart = weekStartIso(-1);
  // "Понедельник" tab — this week's Monday as a single day.
  const monday = weekStart;

  const yesterdaySched = useDaySchedule(yesterday, dept);
  const todaySched = useDaySchedule(today, dept);
  const tomorrowSched = useDaySchedule(tomorrow, dept);
  const mondaySched = useDaySchedule(monday, dept);
  // For the "by date" tab we use the selected Date object → ISO.
  const customIso = customDate ? isoFromJsDate(customDate) : today;
  const customSched = useDaySchedule(customIso, dept);

  return (
    <div className="min-h-screen bg-gradient-to-b from-(--app-bg-from) via-background to-background">
      <header className="border-b border-sky-200/60 dark:border-sky-900/40 bg-gradient-to-r from-(--header-from) to-(--header-to) text-white backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-2.5 flex-1 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-white/15 ring-1 ring-white/30 flex items-center justify-center shrink-0">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="font-semibold text-base sm:text-lg leading-tight truncate">
                Расписание ТСПК
              </h1>
              <p className="text-xs text-white/80 truncate">
                <span className="hidden sm:inline">Бот для колледжа · </span>{formatDateRu(today)}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center">
            <LiveClock className="text-white" />
          </div>
          <a
            href={TSPK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-white/80 hover:text-white hidden sm:inline-flex items-center justify-center gap-1 shrink-0 sm:min-h-11 sm:min-w-11 px-1"
          >
            <span className="hidden sm:inline">Источник</span>
            <ExternalLink className="w-4 h-4" />
          </a>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-5 sm:py-8 space-y-5 pb-16">
        {/* Accessibility zoom ("для плохо видящих") — first so it is always
            reachable, and it scales itself along with everything else. */}
        <AccessibilityZoom />

        {/* Отделение selector */}
        <Card>
          <CardContent className="p-4 sm:p-5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide pl-1 mb-2 block">
              Отделение
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 data-zoom-stack">
              <DeptButton
                active={dept === "1"}
                onClick={() => setDept("1")}
                title="1 корпус"
                subtitle="Мурысева, 84"
                icon={<Building2 className={"w-5 h-5 shrink-0 " + (dept === "1" ? "text-primary" : "text-muted-foreground")} />}
              />
              <DeptButton
                active={dept === "2"}
                onClick={() => setDept("2")}
                title="2 корпус"
                subtitle="Ленинградская, 28"
                icon={<Building2 className={"w-5 h-5 shrink-0 " + (dept === "2" ? "text-primary" : "text-muted-foreground")} />}
              />
              <DeptButton
                active={dept === "zaoch"}
                onClick={() => setDept("zaoch")}
                title="Заочное отделение"
                subtitle="вечерние группы"
                icon={<Laptop className={"w-5 h-5 shrink-0 " + (dept === "zaoch" ? "text-primary" : "text-muted-foreground")} />}
              />
              <DeptButton
                active={dept === "dpo"}
                onClick={() => setDept("dpo")}
                title="ДПО"
                subtitle="доп. образование"
                icon={<Award className={"w-5 h-5 shrink-0 " + (dept === "dpo" ? "text-primary" : "text-muted-foreground")} />}
              />
            </div>
          </CardContent>
        </Card>

        {/* View mode + entry selector */}
        <Card>
          <CardContent className="p-4 sm:p-5">
            {/* Mode toggle */}
            <div className="grid grid-cols-3 gap-1 p-1 bg-muted/40 rounded-lg mb-3 data-zoom-stack">
              <ModeButton
                active={mode === "group"}
                onClick={() => setMode("group")}
                label="Группа"
              />
              <ModeButton
                active={mode === "teacher"}
                onClick={() => setMode("teacher")}
                label="Преподаватель"
              />
              <ModeButton
                active={mode === "room"}
                onClick={() => setMode("room")}
                label="Кабинет"
              />
            </div>
            <EntrySelector
              mode={mode}
              schedule={todaySched.data}
              date={today}
              dept={dept}
              value={value}
              onChange={setValue}
            />
            {value && (
              <p className="text-xs text-muted-foreground mt-2 pl-1">
                {mode === "group" ? "Группа" : mode === "teacher" ? "Преподаватель" : "Кабинет"} «<span className="font-medium text-foreground">{value}</span>» сохранён в этом браузере.
                {" "}
                <button
                  onClick={() => setValue("")}
                  className="underline hover:text-foreground"
                >
                  Сменить
                </button>
              </p>
            )}
          </CardContent>
        </Card>

        {/* Schedule watcher: notifications when the schedule appears/changes */}
        <ScheduleWatcher dept={dept} mode={mode} value={value} />

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="grid grid-cols-3 w-full h-auto data-zoom-stack">
            <TabsTrigger value="monday" className="flex-row gap-1.5 text-xs sm:text-sm px-2 sm:px-3 py-2.5 min-h-11">
              <CalendarClock className="w-4 h-4 shrink-0" />
              <span>Понедельник</span>
            </TabsTrigger>
            <TabsTrigger value="yesterday" className="flex-row gap-1.5 text-xs sm:text-sm px-2 sm:px-3 py-2.5 min-h-11">
              <History className="w-4 h-4 shrink-0" />
              <span>Вчера</span>
            </TabsTrigger>
            <TabsTrigger value="today" className="flex-row gap-1.5 text-xs sm:text-sm px-2 sm:px-3 py-2.5 min-h-11">
              <CalendarClock className="w-4 h-4 shrink-0" />
              <span>Сегодня</span>
            </TabsTrigger>
            <TabsTrigger value="tomorrow" className="flex-row gap-1.5 text-xs sm:text-sm px-2 sm:px-3 py-2.5 min-h-11">
              <CalendarDays className="w-4 h-4 shrink-0" />
              <span>Завтра</span>
            </TabsTrigger>
            <TabsTrigger value="date" className="flex-row gap-1.5 text-xs sm:text-sm px-2 sm:px-3 py-2.5 min-h-11">
              <CalendarRange className="w-4 h-4 shrink-0" />
              <span>Дата</span>
            </TabsTrigger>
            <TabsTrigger value="week" className="flex-row gap-1.5 text-xs sm:text-sm px-2 sm:px-3 py-2.5 min-h-11">
              <CalendarRange className="w-4 h-4 shrink-0" />
              <span>Неделя</span>
            </TabsTrigger>
            <TabsTrigger value="back-week" className="flex-row gap-1.5 text-xs sm:text-sm px-2 sm:px-3 py-2.5 min-h-11">
              <CalendarMinus className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Назад Неделя</span>
              <span className="sm:hidden">Назад</span>
            </TabsTrigger>
            <TabsTrigger value="month" className="flex-row gap-1.5 text-xs sm:text-sm px-2 sm:px-3 py-2.5 min-h-11">
              <CalendarRange className="w-4 h-4 shrink-0" />
              <span>Месяц</span>
            </TabsTrigger>
            <TabsTrigger value="back-month" className="flex-row gap-1.5 text-xs sm:text-sm px-2 sm:px-3 py-2.5 min-h-11">
              <CalendarMinus className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Месяц назад</span>
              <span className="sm:hidden">М-назад</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="monday" className="mt-4 sm:mt-5">
            <ScheduleForGroup
              schedule={mondaySched.data}
              loading={mondaySched.loading}
              error={mondaySched.error}
              mode={mode}
              value={value}
            />
          </TabsContent>

          <TabsContent value="yesterday" className="mt-4 sm:mt-5">
            <ScheduleForGroup
              schedule={yesterdaySched.data}
              loading={yesterdaySched.loading}
              error={yesterdaySched.error}
              mode={mode}
              value={value}
            />
          </TabsContent>

          <TabsContent value="today" className="mt-4 sm:mt-5">
            <ScheduleForGroup
              schedule={todaySched.data}
              loading={todaySched.loading}
              error={todaySched.error}
              mode={mode}
              value={value}
            />
          </TabsContent>

          <TabsContent value="tomorrow" className="mt-4 sm:mt-5">
            <ScheduleForGroup
              schedule={tomorrowSched.data}
              loading={tomorrowSched.loading}
              error={tomorrowSched.error}
              mode={mode}
              value={value}
            />
          </TabsContent>

          <TabsContent value="date" className="mt-4 sm:mt-5 space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start">
              <div className="rounded-lg border bg-card p-2 overflow-x-auto">
                <Calendar
                  mode="single"
                  selected={customDate}
                  onSelect={(d) => setCustomDate(d)}
                  locale={ru}
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
                  mode={mode}
                  value={value}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="week" className="mt-4 sm:mt-5">
            <p className="text-sm text-muted-foreground mb-3 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 shrink-0" />
              Текущая неделя (понедельник — воскресенье).
            </p>
            <WeekView startDate={weekStart} mode={mode} value={value} dept={dept} />
          </TabsContent>

          <TabsContent value="back-week" className="mt-4 sm:mt-5">
            <p className="text-sm text-muted-foreground mb-3 flex items-center gap-1.5">
              <CalendarMinus className="w-3.5 h-3.5 shrink-0" />
              Прошлая неделя (как «Назад Коток» в ShellShock Live — с прошлого понедельника по прошлое воскресенье).
            </p>
            <WeekView startDate={backWeekStart} mode={mode} value={value} dept={dept} />
          </TabsContent>

          <TabsContent value="month" className="mt-4 sm:mt-5">
            <MonthView monthOffset={0} mode={mode} value={value} dept={dept} />
          </TabsContent>

          <TabsContent value="back-month" className="mt-4 sm:mt-5">
            <MonthView monthOffset={-1} mode={mode} value={value} dept={dept} />
          </TabsContent>
        </Tabs>

        {/* Design theme picker — at the bottom, like in many apps */}
        <ThemePicker />
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

/** Mode toggle chip — Группа / Преподаватель / Кабинет. */
function ModeButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex items-center justify-center min-h-11 px-2 rounded-md text-xs sm:text-sm font-medium transition-colors " +
        (active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground")
      }
      aria-pressed={active}
    >
      {label}
    </button>
  );
}

/** Отделение toggle button — 1 корпус (Мурысева 84), 2 корпус
 * (Ленинградская 28), заочное отделение, ДПО. */
function DeptButton({
  active,
  onClick,
  title,
  subtitle,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
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
      {icon}
      <div className="min-w-0">
        <div className={"font-semibold text-sm " + (active ? "text-primary" : "")}>{title}</div>
        <div className="text-xs text-muted-foreground truncate">{subtitle}</div>
      </div>
    </button>
  );
}
