import React from "react";
import { Event } from "@workspace/api-client-react";
import { EventCard } from "./event-card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CalendarDays } from "lucide-react";

interface UpcomingEventsSidebarProps {
  events: Event[];
  isLoading: boolean;
}

export function UpcomingEventsSidebar({ events, isLoading }: UpcomingEventsSidebarProps) {
  return (
    <div className="h-full flex flex-col bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-r border-border shadow-sm">
      <div className="p-4 border-b border-border">
        <h2 className="text-xl font-bold flex items-center gap-2 text-foreground">
          <CalendarDays className="w-5 h-5 text-primary" />
          Upcoming Events
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Discover what's happening around campus.
        </p>
      </div>
      
      <ScrollArea className="flex-1 p-4">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse bg-muted rounded-lg h-32 w-full"></div>
            ))}
          </div>
        ) : events.length > 0 ? (
          <div className="space-y-1 pb-10">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center h-full text-muted-foreground">
            <CalendarDays className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-base font-medium">No events found</p>
            <p className="text-sm mt-1 max-w-[200px]">Try adjusting your filters or search term to see more events.</p>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
