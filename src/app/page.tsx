"use client";

import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Car, FileText, ShieldCheck, Users } from "lucide-react";

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        router.push("/dashboard");
      } else {
        router.push("/login");
      }
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24">
        <div className="text-lg">Loading...</div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4">StewardSync</h1>
          <p className="text-xl text-muted-foreground">
            Unified application for reviewing racing steward reports
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <Car className="h-12 w-12 mb-2 text-primary" />
              <CardTitle>Report Incidents</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Submit racing incident reports for steward review
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <FileText className="h-12 w-12 mb-2 text-primary" />
              <CardTitle>Review Reports</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Stewards can review and provide feedback on incidents
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <ShieldCheck className="h-12 w-12 mb-2 text-primary" />
              <CardTitle>Finalize Reports</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Head stewards finalize reports to close them
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Users className="h-12 w-12 mb-2 text-primary" />
              <CardTitle>Manage Data</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Manage drivers, events, and users in the system
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        <div className="mt-12 text-center">
          <Button
            onClick={() => router.push("/login")}
            className="px-8 py-3 text-lg"
          >
            Get Started
          </Button>
        </div>
      </div>
    </main>
  );
}
