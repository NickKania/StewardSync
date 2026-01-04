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
import { Plus, Trash2 } from "lucide-react";

export default function ManageDriversPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const drivers = useQuery(api.queries.listDrivers);
  const createDriver = useMutation(api.mutations.createDriver);
  const userRole = useQuery(api.auth.getUserRole);

  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    driverNumber: "",
    driverName: "",
    externalId: "",
    driverClass: "",
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
      await createDriver({
        driverNumber: parseInt(formData.driverNumber),
        driverName: formData.driverName,
        externalId: formData.externalId,
        driverClass: formData.driverClass,
      });
      setFormData({ driverNumber: "", driverName: "", externalId: "", driverClass: "" });
      alert("Driver created successfully!");
    } catch (error) {
      console.error("Error creating driver:", error);
      alert("Failed to create driver. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Manage Drivers</h1>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Create Driver Form */}
          <Card>
            <CardHeader>
              <CardTitle>Add New Driver</CardTitle>
              <CardDescription>
                Add a new driver to the system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="driverNumber">Driver Number</Label>
                  <Input
                    id="driverNumber"
                    type="number"
                    value={formData.driverNumber}
                    onChange={(e) =>
                      setFormData({ ...formData, driverNumber: e.target.value })
                    }
                    placeholder="Enter driver number"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="driverName">Driver Name</Label>
                  <Input
                    id="driverName"
                    value={formData.driverName}
                    onChange={(e) =>
                      setFormData({ ...formData, driverName: e.target.value })
                    }
                    placeholder="Enter driver name"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="externalId">External ID</Label>
                  <Input
                    id="externalId"
                    value={formData.externalId}
                    onChange={(e) =>
                      setFormData({ ...formData, externalId: e.target.value })
                    }
                    placeholder="Enter external ID"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="driverClass">Driver Class</Label>
                  <Input
                    id="driverClass"
                    value={formData.driverClass}
                    onChange={(e) =>
                      setFormData({ ...formData, driverClass: e.target.value })
                    }
                    placeholder="Enter driver class"
                    required
                  />
                </div>

                <Button type="submit" disabled={isCreating} className="w-full">
                  {isCreating ? "Creating..." : "Add Driver"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Drivers List */}
          <Card>
            <CardHeader>
              <CardTitle>All Drivers</CardTitle>
              <CardDescription>
                List of all drivers in the system
              </CardDescription>
            </CardHeader>
            <CardContent>
              {drivers && drivers.length > 0 ? (
                <div className="space-y-2">
                  {drivers.map((driver) => (
                    <div
                      key={driver._id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div>
                        <div className="font-medium">
                          #{driver.DriverNumber} {driver.DriverName}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {driver.DriverClass} - {driver.ExternalId}
                        </div>
                      </div>
                      <Button variant="ghost" size="icon">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No drivers in the system yet.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
