import React, { useState, useMemo } from "react";
import type { Event } from "@workspace/api-client-react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  format,
  addMonths,
  subMonths,
  isToday,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  User,
  CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface CalendarViewProps {
  events: Event[];
  isLoading: boolean;
  onSelectBuilding: (id: number) => void;
}

const CATEGORY_DOT: Record<string, string> = {
  ams: "bg-blue-500",
  academic: "bg-amber-500",
  residence: "bg-purple-500",
  athletics: "bg-red-500",
};

const CATEGORY_CHIP: Record<string, string> = {
  ams: "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200",
  academic: "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200",
  residence: "bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200",
  athletics: "bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200",
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Compact event card shown in the day-detail panel */
function CalendarEventCard({
  event,
  onSelectBuilding,
}: {
  event: Event;
  onSelectBuilding: (id: number) => void;
}) {
  const start = new Date(event.startTime);
  const end = new Date(event.endTime);

  return (
    <button
      onClick={() => onSelectBuilding(event.buildingId)}
      className="w-full rounded-2xl border border-border/40 bg-background/60 p-3.5 text-left transition-all hover:border-border hover:bg-background hover:shadow-sm active:scale-[0.99]"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <h4 className="line-clamp-2 flex-1 text-sm font-semibold leading-tight text-foreground">
          {event.title}
        </h4>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
            CATEGORY_CHIP[event.category] ?? "bg-gray-100 text-gray-800"
          )}
        >
          {event.category === "ams" ? "AMS" : event.category}
        </span>
      </div>

      <div className="space-y-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Clock className="h-3 w-3 shrink-0" />
          <span>
            {format(start, "h:mm a")} – {format(end, "h:mm a")}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">
            {event.buildingName}
            {event.locationDetails ? ` · ${event.locationDetails}` : ""}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <User className="h-3 w-3 shrink-0" />
          <span className="truncate">{event.organizer}</span>
        </div>
      </div>
    </button>
  );
}

