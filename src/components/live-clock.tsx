"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { TSPK_TZ } from "./schedule/use-tspk";

/**
 * Live clock for the bot header — updates every second in the bot's
 * timezone (Europe/Samara = GMT+4, no DST). Used to tell the user when
 * the "Расписания пока нет" placeholder flips to "Выходной" (after 22:00).
 */
export function LiveClock({ className }: { className?: string }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // On server / first render — show nothing to avoid hydration mismatch.
  if (!now) return null;

  const timeStr = now.toLocaleTimeString("ru-RU", {
    timeZone: TSPK_TZ,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div className={`inline-flex items-center gap-1.5 font-mono text-xs ${className ?? ""}`}>
      <Clock className="w-3.5 h-3.5" />
      <span>{timeStr}</span>
      <span className="text-white/60 ml-1 hidden sm:inline">GMT+4</span>
    </div>
  );
}
