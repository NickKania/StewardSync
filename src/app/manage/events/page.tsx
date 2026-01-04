"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { Navigation } from "@/components/layout/navigation";
import { format } from "date-fns";
import { Plus, Calendar } from "lucide-react";

export default function ManageEventsPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const events = useQuery(api.queries.listEvents);
  const createEvent = useMutation(api.mutations.createEvent);
  const createRace = useMutation(api.mutations.createRace);
  const userRole = useQuery(api.auth.getUserRole);

  const [isCreating, setIsCreating] = useState(false);
  const [isCreatingRace, setIsCreatingRace] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [formData, setFormData] = useState({
    series: "",
    eventNumber: "",
    trackName: "",
    eventDate: "",
  });
  const [raceFormData, setRaceFormData] = useState({
    raceNumber: "",
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    router.push("/login");
    return null;
  }

  if (
    userRole !== "Head Steward" &&
    userRole !== "Event Manager" &&
    userRole !== "Admin"
  ) {
    router.push("/dashboard");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      await createEvent({
        series: formData.series,
        eventNumber: parseInt(formData.eventNumber),
        trackName: formData.trackName,
        eventDate: new Date(formData.eventDate).getTime(),
      });
      setFormData({ series: "", eventNumber: "", trackName: "", eventDate: "" });
      alert("Event created successfully!");
    } catch (error) {
      console.error("Error creating event:", error);
      alert("Failed to create event. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateRace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventId) {
      alert("Please select an event first");
      return;
    }

    setIsCreatingRace(true);

    try {
      await createRace({
        eventId: selectedEventId as any,
        raceNumber: parseInt(raceFormData.raceNumber),
      });
      setRaceFormData({ raceNumber: "" });
      alert("Race created successfully!");
    } catch (error) {
      console.error("Error creating race:", error);
      alert("Failed to create race. Please try again.");
    } finally {
      setIsCreatingRace(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Manage Events</h1>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Create Event Form */}
          <Card>
            <CardHeader>
              <CardTitle>Add New Event</CardTitle>
              <CardDescription>
                Add a new racing event to the system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="series">Series</Label>
                  <Input
                    id="series"
                    value={formData.series}
                    onChange={(e) =>
                      setFormData({ ...formData, series: e.target.value })
                    }
                    placeholder="Enter series name (e.g., Formula 1)"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="eventNumber">Event Number</Label>
                  <Input
                    id="eventNumber"
                    type="number"
                    value={formData.eventNumber}
                    onChange={(e) =>
                      setFormData({ ...formData, eventNumber: e.target.value })
                    }
                    placeholder="Enter event number"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="trackName">Track Name</Label>
                  <Input
                    id="trackName"
                    value={formData.trackName}
                    onChange={(e) =>
                      setFormData({ ...formData, trackName: e.target.value })
                    }
                    placeholder="Enter track name"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="eventDate">Event Date</Label>
                  <Input
                    id="eventDate"
                    type="date"
                    value={formData.eventDate}
                    onChange={(e) =>
                      setFormData({ ...formData, eventDate: e.target.value })
                    }
                    required
                  />
                </div>

                <Button type="submit" disabled={isCreating} className="w-full">
                  {isCreating ? "Creating..." : "Add Event"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Events List */}
          <Card>
            <CardHeader>
              <CardTitle>All Events</CardTitle>
              <CardDescription>
                List of all events in the system
              </CardDescription>
            </CardHeader>
            <CardContent>
              {events && events.length > 0 ? (
                <div className="space-y-2">
                  {events.map((event) => (
                    <div
                      key={event._id}
                      onClick={() => setSelectedEventId(event._id)}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedEventId === event._id
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-accent"
                      }`}
                    >
                      <div className="font-medium">
                        {event.Series} - Event {event.EventNumber}
                      </div>
                      <div className="text-sm opacity-80">{event.TrackName}</div>
                      <div className="text-xs opacity-70">
                        {format(event.EventDate, "PPP")}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No events in the system yet.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Create Race Form */}
          {selectedEventId && (
            <Card>
              <CardHeader>
                <CardTitle>Add Race to Event</CardTitle>
                <CardDescription>
                  Add a new race to the selected event
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateRace} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="raceNumber">Race Number</Label>
                    <Input
                      id="raceNumber"
                      type="number"
                      value={raceFormData.raceNumber}
                      onChange={(e) =>
                        setRaceFormData({ ...raceFormData, raceNumber: e.target.value })
                      }
                      placeholder="Enter race number"
                      required
                    />
                  </div>

                  <Button type="submit" disabled={isCreatingRace} className="w-full">
                    {isCreatingRace ? "Creating..." : "Add Race"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
