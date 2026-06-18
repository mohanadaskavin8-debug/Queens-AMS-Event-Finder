import React, { useState } from "react";
import { format } from "date-fns";
import { Event, EventCategory, EventStatus, useDeleteEvent, getListEventsQueryKey, getListBuildingsQueryKey, getGetBuildingQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Clock, Calendar, ExternalLink, User, ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { ManageEventDialog } from "./manage-event-dialog";

interface EventCardProps {
  event: Event;
  expanded?: boolean;
}

export function EventCard({ event, expanded = false }: EventCardProps) {
  const [isExpanded, setIsExpanded] = useState(expanded);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const deleteEvent = useDeleteEvent();
  
  const startTime = new Date(event.startTime);
  const endTime = new Date(event.endTime);
  
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this event?")) {
      deleteEvent.mutate({ id: event.id }, {
        onSuccess: () => {
          toast({ title: "Event deleted" });
          queryClient.invalidateQueries({ queryKey: getListEventsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListBuildingsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetBuildingQueryKey(event.buildingId) });
        },
        onError: () => {
          toast({ title: "Failed to delete event", variant: "destructive" });
        }
      });
    }
  };

  const getCategoryColor = (category: EventCategory) => {
    switch (category) {
      case "ams": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 hover:bg-blue-200";
      case "club": return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 hover:bg-purple-200";
      case "academic": return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 hover:bg-amber-200";
      case "athletics": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 hover:bg-red-200";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 hover:bg-gray-200";
    }
  };

  const getStatusBadge = (status: EventStatus) => {
    switch (status) {
      case "active":
        return <Badge variant="default" className="bg-green-600 hover:bg-green-700">Happening Now</Badge>;
      case "upcoming_today":
        return <Badge variant="secondary" className="bg-amber-500 hover:bg-amber-600 text-white">Today</Badge>;
      case "upcoming_week":
        return <Badge variant="outline" className="border-blue-500 text-blue-700 dark:text-blue-400">This Week</Badge>;
      default:
        return null;
    }
  };

  return (
    <>
      <Card className="w-full mb-3 overflow-hidden border-border/50 hover:border-border transition-colors">
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <div className="p-4 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
            <div className="flex justify-between items-start gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  {getStatusBadge(event.status)}
                  <Badge variant="secondary" className={`${getCategoryColor(event.category)} border-transparent`}>
                    {event.category.toUpperCase()}
                  </Badge>
                </div>
                <h3 className="font-bold text-lg text-foreground leading-tight mb-1">{event.title}</h3>
                <p className="text-sm text-muted-foreground font-medium flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  {event.organizer}
                </p>
              </div>
              <div className="flex flex-col items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 rounded-full" onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}>
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 shrink-0" />
                <span>{format(startTime, "h:mm a")} - {format(endTime, "h:mm a")}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 shrink-0" />
                <span>{format(startTime, "MMM d, yyyy")}</span>
              </div>
              <div className="flex items-center gap-2 sm:col-span-2">
                <MapPin className="w-4 h-4 shrink-0" />
                <span className="truncate">{event.buildingName} {event.locationDetails && `- ${event.locationDetails}`}</span>
              </div>
            </div>
          </div>
          
          <CollapsibleContent>
            <div className="px-4 pb-4 pt-0">
              <div className="w-full h-px bg-border/50 mb-4" />
              <div className="prose prose-sm dark:prose-invert max-w-none text-foreground/90">
                <p className="whitespace-pre-wrap">{event.description || "No description provided."}</p>
              </div>
              
              <div className="mt-5 flex flex-wrap gap-2 items-center justify-between">
                {event.registrationLink ? (
                  <Button asChild className="w-full sm:w-auto" variant="default">
                    <a href={event.registrationLink} target="_blank" rel="noopener noreferrer">
                      Register / Learn More
                      <ExternalLink className="w-4 h-4 ml-2" />
                    </a>
                  </Button>
                ) : <div />}
                
                <div className="flex gap-2 w-full sm:w-auto mt-4 sm:mt-0">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={(e) => { e.stopPropagation(); setIsEditDialogOpen(true); }}
                    className="flex-1 sm:flex-none"
                  >
                    <Pencil className="w-4 h-4 mr-2" /> Edit
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleDelete}
                    className="flex-1 sm:flex-none text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    disabled={deleteEvent.isPending}
                  >
                    <Trash2 className="w-4 h-4 mr-2" /> Delete
                  </Button>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      <ManageEventDialog 
        eventId={event.id} 
        isOpen={isEditDialogOpen} 
        onClose={() => setIsEditDialogOpen(false)} 
      />
    </>
  );
}
