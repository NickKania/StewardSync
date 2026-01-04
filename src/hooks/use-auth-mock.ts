"use client";

import { mockUsers } from "@/lib/mock-data";

export function useAuthMock() {
  // Return the admin user by default for mock mode
  const user = mockUsers[0];
  const isLoading = false;
  const isAuthenticated = true;

  return {
    user,
    isLoading,
    isAuthenticated,
  };
}
