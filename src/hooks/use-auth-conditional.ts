// Conditional auth hook that switches between mock and real Convex based on environment

import { mockUsers } from "@/lib/mock-data";

// Mock version
function useAuthMock() {
  const user = mockUsers[0];
  const isLoading = false;
  const isAuthenticated = true;

  return {
    user,
    isLoading,
    isAuthenticated,
  };
}

// Real Convex version
function useAuthReal() {
  const { useQuery } = require("convex/react");
  const { api } = require("@/convex/_generated/api");
  
  const user = useQuery(api.auth.getCurrentUser);
  const isLoading = user === undefined;
  const isAuthenticated = user !== null && user !== undefined;

  return {
    user,
    isLoading,
    isAuthenticated,
  };
}

// Export the appropriate version based on environment
export const useAuth = process.env.NEXT_PUBLIC_MOCK_MODE === "true" 
  ? useAuthMock 
  : useAuthReal;
