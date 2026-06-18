import React, { useState, useMemo } from "react";
import { 
  useListBuildings, 
  useGetBuilding, 
  useListEvents,
  useGetEventsSummary,
  ListEventsCategory,
  ListEventsTimeframe,
  getListEventsQueryKey
} from "@workspace/api-client-react";
import { CampusMap } from "@/components/campus-map";
import { EventPanel } from "@/components/event-panel";
import { FilterBar } from "@/components/filter-bar";
import { SearchBar } from "@/components/search-bar";
import { UpcomingEventsSidebar } from "@/components/upcoming-events-sidebar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, Layers, Plus } from "lucide-react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { ManageEventDialog } from "@/components/manage-event-dialog";

export default function MapView() {
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(null);
  const [category, setCategory] = useState<ListEventsCategory | undefined>(undefined);
  const [timeframe, setTimeframe] = useState<ListEventsTimeframe | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);

  // Queries
  const { data: buildings = [] } = useListBuildings({
    query: {
      refetchInterval: 60000 // Refresh every minute
    }
  });

  const { data: eventsSummary = [] } = useGetEventsSummary({
    query: {
      refetchInterval: 60000
    }
  });

  const { data: selectedBuilding, isLoading: isLoadingBuilding } = useGetBuilding(selectedBuildingId as number, {
    query: {
      enabled: selectedBuildingId !== null
    }
  });

  const { data: filteredEvents = [], isLoading: isLoadingEvents } = useListEvents({
    category: category === "all" ? undefined : category,
    timeframe: timeframe === "all" ? undefined : timeframe,
    search: search || undefined
  }, {
    query: {
      queryKey: getListEventsQueryKey({ category, timeframe, search }),
      refetchInterval: 60000
    }
  });

  // Derived state to highlight buildings based on active filters
  const filteredBuildingIds = useMemo(() => {
    if ((!category || category === "all") && (!timeframe || timeframe === "all") && !search) {
      return null; // No filters active
    }
    const ids = new Set(filteredEvents.map(e => e.buildingId));
    return ids;
  }, [filteredEvents, category, timeframe, search]);

  const mapBuildings = useMemo(() => {
    if (!filteredBuildingIds) return buildings;
    
    // Create a modified building list where non-matching buildings have their event status set to 'none'
    // so they appear grayed out on the map, but still exist.
    return buildings.map(b => {
      if (filteredBuildingIds.has(b.id)) return b;
      return { ...b, eventStatus: "none", activeEventCount: 0, todayEventCount: 0, weekEventCount: 0 };
    });
  }, [buildings, filteredBuildingIds]);

  return (
    <div className="flex flex-col h-[100dvh] w-full overflow-hidden bg-background">
      {/* Header / Nav */}
      <header className="h-16 flex-none bg-primary text-primary-foreground flex items-center px-4 md:px-6 justify-between shadow-md z-30">
        <div className="flex items-center gap-3">
          <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden text-primary-foreground hover:bg-primary-foreground/20 hover:text-white">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-80">
              <UpcomingEventsSidebar events={filteredEvents} isLoading={isLoadingEvents} />
            </SheetContent>
          </Sheet>
          
          <div className="flex items-center gap-2">
            <Layers className="h-6 w-6 text-secondary" />
            <h1 className="text-xl font-bold tracking-tight hidden sm:block">Queen's Campus Events</h1>
            <h1 className="text-xl font-bold tracking-tight sm:hidden">Campus Events</h1>
          </div>
        </div>
        
        <div className="flex items-center gap-2 md:gap-4 w-full justify-end max-w-xl">
          <div className="hidden sm:block flex-1 max-w-sm">
            <SearchBar value={search} onChange={setSearch} />
          </div>
          <Button 
            onClick={() => setIsAddEventOpen(true)}
            variant="secondary" 
            size="sm" 
            className="text-secondary-foreground font-semibold flex items-center gap-1 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Event</span>
          </Button>
        </div>
      </header>

      {/* Mobile Search Bar - Shows below header on small screens */}
      <div className="sm:hidden p-2 bg-primary/5 border-b border-border z-20">
        <SearchBar value={search} onChange={setSearch} />
      </div>

      {/* Filters */}
      <FilterBar 
        category={category} 
        timeframe={timeframe} 
        onChangeCategory={setCategory} 
        onChangeTimeframe={setTimeframe} 
      />

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative">
        <ResizablePanelGroup direction="horizontal" className="h-full w-full">
          {/* Sidebar - Desktop Only */}
          <ResizablePanel defaultSize={30} minSize={25} maxSize={40} className="hidden md:block">
            <UpcomingEventsSidebar events={filteredEvents} isLoading={isLoadingEvents} />
          </ResizablePanel>
          
          <ResizableHandle className="hidden md:flex bg-border/50 hover:bg-primary/50 transition-colors w-1" />
          
          {/* Map Area */}
          <ResizablePanel defaultSize={70} minSize={40} className="relative bg-[#E5E9E0] dark:bg-zinc-900">
            <div className="absolute inset-4 rounded-xl shadow-lg overflow-hidden border border-border">
              <CampusMap 
                buildings={mapBuildings as any[]} 
                selectedBuildingId={selectedBuildingId}
                onSelectBuilding={setSelectedBuildingId}
              />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Building Details Panel */}
      <EventPanel 
        building={selectedBuilding || null} 
        isOpen={selectedBuildingId !== null} 
        onClose={() => setSelectedBuildingId(null)}
        isLoading={isLoadingBuilding}
      />

      {/* Add Event Dialog */}
      <ManageEventDialog 
        isOpen={isAddEventOpen} 
        onClose={() => setIsAddEventOpen(false)} 
      />
    </div>
  );
}
