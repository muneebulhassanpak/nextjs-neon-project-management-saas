"use client";

import { format } from "date-fns";
import { CalendarDays } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { addDays } from "@/lib/dates";
import { cn } from "@/lib/utils";

import type { DateRange } from "react-day-picker";

/** YYYY-MM-DD for a date picked in the browser (its local day). */
const day = (date: Date) => format(date, "yyyy-MM-dd");
/** The local midnight of a YYYY-MM-DD day, for the calendar. */
const toDate = (value: string) => new Date(`${value}T00:00:00`);

function presets(today: string) {
  return [
    { label: "Today", from: today, to: today },
    { label: "Yesterday", from: addDays(today, -1), to: addDays(today, -1) },
    { label: "Last 7 days", from: addDays(today, -6), to: today },
    { label: "Last 30 days", from: addDays(today, -29), to: today },
    { label: "This month", from: `${today.slice(0, 8)}01`, to: today },
  ];
}

function rangeLabel(from: string | undefined, to: string | undefined, today: string): string {
  if (!from && !to) return "Any time";
  const preset = presets(today).find((p) => p.from === from && p.to === to);
  if (preset) return preset.label;
  const short = (value: string) =>
    format(toDate(value), value.slice(0, 4) === today.slice(0, 4) ? "MMM d" : "MMM d, yyyy");
  if (from && to) return from === to ? short(from) : `${short(from)} – ${short(to)}`;
  return from ? `Since ${short(from)}` : `Until ${short(to ?? today)}`;
}

/** Picks the days to show: a preset or any range on the calendar. */
export function DateRangeFilter({
  from,
  to,
  onChange,
}: {
  from?: string;
  to?: string;
  onChange: (from: string | undefined, to: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  // The range being picked on the calendar, before it's complete.
  const [draft, setDraft] = useState<DateRange | undefined>();
  const today = day(new Date());
  const active = Boolean(from ?? to);

  const apply = (nextFrom?: string, nextTo?: string) => {
    setOpen(false);
    setDraft(undefined);
    onChange(nextFrom, nextTo);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setDraft(undefined);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("h-8 font-normal", !active && "text-muted-foreground")}
          aria-label={`Dates: ${rangeLabel(from, to, today)}`}
        >
          <CalendarDays aria-hidden />
          {rangeLabel(from, to, today)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="flex w-auto flex-col p-0 sm:flex-row" align="start">
        <div className="flex flex-wrap gap-1 border-b p-2 sm:w-36 sm:flex-col sm:flex-nowrap sm:border-r sm:border-b-0">
          {[{ label: "Any time", from: undefined, to: undefined }, ...presets(today)].map(
            (preset) => (
              <Button
                key={preset.label}
                variant="ghost"
                size="sm"
                className={cn(
                  "justify-start font-normal",
                  preset.from === from && preset.to === to && "bg-accent font-medium",
                )}
                onClick={() => {
                  apply(preset.from, preset.to);
                }}
              >
                {preset.label}
              </Button>
            ),
          )}
        </div>
        <Calendar
          mode="range"
          selected={
            draft ?? (from ? { from: toDate(from), to: to ? toDate(to) : undefined } : undefined)
          }
          defaultMonth={from ? toDate(from) : new Date()}
          disabled={{ after: new Date() }}
          onSelect={(range, picked) => {
            // The first click starts a new range; the second finishes it.
            if (!draft) {
              setDraft({ from: picked });
              return;
            }
            const start = range?.from ?? picked;
            const end = range?.to ?? start;
            apply(day(start), day(end));
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
