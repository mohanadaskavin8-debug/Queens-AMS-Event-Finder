import { useState, useMemo } from "react";
import {
  useListBuildings,
  useGetBuilding,
  useListEvents,
  ListEventsCategory,
  ListEventsTimeframe,
  getListEventsQueryKey,
  getListBuildingsQueryKey,
  getGetBuildingQueryKey,
} from "@workspace/api-client-react";
import { CampusMap, type MapTheme } from "@/components/campus-map";
import { EventPanel } from "@/components/event-panel";
import { FilterBar } from "@/components/filter-bar";
import { SearchBar } from "@/components/search-bar";
import { CampusSidebar, BUILDING_CATEGORIES } from "@/components/campus-sidebar";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, Plus, Sun, Moon, Crosshair, ChevronLeft, MapPin, Box } from "lucide-react";
import { ManageEventDialog } from "@/components/manage-event-dialog";

const LEGEND = [
  { label: "Happening now", color: "#16a34a" },
  { label: "Today", color: "#F9A01B" },
  { label: "This week", color: "#3b82f6" },
  { label: "No events", color: "#64748b" },
];

export default function MapView() {
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(null);
  const [category, setCategory] = useState<ListEventsCategory | undefined>(undefined);
  const [timeframe, setTimeframe] = useState<ListEventsTimeframe | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mapTheme, setMapTheme] = useState<MapTheme>("day");
  const [recenter, setRecenter] = useState(0);
  const [pitchSignal, setPitchSignal] = useState(0);
  const [visibleCategories, setVisibleCategories] = useState<Set<string>>(
    () => new Set(BUILDING_CATEGORIES)
  );

  const toggleCategory = (cat: string) =>
    setVisibleCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });

  const handleSelectBuildingFromList = (id: number) => {
    setSelectedBuildingId(id);
    setMobileSidebarOpen(false);
  };

  const { data: buildings = [] } = useListBuildings({
    query: { queryKey: getListBuildingsQueryKey(), refetchInterval: 60000 },
  });

  const { data: selectedBuilding, isLoading: isLoadingBuilding } = useGetBuilding(
    selectedBuildingId as number,
    {
      query: {
        queryKey: getGetBuildingQueryKey(selectedBuildingId as number),
        enabled: selectedBuildingId !== null,
      },
    }
  );

  const { data: filteredEvents = [], isLoading: isLoadingEvents } = useListEvents(
    {
      category: category === "all" ? undefined : category,
      timeframe: timeframe === "all" ? undefined : timeframe,
      search: search || undefined,
    },
    {
      query: {
        queryKey: getListEventsQueryKey({ category, timeframe, search }),
        refetchInterval: 60000,
      },
    }
  );

  const filteredBuildingIds = useMemo(() => {
    if ((!category || category === "all") && (!timeframe || timeframe === "all") && !search) {
      return null;
    }
    return new Set(filteredEvents.map((e) => e.buildingId));
  }, [filteredEvents, category, timeframe, search]);

  const mapBuildings = useMemo(() => {
    if (!filteredBuildingIds) return buildings;
    return buildings.map((b) =>
      filteredBuildingIds.has(b.id)
        ? b
        : { ...b, eventStatus: "none" as const, activeEventCount: 0, todayEventCount: 0, weekEventCount: 0 }
    );
  }, [buildings, filteredBuildingIds]);

  const activeNow = useMemo(
    () => buildings.reduce((sum, b) => sum + b.activeEventCount, 0),
    [buildings]
  );

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-[#eef2f7] dark:bg-[#0a1424]">
      <CampusMap
        buildings={mapBuildings}
        selectedBuildingId={selectedBuildingId}
        onSelectBuilding={setSelectedBuildingId}
        theme={mapTheme}
        visibleCategories={visibleCategories}
        recenterSignal={recenter}
        pitchSignal={pitchSignal}
      />

      {/* Top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 p-3 sm:p-4">
        <div className="mx-auto flex max-w-[1500px] items-center gap-2 sm:gap-3">
          {/* Brand */}
          <div className="glass fade-up pointer-events-auto flex items-center gap-3 rounded-2xl px-3.5 py-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#002452] text-[#F9A01B] shadow-inner">
              <MapPin className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-bold tracking-tight text-foreground">Queen's Campus</div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                {activeNow > 0 ? (
                  <>
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-600" />
                    </span>
                    {activeNow} happening now
                  </>
                ) : (
                  "Events Map · Pilot"
                )}
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="glass fade-up pointer-events-auto hidden flex-1 rounded-2xl px-2 py-1.5 sm:block">
            <SearchBar value={search} onChange={setSearch} />
          </div>

          <div className="flex-1 sm:hidden" />

          {/* Controls */}
          <div className="pointer-events-auto flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setMapTheme((t) => (t === "day" ? "night" : "day"))}
              className="glass h-11 w-11 rounded-2xl text-foreground hover:text-foreground"
              title="Toggle day / night map"
            >
              {mapTheme === "day" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </Button>
            <Button
              onClick={() => setIsAddEventOpen(true)}
              className="h-11 gap-1.5 rounded-2xl bg-[#002452] px-4 font-semibold text-white shadow-lg hover:bg-[#012f6b]"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Event</span>
            </Button>
            {/* Mobile sidebar trigger */}
            <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
              <SheetTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="glass h-11 w-11 rounded-2xl text-foreground hover:text-foreground md:hidden"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[88vw] max-w-sm p-0">
                <SheetTitle className="sr-only">Explore campus</SheetTitle>
                <SheetDescription className="sr-only">
                  Search buildings, filter categories, and browse events around campus.
                </SheetDescription>
                <CampusSidebar
                  buildings={buildings}
                  events={filteredEvents}
                  isLoadingEvents={isLoadingEvents}
                  visibleCategories={visibleCategories}
                  onToggleCategory={toggleCategory}
                  selectedBuildingId={selectedBuildingId}
                  onSelectBuilding={handleSelectBuildingFromList}
                />
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Filters */}
        <div className="mx-auto mt-2 flex max-w-[1500px] flex-wrap items-center gap-2">
          <div className="glass fade-up pointer-events-auto rounded-2xl">
            <FilterBar
              category={category}
              timeframe={timeframe}
              onChangeCategory={setCategory}
              onChangeTimeframe={setTimeframe}
            />
          </div>
        </div>

        {/* Mobile search */}
        <div className="glass fade-up pointer-events-auto mx-auto mt-2 max-w-[1500px] rounded-2xl px-2 py-1.5 sm:hidden">
          <SearchBar value={search} onChange={setSearch} />
        </div>
      </div>

      {/* Desktop sidebar */}
      <div
        className={`pointer-events-none absolute bottom-4 left-4 top-44 z-10 hidden w-[370px] transition-all duration-300 md:block ${
          sidebarOpen ? "translate-x-0 opacity-100" : "-translate-x-[110%] opacity-0"
        }`}
      >
        <div className="glass pointer-events-auto relative flex h-full flex-col overflow-hidden rounded-3xl">
          <button
            onClick={() => setSidebarOpen(false)}
            className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-black/5"
            title="Collapse"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <CampusSidebar
            buildings={buildings}
            events={filteredEvents}
            isLoadingEvents={isLoadingEvents}
            visibleCategories={visibleCategories}
            onToggleCategory={toggleCategory}
            selectedBuildingId={selectedBuildingId}
            onSelectBuilding={handleSelectBuildingFromList}
          />
        </div>
      </div>

      {/* Reopen sidebar button */}
      {!sidebarOpen && (
        <Button
          onClick={() => setSidebarOpen(true)}
          className="glass fade-up absolute left-4 top-44 z-10 hidden h-11 gap-2 rounded-2xl px-4 font-semibold text-foreground hover:text-foreground md:flex"
          variant="ghost"
        >
          <Menu className="h-4 w-4" />
          Events
        </Button>
      )}

      {/* Map controls */}
      <div className="absolute bottom-28 right-4 z-10 flex flex-col gap-2">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setPitchSignal((n) => n + 1)}
          className="glass h-11 w-11 rounded-2xl text-foreground hover:text-foreground"
          title="Toggle 3D tilt"
        >
          <Box className="h-5 w-5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setRecenter((n) => n + 1)}
          className="glass h-11 w-11 rounded-2xl text-foreground hover:text-foreground"
          title="Recenter map"
        >
          <Crosshair className="h-5 w-5" />
        </Button>
      </div>

      {/* Legend */}
      <div className="glass fade-up pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full px-4 py-2">
        <div className="flex items-center gap-3 sm:gap-4">
          {LEGEND.map((l) => (
            <div key={l.label} className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full ring-2 ring-white/70"
                style={{ backgroundColor: l.color }}
              />
              <span className="text-[11px] font-medium text-foreground sm:text-xs">{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Building details */}
      <EventPanel
        building={selectedBuilding || null}
        isOpen={selectedBuildingId !== null}
        onClose={() => setSelectedBuildingId(null)}
        isLoading={isLoadingBuilding}
      />

      <ManageEventDialog isOpen={isAddEventOpen} onClose={() => setIsAddEventOpen(false)} />
    </div>
  );
}
