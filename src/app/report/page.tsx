"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { Navigation } from "@/components/layout/navigation";

export default function ReportPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const drivers = useQuery(api.queries.listDrivers);
  const events = useQuery(api.queries.listEvents);
  const createReport = useMutation(api.mutations.createReport);

  const [selectedEvent, setSelectedEvent] = useState<string>("");
  const races = useQuery(api.queries.listRaces, selectedEvent ? { eventId: selectedEvent as any } : undefined);

  const [formData, setFormData] = useState({
    reportingDriverId: "",
    reportedDriverId: "",
    eventId: "",
    raceId: "",
    turn: "",
    description: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await createReport({
        reportingDriverId: formData.reportingDriverId as any,
        reportedDriverId: formData.reportedDriverId as any,
        eventId: formData.eventId as any,
        raceId: formData.raceId as any,
        turn: parseInt(formData.turn),
        description: formData.description,
      });
      router.push("/dashboard");
    } catch (error) {
      console.error("Error creating report:", error);
      alert("Failed to create report. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Create Incident Report</h1>

        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>New Incident Report</CardTitle>
            <CardDescription>
              Fill in the details of the racing incident you want to report
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="reportingDriver">Reporting Driver</Label>
                  <Select
                    value={formData.reportingDriverId}
                    onValueChange={(value) =>
                      setFormData({ ...formData, reportingDriverId: value })
                    }
                  >
                    <SelectTrigger id="reportingDriver">
                      <SelectValue placeholder="Select driver" />
                    </SelectTrigger>
                    <SelectContent>
                      {drivers?.map((driver) => (
                        <SelectItem key={driver._id} value={driver._id}>
                          #{driver.DriverNumber} {driver.DriverName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reportedDriver">Reported Driver</Label>
                  <Select
                    value={formData.reportedDriverId}
                    onValueChange={(value) =>
                      setFormData({ ...formData, reportedDriverId: value })
                    }
                  >
                    <SelectTrigger id="reportedDriver">
                      <SelectValue placeholder="Select driver" />
                    </SelectTrigger>
                    <SelectContent>
                      {drivers?.map((driver) => (
                        <SelectItem key={driver._id} value={driver._id}>
                          #{driver.DriverNumber} {driver.DriverName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="event">Event</Label>
                  <Select
                    value={formData.eventId}
                    onValueChange={(value) => {
                      setFormData({ ...formData, eventId: value });
                      setSelectedEvent(value);
                      setFormData({ ...formData, eventId: value, raceId: "" });
                    }}
                  >
                    <SelectTrigger id="event">
                      <SelectValue placeholder="Select event" />
                    </SelectTrigger>
                    <SelectContent>
                      {events?.map((event) => (
                        <SelectItem key={event._id} value={event._id}>
                          {event.Series} - {event.TrackName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="race">Race</Label>
                  <Select
                    value={formData.raceId}
                    onValueChange={(value) =>
                      setFormData({ ...formData, raceId: value })
                    }
                    disabled={!selectedEvent}
                  >
                    <SelectTrigger id="race">
                      <SelectValue placeholder="Select race" />
                    </SelectTrigger>
                    <SelectContent>
                      {races?.map((race) => (
                        <SelectItem key={race._id} value={race._id}>
                          Race {race.RaceNumber}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="turn">Turn Number</Label>
                <Input
                  id="turn"
                  type="number"
                  value={formData.turn}
                  onChange={(e) =>
                    setFormData({ ...formData, turn: e.target.value })
                  }
                  placeholder="Enter turn number"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Incident Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Describe the incident in detail..."
                  rows={6}
                  required
                />
              </div>

              <div className="flex justify-end space-x-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/dashboard")}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Submitting..." : "Submit Report"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
