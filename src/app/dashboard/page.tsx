"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { FileText, FileCheck, Clock, CheckCircle } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";

export default function DashboardPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const reports = useQuery(api.queries.listReports, { limit: 10 });
  const unfinalizedReports = useQuery(api.queries.getUnfinalizedReports);
  const userRole = useQuery(api.auth.getUserRole);

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

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Reports</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reports?.length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{unfinalizedReports?.length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Finalized</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(reports?.filter((r) => r.IsFinalized).length || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Your Role</CardTitle>
            <FileCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userRole || "N/A"}</div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Create Report</CardTitle>
            <CardDescription>
              Report a racing incident for review
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/report">
              <Button className="w-full">
                <FileText className="mr-2 h-4 w-4" />
                New Report
              </Button>
            </Link>
          </CardContent>
        </Card>

        {(userRole === "Steward" ||
          userRole === "Head Steward" ||
          userRole === "Event Manager" ||
          userRole === "Admin") && (
          <Card>
            <CardHeader>
              <CardTitle>Review Reports</CardTitle>
              <CardDescription>
                Review and provide feedback on incident reports
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/review">
                <Button className="w-full" variant="outline">
                  <FileCheck className="mr-2 h-4 w-4" />
                  Review Reports
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {(userRole === "Head Steward" ||
          userRole === "Event Manager" ||
          userRole === "Admin") && (
          <Card>
            <CardHeader>
              <CardTitle>Finalize Reports</CardTitle>
              <CardDescription>
                Finalize reviewed incident reports
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/finalize">
                <Button className="w-full" variant="outline">
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Finalize Reports
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recent Reports */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Reports</CardTitle>
          <CardDescription>
            Latest incident reports submitted to the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          {reports && reports.length > 0 ? (
            <div className="space-y-4">
              {reports.map((report) => (
                <div
                  key={report._id}
                  className="flex items-center justify-between border-b pb-4 last:border-0"
                >
                  <div className="flex-1">
                    <div className="font-medium">
                      {report.reportedDriver?.DriverName} reported by{" "}
                      {report.reportingDriver?.DriverName}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {report.event?.TrackName} - Race {report.race?.RaceNumber} - Turn{" "}
                      {report.Turn}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(report.ReportDate, "PPP p")}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {report.IsFinalized ? (
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                        Finalized
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
                        Pending
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No reports yet. Create your first report to get started.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
