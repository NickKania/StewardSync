"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export function useAuth() {
  const user = useQuery(api.auth.getCurrentUser);
  const isLoading = user === undefined;
  const isAuthenticated = user !== null && user !== undefined;

  return {
    user,
    isLoading,
    isAuthenticated,
  };
}
