import React, { useEffect } from "react";
import { 
  useCreateEvent, 
  useUpdateEvent, 
  useGetEvent,
  getGetEventQueryKey,
  getGetBuildingQueryKey,
  getListEventsQueryKey,
  getListBuildingsQueryKey,
  EventInputCategory
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { EventForm, toLocalInput } from "./event-form";
import { useToast } from "@/hooks/use-toast";

interface ManageEventDialogProps {
  eventId?: number | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ManageEventDialog({ eventId, isOpen, onClose }: ManageEventDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: existingEvent, isLoading: isFetching } = useGetEvent(eventId as number, {
    query: {
      queryKey: getGetEventQueryKey(eventId as number),
      enabled: !!eventId && isOpen
    }
  });

  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: getListEventsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListBuildingsQueryKey() });
    if (existingEvent?.buildingId) {
      queryClient.invalidateQueries({ queryKey: getGetBuildingQueryKey(existingEvent.buildingId) });
    }
  };

  const handleSubmit = (data: any) => {
    // ensure dates are properly formatted with timezone info or at least standard ISO
    const payload = {
      ...data,
      startTime: new Date(data.startTime).toISOString(),
      endTime: new Date(data.endTime).toISOString()
    };

    if (eventId) {
      updateEvent.mutate(
        { id: eventId, data: payload },
        {
          onSuccess: () => {
            toast({ title: "Event updated successfully" });
            invalidateQueries();
            onClose();
          },
          onError: (err) => {
            toast({ title: "Error updating event", description: err.message, variant: "destructive" });
          }
        }
      );
    } else {
      createEvent.mutate(
        { data: payload },
        {
          onSuccess: () => {
            toast({ title: "Event created successfully" });
            invalidateQueries();
            onClose();
          },
          onError: (err) => {
            toast({ title: "Error creating event", description: err.message, variant: "destructive" });
          }
        }
      );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{eventId ? "Edit Event" : "Create New Event"}</DialogTitle>
          <DialogDescription>
            {eventId ? "Update the details for this event below." : "Fill out the details to add a new event to the campus map."}
          </DialogDescription>
        </DialogHeader>

        {eventId && isFetching ? (
          <div className="py-8 flex justify-center">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <EventForm 
            initialValues={existingEvent ? {
              title: existingEvent.title,
              organizer: existingEvent.organizer,
              buildingId: existingEvent.buildingId,
              startTime: toLocalInput(new Date(existingEvent.startTime)),
              endTime: toLocalInput(new Date(existingEvent.endTime)),
              description: existingEvent.description ?? undefined,
              registrationLink: existingEvent.registrationLink ?? undefined,
              locationDetails: existingEvent.locationDetails ?? undefined,
              category: existingEvent.category as EventInputCategory
            } : undefined}
            onSubmit={handleSubmit}
            isSubmitting={createEvent.isPending || updateEvent.isPending}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
