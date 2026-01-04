"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { Navigation } from "@/components/layout/navigation";
import { format } from "date-fns";

export default function ReviewPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const unfinalizedReports = useQuery(api.queries.getUnfinalizedReports);
  const createReview = useMutation(api.mutations.createReview);
  const userRole = useQuery(api.auth.getUserRole);

  const [selectedReportId, setSelectedReportId] = useState<string>("");
  const [formData, setFormData] = useState({
    incidentDescription: "",
    reviewNotes: "",
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

  if (
    userRole !== "Steward" &&
    userRole !== "Head Steward" &&
    userRole !== "Event Manager" &&
    userRole !== "Admin"
  ) {
    router.push("/dashboard");
    return null;
  }

  const selectedReport = unfinalizedReports?.find((r) => r._id === selectedReportId);
  const reviews = useQuery(api.queries.listReviews, selectedReportId ? { reportId: selectedReportId as any } : undefined);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await createReview({
        reportId: selectedReportId as any,
        incidentDescription: formData.incidentDescription,
        reviewNotes: formData.reviewNotes,
      });
      alert("Review submitted successfully!");
      setFormData({ incidentDescription: "", reviewNotes: "" });
      setSelectedReportId("");
    } catch (error) {
      console.error("Error creating review:", error);
      alert("Failed to submit review. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Review Reports</h1>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Reports List */}
          <Card>
            <CardHeader>
              <CardTitle>Pending Reports</CardTitle>
              <CardDescription>
                Select a report to review
              </CardDescription>
            </CardHeader>
            <CardContent>
              {unfinalizedReports && unfinalizedReports.length > 0 ? (
                <div className="space-y-2">
                  {unfinalizedReports.map((report) => (
                    <button
                      key={report._id}
                      onClick={() => setSelectedReportId(report._id)}
                      className={`w-full text-left p-4 rounded-lg border transition-colors ${
                        selectedReportId === report._id
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-accent"
                      }`}
                    >
                      <div className="font-medium">
                        {report.reportedDriver?.DriverName} reported by{" "}
                        {report.reportingDriver?.DriverName}
                      </div>
                      <div className="text-sm opacity-80">
                        {report.event?.TrackName} - Race {report.race?.RaceNumber} - Turn{" "}
                        {report.Turn}
                      </div>
                      <div className="text-xs opacity-70">
                        {format(report.ReportDate, "PPP p")}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No pending reports to review.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Review Form */}
          {selectedReport && (
            <Card>
              <CardHeader>
                <CardTitle>Review Report</CardTitle>
                <CardDescription>
                  Provide your review of the incident
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 mb-6">
                  <div>
                    <h3 className="font-semibold mb-2">Incident Details</h3>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="font-medium">Reported Driver:</span>{" "}
                        {selectedReport.reportedDriver?.DriverName}
                      </div>
                      <div>
                        <span className="font-medium">Reporting Driver:</span>{" "}
                        {selectedReport.reportingDriver?.DriverName}
                      </div>
                      <div>
                        <span className="font-medium">Event:</span>{" "}
                        {selectedReport.event?.TrackName}
                      </div>
                      <div>
                        <span className="font-medium">Race:</span> Race{" "}
                        {selectedReport.race?.RaceNumber}
                      </div>
                      <div>
                        <span className="font-medium">Turn:</span> {selectedReport.Turn}
                      </div>
                      <div>
                        <span className="font-medium">Original Description:</span>
                        <p className="mt-1 p-2 bg-muted rounded">
                          {selectedReport.Description}
                        </p>
                      </div>
                    </div>
                  </div>

                  {reviews && reviews.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-2">Existing Reviews</h3>
                      <div className="space-y-2">
                        {reviews.map((review) => (
                          <div key={review._id} className="p-3 bg-muted rounded">
                            <div className="font-medium">
                              {review.user?.UserName}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {format(review.ReviewDate, "PPP p")}
                            </div>
                            <p className="text-sm mt-1">
                              {review.IncidentDescription}
                            </p>
                            {review.ReviewNotes && (
                              <p className="text-sm mt-1 italic">
                                Notes: {review.ReviewNotes}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="incidentDescription">
                      Incident Description
                    </Label>
                    <Textarea
                      id="incidentDescription"
                      value={formData.incidentDescription}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          incidentDescription: e.target.value,
                        })
                      }
                      placeholder="Describe the incident as you see it..."
                      rows={4}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reviewNotes">Review Notes</Label>
                    <Textarea
                      id="reviewNotes"
                      value={formData.reviewNotes}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          reviewNotes: e.target.value,
                        })
                      }
                      placeholder="Add any additional notes or observations..."
                      rows={3}
                    />
                  </div>

                  <div className="flex justify-end space-x-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setSelectedReportId("")}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? "Submitting..." : "Submit Review"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
