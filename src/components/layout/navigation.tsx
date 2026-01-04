"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { FileText, FileCheck, LayoutDashboard, LogOut, Users, Calendar, Car } from "lucide-react";

export function Navigation() {
  const pathname = usePathname();
  const { user, isAuthenticated } = useAuth();
  const userRole = useQuery(api.auth.getUserRole);

  const handleLogout = () => {
    window.location.href = "/login";
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <nav className="border-b bg-background">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center space-x-6">
            <Link href="/dashboard" className="flex items-center space-x-2">
              <Car className="h-6 w-6" />
              <span className="font-bold text-xl">StewardSync</span>
            </Link>
            <div className="flex items-center space-x-1">
              <Link href="/dashboard">
                <Button
                  variant={pathname === "/dashboard" ? "default" : "ghost"}
                  size="sm"
                >
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  Dashboard
                </Button>
              </Link>
              <Link href="/report">
                <Button
                  variant={pathname === "/report" ? "default" : "ghost"}
                  size="sm"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Report
                </Button>
              </Link>
              {(userRole === "Steward" ||
                userRole === "Head Steward" ||
                userRole === "Event Manager" ||
                userRole === "Admin") && (
                <Link href="/review">
                  <Button
                    variant={pathname === "/review" ? "default" : "ghost"}
                    size="sm"
                  >
                    <FileCheck className="mr-2 h-4 w-4" />
                    Review
                  </Button>
                </Link>
              )}
              {(userRole === "Head Steward" ||
                userRole === "Event Manager" ||
                userRole === "Admin") && (
                <Link href="/finalize">
                  <Button
                    variant={pathname === "/finalize" ? "default" : "ghost"}
                    size="sm"
                  >
                    <FileCheck className="mr-2 h-4 w-4" />
                    Finalize
                  </Button>
                </Link>
              )}
              {(userRole === "Head Steward" ||
                userRole === "Event Manager" ||
                userRole === "Admin") && (
                <>
                  <Link href="/manage/drivers">
                    <Button
                      variant={pathname?.startsWith("/manage/drivers") ? "default" : "ghost"}
                      size="sm"
                    >
                      <Users className="mr-2 h-4 w-4" />
                      Drivers
                    </Button>
                  </Link>
                  <Link href="/manage/events">
                    <Button
                      variant={pathname?.startsWith("/manage/events") ? "default" : "ghost"}
                      size="sm"
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      Events
                    </Button>
                  </Link>
                </>
              )}
              {userRole === "Admin" && (
                <Link href="/manage/users">
                  <Button
                    variant={pathname?.startsWith("/manage/users") ? "default" : "ghost"}
                    size="sm"
                  >
                    <Users className="mr-2 h-4 w-4" />
                    Users
                  </Button>
                </Link>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-muted-foreground">
              {user?.UserName} ({userRole})
            </span>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
