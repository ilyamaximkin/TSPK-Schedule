"use client";

import { useEffect } from "react";
import { Glasses } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useLocalStorage } from "./schedule/use-tspk";

/**
 * Accessibility zoom — "режим для плохо видящих". Scales the WHOLE
 * interface by setting the --ui-zoom CSS variable on <html>: all Tailwind
 * sizes are rem-based, so text, spacing, buttons and cards grow together.
 *
 * The choice persists in localStorage ("tspk:uiZoom"); a pre-paint script
 * in layout.tsx applies it before React hydrates so there is no size
 * flash on load. Modes go from ×1 (обычный) up to ×20 — at that point
 * each word fills the screen, for users who need a loupe-level zoom.
 */

const ZOOM_MODES: { value: number; label: string }[] = [
  { value: 1, label: "Обычный" },
  { value: 1.25, label: "125%" },
  { value: 1.5, label: "150%" },
  { value: 1.75, label: "175%" },
  { value: 2, label: "200%" },
  { value: 3, label: "300%" },
  { value: 5, label: "500%" },
  { value: 10, label: "1000%" },
  { value: 20, label: "2000%" },
];

const isKnownMode = (v: number) => ZOOM_MODES.some((m) => m.value === v);

export function AccessibilityZoom() {
  const [zoom, setZoom] = useLocalStorage<number>("tspk:uiZoom", 1);

  useEffect(() => {
    const v = isKnownMode(zoom) ? zoom : 1;
    document.documentElement.style.setProperty("--ui-zoom", String(v));
    // From ×3 up, also compact the layout: multi-column label grids
    // collapse and rem paddings shrink (globals.css .zoom-xl rules) —
    // otherwise long words overflow their cells and overlap.
    document.documentElement.classList.toggle("zoom-xl", v >= 3);
  }, [zoom]);

  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-1">
          <Glasses className="w-5 h-5 text-primary shrink-0" />
          <h2 className="font-semibold text-sm sm:text-base leading-tight">
            Режим для плохо видящих
          </h2>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Приближение всего интерфейса: текст, кнопки и карточки. Максимум — 20×.
        </p>
        <div className="flex flex-wrap gap-2">
          {ZOOM_MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setZoom(m.value)}
              className={
                "min-h-11 px-3 py-2 rounded-md text-xs font-medium border transition-colors " +
                (zoom === m.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:text-foreground")
              }
              aria-pressed={zoom === m.value}
            >
              {m.label}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
