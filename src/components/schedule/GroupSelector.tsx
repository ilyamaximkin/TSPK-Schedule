"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useDaySchedule, type DaySchedule } from "./use-tspk";

interface Props {
  /** If set, we use this schedule's groups as the suggestion list. */
  schedule?: DaySchedule | null;
  /** Otherwise fetch by date. */
  date?: string | null;
  value: string;
  onChange: (v: string) => void;
}

/**
 * Group selector with autocomplete. Uses today's group list (or a provided
 * schedule's group list) to populate suggestions. Falls back to a free-text
 * input if the user's group isn't in today's list.
 */
export function GroupSelector({ schedule, date, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const daySchedule = useDaySchedule(schedule ? null : (date ?? null));

  const groups = useMemo(() => {
    if (schedule) return schedule.groups;
    return daySchedule.data?.groups ?? [];
  }, [schedule, daySchedule.data]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => g.toLowerCase().includes(q));
  }, [groups, query]);

  const showFreeText = query.trim().length > 0 && !groups.some((g) => g.toLowerCase() === query.trim().toLowerCase());

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide pl-1">Моя группа</label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-medium"
          >
            <span className={cn("truncate", !value && "text-muted-foreground")}>
              {value || "Выберите группу..."}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Например: ИСиП-21"
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              <CommandEmpty>Группа не найдена</CommandEmpty>
              {showFreeText && (
                <CommandGroup heading="Добавить свою">
                  <CommandItem
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
              <CommandGroup heading={schedule ? "Группы на этот день" : "Группы сегодня"}>
                {filtered.slice(0, 200).map((g) => (
                  <CommandItem
                    key={g}
                    value={g}
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
