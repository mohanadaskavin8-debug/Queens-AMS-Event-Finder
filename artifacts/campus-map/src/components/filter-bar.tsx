import React from "react";
import { ListEventsCategory, ListEventsTimeframe } from "@workspace/api-client-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface FilterBarProps {
  category: ListEventsCategory | undefined;
  timeframe: ListEventsTimeframe | undefined;
  onChangeCategory: (val: ListEventsCategory | undefined) => void;
  onChangeTimeframe: (val: ListEventsTimeframe | undefined) => void;
}

export function FilterBar({ category, timeframe, onChangeCategory, onChangeTimeframe }: FilterBarProps) {
  return (
    <div className="w-full px-2.5 py-2 flex flex-col sm:flex-row items-center justify-between gap-4">
      <div className="flex items-center w-full sm:w-auto">
        <ScrollArea className="w-full max-w-full whitespace-nowrap">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-muted-foreground mr-1 hidden md:inline-block">Time:</span>
              <ToggleGroup 
                type="single" 
                value={timeframe || "all"} 
                onValueChange={(val) => onChangeTimeframe(val ? (val as ListEventsTimeframe) : undefined)}
                className="justify-start bg-muted/50 p-1 rounded-lg"
              >
                <ToggleGroupItem value="all" className="h-8 px-3 text-xs rounded-md data-[state=on]:bg-background data-[state=on]:shadow-sm">All</ToggleGroupItem>
                <ToggleGroupItem value="now" className="h-8 px-3 text-xs rounded-md data-[state=on]:bg-green-100 data-[state=on]:text-green-800 dark:data-[state=on]:bg-green-900/30 dark:data-[state=on]:text-green-400">Now</ToggleGroupItem>
                <ToggleGroupItem value="today" className="h-8 px-3 text-xs rounded-md data-[state=on]:bg-amber-100 data-[state=on]:text-amber-800 dark:data-[state=on]:bg-amber-900/30 dark:data-[state=on]:text-amber-400">Today</ToggleGroupItem>
                <ToggleGroupItem value="week" className="h-8 px-3 text-xs rounded-md data-[state=on]:bg-blue-100 data-[state=on]:text-blue-800 dark:data-[state=on]:bg-blue-900/30 dark:data-[state=on]:text-blue-400">Week</ToggleGroupItem>
              </ToggleGroup>
            </div>
            
            <Separator orientation="vertical" className="h-6 hidden sm:block mx-1" />
            
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-muted-foreground mr-1 hidden lg:inline-block">Category:</span>
              <ToggleGroup 
                type="single" 
                value={category || "all"} 
                onValueChange={(val) => onChangeCategory(val ? (val as ListEventsCategory) : undefined)}
                className="justify-start bg-muted/50 p-1 rounded-lg"
              >
                <ToggleGroupItem value="all" className="h-8 px-3 text-xs rounded-md data-[state=on]:bg-background data-[state=on]:shadow-sm">All</ToggleGroupItem>
                <ToggleGroupItem value="ams" className="h-8 px-3 text-xs rounded-md data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">AMS</ToggleGroupItem>
                <ToggleGroupItem value="academic" className="h-8 px-3 text-xs rounded-md data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">Academic</ToggleGroupItem>
                <ToggleGroupItem value="residence" className="h-8 px-3 text-xs rounded-md data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">Residence</ToggleGroupItem>
                <ToggleGroupItem value="athletics" className="h-8 px-3 text-xs rounded-md data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">Athletics</ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>
          <ScrollBar orientation="horizontal" className="invisible" />
        </ScrollArea>
      </div>
    </div>
  );
}
