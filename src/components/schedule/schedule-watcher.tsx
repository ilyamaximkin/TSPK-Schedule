"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, BellOff, RefreshCw, TestTube2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import {
  filterLessons,
  noLessonsIsFinal,
  offsetIso,
  useLocalStorage,
  formatDateRu,
  type DaySchedule,
  type ViewMode,
} from "./use-tspk";

/**
 * Schedule watcher — polls the TSPK schedule for "today" and "tomorrow"
 * every few minutes while any tab of the app is open and notifies the user
 * when the schedule APPEARS (TSPK usually uploads it by ~22:00 the evening
 * before) or CHANGES (replacements). It also dispatches a
 * "tspk:schedule-updated" window event, which makes any open tab re-render
 * the affected day without a manual reload.
 *
 * Notifications use the ServiceWorker when available (so clicking one
 * focuses the tab) and fall back to the plain Notification API.
 */

const WATCH_DATES = [0, 1] as const; // today + tomorrow
const EVENT_NAME = "tspk:schedule-updated";
const DEDUP_MS = 90 * 1000; // multi-tab dedup window
const STATE_KEEP_DAYS = 7;

interface WatchState {
  /** hash of the group's lessons, "" = no lessons known */
  hash: string;
  count: number;
  updatedAt: number;
}

interface WatchStatus {
  lastCheck: number | null;
  message: string;
  tone: "idle" | "ok" | "warn";
}

/** Stable-enough string hash (djb2) for change detection. */
function hashLessons(lessons: unknown): string {
  const s = JSON.stringify(lessons);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Show an OS notification (via SW when possible), deduped across tabs. */
async function showNotification(
  tag: string,
  title: string,
  body: string,
): Promise<boolean> {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") {
    return false;
  }
  // Multi-tab dedup: only one tab shows the notification per DEDUP_MS.
  const dedupKey = `tspk:watch:notified:${tag}`;
  const last = Number(localStorage.getItem(dedupKey) || 0);
  if (Date.now() - last < DEDUP_MS) return false;
  localStorage.setItem(dedupKey, String(Date.now()));

  const options: NotificationOptions & { renotify?: boolean } = {
    body,
    tag: `tspk-watch-${tag}`,
    renotify: true,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    lang: "ru",
  };
  try {
    const reg = await navigator.serviceWorker?.getRegistration?.();
    if (reg) {
      await reg.showNotification(title, options);
      return true;
    }
  } catch {
    /* fall through to plain Notification */
  }
  try {
    const n = new Notification(title, options);
    n.onclick = () => {
      window.focus();
      n.close();
    };
    return true;
  } catch {
    return false;
  }
}

