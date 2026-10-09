"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  useDaySchedule,
  extractTeachers,
  extractRooms,
  fallbackGroups,
  type DaySchedule,
  type ViewMode,
} from "./use-tspk";

interface Props {
  mode: ViewMode;
  /** Schedule for the current day — used to populate the suggestions. */
  schedule?: DaySchedule | null;
  /** If no schedule, fetch by date. */
  date?: string | null;
  /** Corpus for fallback groups list. */
  corpus?: 1 | 2;
  value: string;
  onChange: (v: string) => void;
}

const PLACEHOLDER: Record<ViewMode, string> = {
  group: "Выберите группу...",
  teacher: "Выберите преподавателя...",
  room: "Выберите кабинет...",
};

const LABEL: Record<ViewMode, string> = {
  group: "Моя группа",
  teacher: "Преподаватель",
  room: "Кабинет",
};

const EMPTY_HINT: Record<ViewMode, string> = {
  group: "Введите название группы вручную",
  teacher: "Введите Фамилию И.О. вручную",
  room: "Введите номер кабинета вручную",
};

/**
 * Universal entry selector — same UX as GroupSelector but works for any of
 * the three modes (group / teacher / room). The suggestion list comes from
 * the day's schedule (or fallback for groups only).
 */
export function EntrySelector({ mode, schedule, date, corpus = 1, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const daySchedule = useDaySchedule(schedule ? null : (date ?? null), corpus);

  const items = useMemo(() => {
    const fromSchedule = schedule ?? daySchedule.data;
    if (!fromSchedule) {
      // Only groups have a static fallback; teachers and rooms always come
      // from the live schedule.
      return mode === "group" ? fallbackGroups(corpus) : [];
    }
    if (mode === "group") {
      const api = fromSchedule.groups ?? [];
      const merged = Array.from(new Set([...fallbackGroups(corpus), ...api]));
      merged.sort();
      return merged;
    }
    if (mode === "teacher") return extractTeachers(fromSchedule);
    if (mode === "room") return extractRooms(fromSchedule);
    return [];
  }, [schedule, daySchedule.data, mode, corpus]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((g) => g.toLowerCase().includes(q));
  }, [items, query]);

  const showFreeText =
    query.trim().length > 0 &&
    !items.some((g) => g.toLowerCase() === query.trim().toLowerCase());

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm sm:text-xs font-medium text-muted-foreground uppercase tracking-wide pl-1">
        {LABEL[mode]} {mode === "group" && corpus === 2 ? "(2 корпус)" : mode === "group" ? "(1 корпус)" : ""}
      </label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-medium h-11 text-base"
          >
            <span className={cn("truncate", !value && "text-muted-foreground")}>
              {value || PLACEHOLDER[mode]}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={EMPTY_HINT[mode]}
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              <CommandEmpty>{EMPTY_HINT[mode]}</CommandEmpty>
              {showFreeText && (
                <CommandGroup heading="Добавить свой">
                  <CommandItem
                    className="min-h-[44px] text-base"
                    onSelect={() => {
                      onChange(query.trim());
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <Search className="mr-2 h-4 w-4 opacity-60" />
                    Использовать «<span className="font-medium">{query.trim()}</span>»
                  </CommandItem>
                </CommandGroup>
              )}
              <CommandGroup heading={mode === "group" ? "Все группы корпуса " + corpus : mode === "teacher" ? "Преподаватели" : "Кабинеты"}>
                {filtered.slice(0, 200).map((g) => (
                  <CommandItem
                    key={g}
                    value={g}
                    className="min-h-[44px] text-base"
                    onSelect={() => {
                      onChange(g);
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === g ? "opacity-100" : "opacity-0")} />
                    {g}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
