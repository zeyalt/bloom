"use client";

import { useState } from "react";
import { addDays, format, parseISO, startOfWeek } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export interface DayMarker {
  /** Anything planned that day (classes). */
  planned: boolean;
  /** Past sessions on that day with no attendance logged. */
  unlogged: number;
  /** Past sessions on that day that are logged. */
  logged: number;
}

const isoOf = (d: Date) => format(d, "yyyy-MM-dd");

/** The Sun–Sat week containing `iso`. */
export function weekOf(iso: string): string[] {
  const sunday = startOfWeek(parseISO(iso), { weekStartsOn: 0 });
  return Array.from({ length: 7 }, (_, i) => isoOf(addDays(sunday, i)));
}

/** "November 2026", or "Nov – Dec 2026" for a week across two months. */
function monthLabel(week: string[]) {
  const a = parseISO(week[0]), b = parseISO(week[6]);
  if (format(a, "yyyy-MM") === format(b, "yyyy-MM")) return format(a, "MMMM yyyy");
  if (format(a, "yyyy") === format(b, "yyyy")) return `${format(a, "MMM")} – ${format(b, "MMM yyyy")}`;
  return `${format(a, "MMM yyyy")} – ${format(b, "MMM yyyy")}`;
}

/**
 * Which day Home shows: the week as seven days (‹ › move a week), the month to open a
 * calendar for any date, and "Today" to come back. Each day's dot: red = a session not
 * logged yet, green = everything so far logged, grey = planned (still to come).
 */
export function DateBar({ date, today, markers, onChange }: {
  date: string;
  today: string;
  markers: Map<string, DayMarker>;
  onChange: (iso: string) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  // Phones change a date input as the wheel turns, so the jump waits for "Go".
  const [picked, setPicked] = useState(date);
  const openPicker = () => { setPicked(date); setPickerOpen(true); };
  const week = weekOf(date);
  const shiftWeek = (n: number) => onChange(isoOf(addDays(parseISO(date), 7 * n)));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <IconButton icon={ChevronLeft} label="Previous week" onClick={() => shiftWeek(-1)} className="border border-[var(--rule)] bg-[var(--sheet)]" />
        <button type="button" onClick={openPicker} aria-haspopup="dialog"
          className="flex-1 min-w-0 inline-flex items-center justify-center gap-2 h-12 border border-[var(--rule)] bg-[var(--sheet)] rounded-[var(--radius-md)] text-sm font-medium text-[var(--ink)] hover:border-[var(--ink-faint)] cursor-pointer">
          <CalendarDays size={16} aria-hidden="true" /> <span className="truncate">{monthLabel(week)}</span>
        </button>
        {date !== today && (
          <button type="button" onClick={() => onChange(today)}
            className="h-12 px-3 border border-[var(--stem)] text-[var(--stem)] bg-[var(--sheet)] rounded-[var(--radius-md)] text-sm font-semibold cursor-pointer">
            Today
          </button>
        )}
        <IconButton icon={ChevronRight} label="Next week" onClick={() => shiftWeek(1)} className="border border-[var(--rule)] bg-[var(--sheet)]" />
      </div>

      <div role="group" aria-label="Choose a day" className="grid grid-cols-7 gap-1">
        {week.map(iso => {
          const d = parseISO(iso);
          const chosen = iso === date;
          const isToday = iso === today;
          const m = markers.get(iso);
          return (
            <button key={iso} type="button" onClick={() => onChange(iso)} aria-pressed={chosen}
              aria-label={`${format(d, "EEEE d MMMM")}${isToday ? ", today" : ""}${m?.unlogged ? `, ${m.unlogged} not logged` : m?.logged ? ", all logged" : ""}`}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 h-16 rounded-[var(--radius-md)] border cursor-pointer",
                chosen ? "bg-[var(--ink)] border-[var(--ink)] text-[var(--sheet)]"
                  : isToday ? "border-2 border-[var(--stem)] bg-[var(--sheet)] text-[var(--ink)]"
                  : "border-[var(--rule)] bg-[var(--sheet)] text-[var(--ink)] hover:border-[var(--ink-faint)]"
              )}>
              <span className={cn("text-xs leading-4 font-medium", chosen ? "text-[var(--sheet)]/80" : isToday ? "text-[var(--stem)] font-semibold" : "text-[var(--ink-soft)]")}>
                {format(d, "EEEEE")}
              </span>
              <span className="text-base leading-5 font-bold tabular-nums">{format(d, "d")}</span>
              <span aria-hidden="true" className="h-4 flex items-center">
                {m && (m.unlogged > 0 || m.logged > 0 || m.planned) && (
                  <span className={cn("w-2 h-2 rounded-full",
                    m.unlogged > 0 ? "bg-[#d64545]"
                      : m.logged > 0 ? "bg-[#3fa66b]"
                      : chosen ? "bg-[var(--sheet)]/70" : "bg-[var(--ink-faint)]")} />
                )}
              </span>
            </button>
          );
        })}
      </div>

      <Modal open={pickerOpen} onClose={() => setPickerOpen(false)} title="Go to a date" size="sm">
        <label htmlFor="day-jump" className="block text-xs font-medium text-[var(--ink-soft)] mb-1">Any date, past or future</label>
        <input id="day-jump" type="date" value={picked} onChange={e => setPicked(e.target.value)}
          className="w-full px-3 py-2 text-base md:text-sm border border-[var(--rule)] rounded-[var(--radius-md)] bg-[var(--sheet)] focus:outline-none focus:border-[var(--stem)]" />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => { onChange(today); setPickerOpen(false); }}>Today</Button>
          <Button disabled={!picked} onClick={() => { onChange(picked); setPickerOpen(false); }}>Go</Button>
        </div>
      </Modal>
    </div>
  );
}