export function ScheduleWatcher({
  corpus,
  mode,
  value,
}: {
  corpus: 1 | 2;
  mode: ViewMode;
  value: string;
}) {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [enabled, setEnabled] = useLocalStorage<boolean>("tspk:watch:enabled", true);
  const [intervalMin, setIntervalMin] = useLocalStorage<number>("tspk:watch:intervalMin", 2);
  const [status, setStatus] = useState<WatchStatus>({ lastCheck: null, message: "", tone: "idle" });
  const [checking, setChecking] = useState(false);
  const checkingRef = useRef(false);
  const lastPollRef = useRef(0);

  useEffect(() => {
    if (typeof Notification !== "undefined") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPermission(Notification.permission);
    }
  }, []);

  // Register the SW (needed for notificationclick → focus tab). Safe to
  // call on every mount; the browser dedups.
  useEffect(() => {
    if (typeof Notification === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* insecure context / file:// — plain Notification fallback still works */
    });
  }, []);

  const what = mode === "group" ? "группой" : mode === "teacher" ? "преподавателем" : "кабинетом";

  const poll = useCallback(
    async (manual = false) => {
      if (checkingRef.current) return;
      if (!value) return;
      checkingRef.current = true;
      setChecking(true);
      lastPollRef.current = Date.now();
      try {
        for (const offset of WATCH_DATES) {
          const date = offsetIso(offset);
          // Past days / Sundays never "appear" — don't watch them.
          if (offset === 0 && noLessonsIsFinal(date)) continue;

          let sched: DaySchedule | null = null;
          try {
            const r = await fetch(
              `/api/schedule/day?date=${encodeURIComponent(date)}&corpus=${corpus}`,
              { signal: AbortSignal.timeout(30_000) },
            );
            const j = await r.json().catch(() => null);
            if (!r.ok || !j?.ok) throw new Error(j?.error || `HTTP ${r.status}`);
            sched = j.schedule as DaySchedule;
          } catch (e) {
            if (manual) {
              setStatus({
                lastCheck: Date.now(),
                message: `Ошибка проверки: ${e instanceof Error ? e.message : "сеть недоступна"}`,
                tone: "warn",
              });
            }
            continue; // never treat a failed fetch as "schedule disappeared"
          }
          if (!sched) continue;

          const lessons = filterLessons(sched, mode, value);
          const hash = lessons.length > 0 ? hashLessons(lessons) : "";
          const count = lessons.length;

          const stateKey = `tspk:watch:state:${corpus}:${mode}:${value}`;
          let state: Record<string, WatchState> = {};
          try {
            state = JSON.parse(localStorage.getItem(stateKey) || "{}") as typeof state;
          } catch {
            state = {};
          }
          const prev = state[date];
          const firstEver = !prev;

          const whatDay = offset === 0 ? "сегодня" : "завтра";
          const dayLabel = `${whatDay} (${formatDateRu(date)})`;

          if (count > 0) {
            if (!firstEver && prev.hash === "") {
              const first = lessons[0];
              const shown = await showNotification(
                `${corpus}:${mode}:${value}:${date}:appeared`,
                "🎓 Расписание появилось",
                `${dayLabel} для ${value}: ${count} пар${first.time ? `, первая в ${first.time.split("-")[0]}` : ""}.`,
              );
              if (shown) {
                setStatus({
                  lastCheck: Date.now(),
                  message: `Расписание на ${dayLabel} появилось!`,
                  tone: "ok",
                });
              }
              window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { date } }));
            } else if (!firstEver && prev.hash !== hash) {
              await showNotification(
                `${corpus}:${mode}:${value}:${date}:changed`,
                "🔁 Расписание изменилось",
                `${dayLabel} для ${value}: теперь ${count} пар. Загляните, что поменялось.`,
              );
              setStatus({
                lastCheck: Date.now(),
                message: `Расписание на ${dayLabel} изменилось — вкладка обновлена.`,
                tone: "ok",
              });
              window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { date } }));
            } else {
              setStatus({
                lastCheck: Date.now(),
                message: `Есть расписание на ${dayLabel}: ${count} пар. Следим за изменениями.`,
                tone: "ok",
              });
            }
          } else if (!firstEver && prev.hash !== "" && !noLessonsIsFinal(date)) {
            // Had lessons, now none — usually a re-upload in progress.
            setStatus({
              lastCheck: Date.now(),
              message: `Пары на ${dayLabel} пропали из расписания — вероятно, его перезалили.`,
              tone: "warn",
            });
            window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { date } }));
          } else {
            setStatus({
              lastCheck: Date.now(),
              message: `Расписания на ${dayLabel} ещё нет. Проверим через ${intervalMin} мин.`,
              tone: "idle",
            });
          }

          // Persist state + prune old days.
          state[date] = { hash, count, updatedAt: Date.now() };
          const cutoff = Date.now() - STATE_KEEP_DAYS * 24 * 60 * 60 * 1000;
          for (const k of Object.keys(state)) {
            if (state[k].updatedAt < cutoff) delete state[k];
          }
          try {
            localStorage.setItem(stateKey, JSON.stringify(state));
          } catch {
            /* quota — ignore */
          }
        }
      } finally {
        checkingRef.current = false;
        setChecking(false);
      }
    },
    [value, corpus, mode, intervalMin],
  );

  // Polling loop — runs while the tab is open (any tab of this app).
  useEffect(() => {
    if (!enabled || !value || permission !== "granted") return;
    // poll() updates status state after an await, not synchronously;
    // the rule can't see that.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    poll();
    const id = setInterval(() => poll(), Math.max(1, intervalMin) * 60 * 1000);
    // Catch up when the user returns to the tab (browsers throttle timers
    // in background tabs, so poll on visibility instead of waiting).
    const onVisible = () => {
      if (!document.hidden && Date.now() - lastPollRef.current > 15 * 1000) poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, value, permission, intervalMin, corpus, mode, poll]);
  const requestPermission = async () => {
    if (typeof Notification === "undefined") {
      toast({ title: "Браузер не поддерживает уведомления" });
      return;
    }
    const p = await Notification.requestPermission();
    setPermission(p);
    if (p === "granted") {
      setEnabled(true);
      toast({ title: "Уведомления включены 🎉", description: "Теперь мы сообщим, когда появится расписание." });
      poll(true);
    } else if (p === "denied") {
      toast({
        title: "Уведомления заблокированы",
        description: "Разрешите их в настройках сайта (иконка замка в адресной строке).",
      });
    }
  };

  const testNotification = async () => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") {
      await requestPermission();
      return;
    }
    const shown = await showNotification(
      `test:${Date.now()}`,
      "✅ Тестовое уведомление",
      `Если вы это видите — уведомления работают. Следим за ${what}: ${value || "—"}.`,
    );
    if (!shown) {
      toast({ title: "Не удалось показать уведомление", description: "Проверьте настройки уведомлений браузера." });
    }
  };

  const lastCheckStr =
    status.lastCheck != null
      ? new Date(status.lastCheck).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
      : null;

  const watching = enabled && permission === "granted" && !!value;

  return (
    <Card>
      <CardContent className="p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {permission === "granted" ? (
              <Bell className={"w-5 h-5 shrink-0 " + (watching ? "text-primary" : "text-muted-foreground")} />
            ) : (
              <BellOff className="w-5 h-5 shrink-0 text-muted-foreground" />
            )}
            <div className="min-w-0">
              <h2 className="font-semibold text-sm sm:text-base leading-tight">Уведомления о расписании</h2>
              <p className="text-xs text-muted-foreground truncate">
                {watching
                  ? `Следим за ${what} «${value}» — сегодня и завтра`
                  : value
                    ? `Готовы следить за ${what} «${value}»`
                    : "Выберите группу, преподавателя или кабинет выше"}
              </p>
            </div>
          </div>
          {permission === "granted" && (
            <div className="flex items-center gap-2 shrink-0">
              <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Следить за расписанием" />
            </div>
          )}
        </div>

        {permission !== "granted" ? (
          <div className="space-y-2">
            {permission === "denied" ? (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                Уведомления заблокированы в браузере. Разрешите их для этого сайта (иконка замка в адресной
                строке → «Уведомления» → «Разрешить») и перезагрузите страницу.
              </p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Бот сам проверит расписание (ТСПК обычно выкладывает его к 22:00 предыдущего дня) и
                  пришлёт уведомление, как только оно появится или изменится. Вкладку держать открытой не
                  нужно — достаточно, чтобы браузер был запущен.
                </p>
                <Button onClick={requestPermission} className="w-full sm:w-auto">
                  <Bell className="w-4 h-4 mr-1.5" />
                  Включить уведомления
                </Button>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Проверять каждые</span>
              {[1, 2, 5, 10].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setIntervalMin(m)}
                  className={
                    "px-2.5 py-1 rounded-md text-xs font-medium border transition-colors " +
                    (intervalMin === m
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:text-foreground")
                  }
                >
                  {m} мин
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-xs">
              {status.tone === "warn" ? (
                <span className="text-amber-600 dark:text-amber-400">{status.message}</span>
              ) : (
                <span className="text-muted-foreground">{status.message || "Готов к работе."}</span>
              )}
              {lastCheckStr && (
                <span className="text-muted-foreground/70 whitespace-nowrap">· проверено в {lastCheckStr}</span>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => poll(true)} disabled={checking}>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Проверить сейчас
              </Button>
              <Button variant="outline" size="sm" onClick={testNotification}>
                <TestTube2 className="w-3.5 h-3.5 mr-1.5" />
                Тест
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
