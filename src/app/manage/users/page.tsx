"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { Navigation } from "@/components/layout/navigation";
import { Users } from "lucide-react";

export default function ManageUsersPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const users = useQuery(api.queries.listUsers);
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

  if (userRole !== "Admin") {
    router.push("/dashboard");
    return null;
  }

  return (
    <div className="min-h-screen">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Manage Users</h1>

        <Card>
          <CardHeader>
            <CardTitle>All Users</CardTitle>
            <CardDescription>
              List of all users in the system
            </CardDescription>
          </CardHeader>
          <CardContent>
            {users && users.length > 0 ? (
              <div className="space-y-2">
                {users.map((user) => (
                  <div
                    key={user._id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div>
                      <div className="font-medium">{user.UserName}</div>
                      <div className="text-sm text-muted-foreground">
                        {user.email}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Role: {user.role?.RoleName}
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      Edit Role
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>No users in the system yet.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
