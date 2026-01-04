"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { Navigation } from "@/components/layout/navigation";
import { format } from "date-fns";
import { CheckCircle } from "lucide-react";

export default function FinalizePage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const unfinalizedReports = useQuery(api.queries.getUnfinalizedReports);
  const finalizeReport = useMutation(api.mutations.finalizeReport);
  const userRole = useQuery(api.auth.getUserRole);

  const [selectedReportId, setSelectedReportId] = useState<string>("");
  const [isFinalizing, setIsFinalizing] = useState(false);

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

  const selectedReport = unfinalizedReports?.find((r) => r._id === selectedReportId);
  const reviews = useQuery(api.queries.listReviews, selectedReportId ? { reportId: selectedReportId as any } : undefined);

  const handleFinalize = async () => {
    if (!confirm("Are you sure you want to finalize this report? This action cannot be undone.")) {
      return;
    }

    setIsFinalizing(true);

    try {
      await finalizeReport({
        reportId: selectedReportId as any,
      });
      alert("Report finalized successfully!");
      setSelectedReportId("");
    } catch (error) {
      console.error("Error finalizing report:", error);
      alert("Failed to finalize report. Please try again.");
    } finally {
      setIsFinalizing(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Finalize Reports</h1>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Reports List */}
          <Card>
            <CardHeader>
              <CardTitle>Pending Finalization</CardTitle>
              <CardDescription>
                Select a report to finalize
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
                  No reports pending finalization.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Report Details */}
          {selectedReport && (
            <Card>
              <CardHeader>
                <CardTitle>Report Details</CardTitle>
                <CardDescription>
                  Review all information before finalizing
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
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
                        <span className="font-medium">Description:</span>
                        <p className="mt-1 p-2 bg-muted rounded">
                          {selectedReport.Description}
                        </p>
                      </div>
                    </div>
                  </div>

                  {reviews && reviews.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-2">Steward Reviews</h3>
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

                  <div className="pt-4 border-t">
                    <div className="flex items-start space-x-2 text-sm text-muted-foreground">
                      <CheckCircle className="h-5 w-5 mt-0.5 text-green-600" />
                      <p>
                        Finalizing this report will mark it as complete and no further
                        changes will be allowed. Make sure all reviews have been
                        reviewed and all information is accurate.
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-4">
                    <Button
                      variant="outline"
                      onClick={() => setSelectedReportId("")}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleFinalize}
                      disabled={isFinalizing || !reviews || reviews.length === 0}
                    >
                      {isFinalizing ? "Finalizing..." : "Finalize Report"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
