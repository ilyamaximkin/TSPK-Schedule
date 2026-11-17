"use client";

import { useEffect } from "react";
import { Palette } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useLocalStorage } from "./schedule/use-tspk";

/**
 * Design theme picker — sits at the bottom of the page (like in many
 * apps). Each theme is a data-theme attribute on <html> that recolors the
 * accent family, the header gradient and the page background tint
 * (globals.css); it stacks with the light/dark toggle. Persisted in
 * localStorage ("tspk:theme"); the pre-paint script in layout.tsx applies
 * it before React hydrates so there is no color flash on load.
 */

const THEMES: { id: string; label: string; dot: string }[] = [
  { id: "classic", label: "Классика", dot: "#2e8db2" },
  { id: "ocean", label: "Океан", dot: "#0e7490" },
  { id: "mint", label: "Мята", dot: "#059669" },
  { id: "sunset", label: "Закат", dot: "#ea580c" },
  { id: "rose", label: "Роза", dot: "#e11d48" },
  { id: "lavender", label: "Лаванда", dot: "#7c3aed" },
  { id: "graphite", label: "Графит", dot: "#475569" },
  { id: "anime", label: "Аниме", dot: "#ec4899" },
  { id: "mlp", label: "MLP", dot: "#a855f7" },
];

const KNOWN = new Set(THEMES.map((t) => t.id));

function applyTheme(id: string) {
  if (!id || !KNOWN.has(id) || id === "classic") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", id);
  }
}

export function ThemePicker() {
  const [theme, setTheme] = useLocalStorage<string>("tspk:theme", "classic");

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-1">
          <Palette className="w-5 h-5 text-primary shrink-0" />
          <h2 className="font-semibold text-sm sm:text-base leading-tight">Дизайн</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Тема оформления: цвета кнопок, акцентов и шапки. Работает вместе с тёмной темой.
        </p>
        <div className="flex flex-wrap gap-2">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTheme(t.id)}
              className={
                "min-h-11 px-3 py-2 rounded-md text-xs font-medium border transition-colors inline-flex items-center gap-2 " +
                (theme === t.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:text-foreground")
              }
              aria-pressed={theme === t.id}
            >
              <span
                className="w-4 h-4 rounded-full border border-black/10 shrink-0"
                style={{ backgroundColor: t.dot }}
              />
              {t.label}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
