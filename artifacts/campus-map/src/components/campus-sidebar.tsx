import { useMemo, useState } from "react";
import type { Building, Event } from "@workspace/api-client-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { UpcomingEventsSidebar } from "./upcoming-events-sidebar";
import {
  Search,
  X,
  GraduationCap,
  Dumbbell,
  Home,
  Landmark,
  MapPin,
  Compass,
  CalendarDays,
} from "lucide-react";

export const BUILDING_CATEGORY_META: Record<
  string,
  { label: string; short: string; icon: typeof GraduationCap; color: string }
> = {
  academic: { label: "Academic Buildings", short: "Academic", icon: GraduationCap, color: "#3b82f6" },
  student_life: { label: "Student Life & Athletics", short: "Student Life", icon: Dumbbell, color: "#16a34a" },
  residences: { label: "Residences", short: "Residences", icon: Home, color: "#F9A01B" },
  landmarks: { label: "Landmarks & Dining", short: "Landmarks", icon: Landmark, color: "#8b5cf6" },
};

export const BUILDING_CATEGORIES = Object.keys(BUILDING_CATEGORY_META);

const STATUS_DOT: Record<string, string> = {
  active: "#16a34a",
  upcoming_today: "#F9A01B",
  upcoming_week: "#3b82f6",
  none: "#94a3b8",
};

interface CampusSidebarProps {
  buildings: Building[];
  events: Event[];
  isLoadingEvents: boolean;
  visibleCategories: Set<string>;
  onToggleCategory: (category: string) => void;
  selectedBuildingId: number | null;
  onSelectBuilding: (id: number) => void;
}

export function CampusSidebar({
  buildings,
  events,
  isLoadingEvents,
  visibleCategories,
  onToggleCategory,
  selectedBuildingId,
  onSelectBuilding,
}: CampusSidebarProps) {
  const [buildingSearch, setBuildingSearch] = useState("");

  const filteredBuildings = useMemo(() => {
    const q = buildingSearch.trim().toLowerCase();
    return buildings
      .filter((b) => visibleCategories.has(b.category))
      .filter(
        (b) =>
          !q ||
          b.name.toLowerCase().includes(q) ||
          b.shortName.toLowerCase().includes(q)
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [buildings, visibleCategories, buildingSearch]);

  return (
    <div className="flex h-full flex-col bg-transparent">
      <Tabs defaultValue="explore" className="flex h-full flex-col">
        <div className="border-b border-border/60 p-3 pr-12">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="explore" className="gap-1.5">
              <Compass className="h-4 w-4" />
              Explore
            </TabsTrigger>
            <TabsTrigger value="events" className="gap-1.5">
              <CalendarDays className="h-4 w-4" />
              Events
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Explore: building search, category toggles, building list */}
        <TabsContent
          value="explore"
          className="mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
        >
          <div className="space-y-3 border-b border-border/60 p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search buildings..."
                className="h-10 w-full bg-background pl-9 pr-9 shadow-sm"
                value={buildingSearch}
                onChange={(e) => setBuildingSearch(e.target.value)}
              />
              {buildingSearch && (
                <button
                  onClick={() => setBuildingSearch("")}
                  className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="space-y-1.5">
              <p className="px-0.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Categories
              </p>
              {BUILDING_CATEGORIES.map((cat) => {
                const meta = BUILDING_CATEGORY_META[cat];
                const Icon = meta.icon;
                const on = visibleCategories.has(cat);
                return (
                  <label
                    key={cat}
                    className="flex cursor-pointer items-center justify-between gap-2 rounded-xl px-2.5 py-2 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                  >
                    <span className="flex items-center gap-2.5">
                      <span
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-white"
                        style={{ backgroundColor: meta.color }}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="text-sm font-medium text-foreground">{meta.label}</span>
                    </span>
                    <Switch
                      checked={on}
                      onCheckedChange={() => onToggleCategory(cat)}
                      aria-label={`Toggle ${meta.label}`}
                    />
                  </label>
                );
              })}
            </div>
          </div>

          <ScrollArea className="min-h-0 flex-1 p-3">
            {filteredBuildings.length > 0 ? (
              <div className="space-y-1 pb-6">
                {filteredBuildings.map((b) => {
                  const meta = BUILDING_CATEGORY_META[b.category];
                  const Icon = meta?.icon ?? MapPin;
                  const count =
                    b.activeEventCount + b.todayEventCount + b.weekEventCount;
                  const isSelected = selectedBuildingId === b.id;
                  return (
                    <button
                      key={b.id}
                      onClick={() => onSelectBuilding(b.id)}
                      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                        isSelected
                          ? "border-primary/40 bg-primary/10"
                          : "border-transparent hover:bg-black/5 dark:hover:bg-white/5"
                      }`}
                    >
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white"
                        style={{ backgroundColor: meta?.color ?? "#64748b" }}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-foreground">
                          {b.name}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {meta?.short ?? "Building"}
                        </span>
                      </span>
                      {count > 0 && (
                        <span className="flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: STATUS_DOT[b.eventStatus] }}
                          />
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <MapPin className="mb-3 h-10 w-10 opacity-20" />
                <p className="text-sm font-medium">No buildings found</p>
                <p className="mt-1 max-w-[200px] text-xs">
                  Try a different search or enable more categories.
                </p>
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        {/* Events: existing upcoming-events list */}
        <TabsContent
          value="events"
          className="mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
        >
          <UpcomingEventsSidebar events={events} isLoading={isLoadingEvents} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
