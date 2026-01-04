"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function LoginPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Welcome to StewardSync</CardTitle>
          <CardDescription>
            Sign in to access the racing steward reports system
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            className="w-full"
            onClick={() => {
              window.location.href = `https://auth.convex.dev?provider=google&redirect=${encodeURIComponent(window.location.origin + "/auth/callback")}`;
            }}
          >
            Sign in with Google
          </Button>
          <Button
            className="w-full"
            variant="outline"
            onClick={() => {
              window.location.href = `https://auth.convex.dev?provider=github&redirect=${encodeURIComponent(window.location.origin + "/auth/callback")}`;
            }}
          >
            Sign in with GitHub
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
