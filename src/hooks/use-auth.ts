"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { mockUsers } from "@/lib/mock-data";

export function useAuth() {
  // Check if we're in mock mode
  const isMockMode = process.env.NEXT_PUBLIC_MOCK_MODE === "true";

  if (isMockMode) {
    // Return mock data
    const user = mockUsers[0];
    const isLoading = false;
    const isAuthenticated = true;

    return {
      user,
      isLoading,
      isAuthenticated,
    };
  }

  // Use real Convex auth
  const user = useQuery(api.auth.getCurrentUser);
  const isLoading = user === undefined;
  const isAuthenticated = user !== null && user !== undefined;

  return {
    user,
    isLoading,
    isAuthenticated,
  };
}
