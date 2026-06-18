import React from "react";
import { BuildingWithEvents, Event } from "@workspace/api-client-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetClose } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EventCard } from "./event-card";
import { MapPin, Activity, CalendarDays, Calendar } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface EventPanelProps {
  building: BuildingWithEvents | null;
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
}

export function EventPanel({ building, isOpen, onClose, isLoading }: EventPanelProps) {
  if (!building && !isLoading) return null;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-md md:max-w-lg p-0 flex flex-col border-l-0 sm:border-l shadow-2xl" side="right">
        {isLoading ? (
          <div className="p-6 h-full flex flex-col items-center justify-center space-y-4">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-muted-foreground font-medium">Loading building details...</p>
          </div>
        ) : building ? (
          <>
            <SheetHeader className="p-6 pb-4 text-left border-b bg-muted/20">
              <div className="flex items-start justify-between">
                <div>
                  <SheetTitle className="text-2xl font-bold text-foreground flex items-center gap-2">
                    <MapPin className="w-6 h-6 text-primary" />
                    {building.name}
                  </SheetTitle>
                  <SheetDescription className="mt-2 text-base">
                    {building.description || "Campus building at Queen's University"}
                  </SheetDescription>
                </div>
              </div>
              
              <div className="flex gap-2 pt-4 flex-wrap">
                {building.activeEventCount > 0 && (
                  <Badge variant="default" className="bg-green-600 hover:bg-green-700 flex items-center gap-1.5 px-2.5 py-1">
                    <Activity className="w-3.5 h-3.5" />
                    {building.activeEventCount} Happening Now
                  </Badge>
                )}
                {building.todayEventCount > 0 && (
                  <Badge variant="secondary" className="bg-amber-500 hover:bg-amber-600 text-white flex items-center gap-1.5 px-2.5 py-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {building.todayEventCount} Today
                  </Badge>
                )}
                {building.weekEventCount > 0 && (
                  <Badge variant="outline" className="border-blue-500 text-blue-700 dark:text-blue-400 flex items-center gap-1.5 px-2.5 py-1">
                    <CalendarDays className="w-3.5 h-3.5" />
                    {building.weekEventCount} This Week
                  </Badge>
                )}
                {building.events.length === 0 && (
                  <Badge variant="outline" className="text-muted-foreground border-border px-2.5 py-1">
                    No upcoming events
                  </Badge>
                )}
              </div>
            </SheetHeader>
            
            <ScrollArea className="flex-1 p-6 pt-4">
              <div className="space-y-6">
                {building.events.length > 0 ? (
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                      Events Schedule
                    </h3>
                    {building.events.map((event) => (
                      <EventCard key={event.id} event={event} expanded={event.status === "active"} />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                      <CalendarDays className="w-8 h-8 text-muted-foreground/50" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">No events scheduled</h3>
                    <p className="text-muted-foreground mt-2 max-w-[250px]">
                      There are no events planned for this building in the near future.
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