export function CalendarView({
  events,
  isLoading,
  onSelectBuilding,
}: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date());

  /** Calendar days for the current view (always 5 or 6 full weeks) */
  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  /** "yyyy-MM-dd" → events on that date */
  const eventsByDate = useMemo(() => {
    const map = new Map<string, Event[]>();
    for (const ev of events) {
      const key = format(new Date(ev.startTime), "yyyy-MM-dd");
      const arr = map.get(key) ?? [];
      arr.push(ev);
      map.set(key, arr);
    }
    return map;
  }, [events]);

  const selectedDayEvents = useMemo(() => {
    const key = format(selectedDay, "yyyy-MM-dd");
    return eventsByDate.get(key) ?? [];
  }, [selectedDay, eventsByDate]);

  const weeks = Math.ceil(calendarDays.length / 7);

  return (
    <div className="absolute inset-x-0 bottom-0 top-44 flex flex-col gap-3 overflow-hidden p-3 sm:p-4 lg:flex-row">
      {/* ── Calendar grid panel ── */}
      <div className="glass flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl">
        {/* Month navigation */}
        <div className="flex items-center justify-between border-b border-border/30 px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
            className="h-8 w-8 rounded-full text-foreground hover:bg-black/5 dark:hover:bg-white/10"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-base font-bold text-foreground">
            {format(currentMonth, "MMMM yyyy")}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
            className="h-8 w-8 rounded-full text-foreground hover:bg-black/5 dark:hover:bg-white/10"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Day-of-week labels */}
        <div className="grid grid-cols-7 border-b border-border/20 px-2">
          {DAY_LABELS.map((d) => (
            <div
              key={d}
              className="py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div
          className="grid min-h-0 flex-1 grid-cols-7 gap-px overflow-hidden px-1.5 pb-1.5"
          style={{
            gridTemplateRows: `repeat(${weeks}, minmax(0, 1fr))`,
          }}
        >
          {calendarDays.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const dayEvents = eventsByDate.get(key) ?? [];
            const isSelected = isSameDay(day, selectedDay);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const todayFlag = isToday(day);

            return (
              <button
                key={key}
                onClick={() => setSelectedDay(day)}
                aria-label={`${format(day, "MMMM d")}${dayEvents.length ? `, ${dayEvents.length} event${dayEvents.length > 1 ? "s" : ""}` : ""}`}
                aria-pressed={isSelected}
                className={cn(
                  "flex min-h-0 flex-col items-center gap-0.5 overflow-hidden rounded-xl p-0.5 pt-1 transition-colors hover:bg-black/5 dark:hover:bg-white/5",
                  isSelected &&
                    "bg-[#002452]/10 ring-1 ring-[#002452]/25 dark:bg-white/10 dark:ring-white/20",
                  !isCurrentMonth && "opacity-30"
                )}
              >
                {/* Date number */}
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    todayFlag &&
                      "bg-[#002452] text-white dark:bg-[#F9A01B] dark:text-[#002452]",
                    isSelected &&
                      !todayFlag &&
                      "text-[#002452] dark:text-[#F9A01B]",
                    !isSelected && !todayFlag && "text-foreground"
                  )}
                >
                  {format(day, "d")}
                </span>

                {/* Events: chips on desktop, dots on mobile */}
                {dayEvents.length > 0 && (
                  <>
                    {/* Desktop chips */}
                    <div className="hidden w-full flex-col gap-px lg:flex">
                      {dayEvents.slice(0, 2).map((ev) => (
                        <div
                          key={ev.id}
                          className={cn(
                            "w-full truncate rounded px-1 py-px text-[10px] font-medium leading-tight",
                            CATEGORY_CHIP[ev.category] ??
                              "bg-gray-100 text-gray-800"
                          )}
                        >
                          {ev.title}
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <div className="px-1 text-[10px] text-muted-foreground">
                          +{dayEvents.length - 2} more
                        </div>
                      )}
                    </div>

                    {/* Mobile dots */}
                    <div className="flex justify-center gap-0.5 lg:hidden">
                      {dayEvents.slice(0, 3).map((ev, i) => (
                        <span
                          key={i}
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            CATEGORY_DOT[ev.category] ?? "bg-gray-400"
                          )}
                        />
                      ))}
                      {dayEvents.length > 3 && (
                        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                      )}
                    </div>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Day-detail panel (desktop sidebar) ── */}
      <div className="glass hidden w-80 flex-none flex-col overflow-hidden rounded-3xl xl:flex xl:w-96">
        <div className="border-b border-border/30 px-4 py-3.5">
          <h3 className="font-bold text-foreground">
            {format(selectedDay, "EEEE, MMMM d")}
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {isLoading
              ? "Loading…"
              : selectedDayEvents.length === 0
              ? "No events scheduled"
              : `${selectedDayEvents.length} event${selectedDayEvents.length > 1 ? "s" : ""}`}
          </p>
        </div>

        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="space-y-3 p-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full rounded-2xl" />
              ))}
            </div>
          ) : selectedDayEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 p-10 text-center">
              <CalendarDays className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                Select a day with events to see details
              </p>
            </div>
          ) : (
            <div className="space-y-2 p-3">
              {selectedDayEvents.map((ev) => (
                <CalendarEventCard
                  key={ev.id}
                  event={ev}
                  onSelectBuilding={onSelectBuilding}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* ── Mobile day-detail strip (shown below grid on small screens) ── */}
      <div className="glass flex max-h-44 flex-none flex-col overflow-hidden rounded-3xl xl:hidden">
        <div className="flex items-center justify-between border-b border-border/30 px-4 py-2.5">
          <div>
            <h3 className="text-sm font-bold text-foreground">
              {format(selectedDay, "EEEE, MMMM d")}
            </h3>
            <p className="text-xs text-muted-foreground">
              {isLoading
                ? "Loading…"
                : selectedDayEvents.length === 0
                ? "No events"
                : `${selectedDayEvents.length} event${selectedDayEvents.length > 1 ? "s" : ""}`}
            </p>
          </div>
        </div>
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="space-y-2 p-3">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : selectedDayEvents.length === 0 ? (
            <div className="flex items-center justify-center gap-2 p-4 text-sm text-muted-foreground">
              <CalendarDays className="h-4 w-4 shrink-0 opacity-40" />
              Select a day with events
            </div>
          ) : (
            <div className="space-y-2 p-2.5">
              {selectedDayEvents.map((ev) => (
                <CalendarEventCard
                  key={ev.id}
                  event={ev}
                  onSelectBuilding={onSelectBuilding}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
