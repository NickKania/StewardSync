// Wrapper hooks for Convex that work in both mock and real modes

import { api as mockApi } from "./mock-api";

// Mock hooks
function useMockQuery<T>(query: any, args?: any): T | undefined {
  const result = query(args);
  return result as T;
}

function useMockMutation(mutation: any) {
  const mutate = async (args: any) => {
    console.log("Mock mutation called:", args);
    const result = mutation(args);
    return result;
  };

  return {
    mutate,
    isLoading: false,
  };
}

// Export based on mode
export const useQuery = process.env.NEXT_PUBLIC_MOCK_MODE === "true"
  ? useMockQuery
  : require("convex/react").useQuery;

export const useMutation = process.env.NEXT_PUBLIC_MOCK_MODE === "true"
  ? useMockMutation
  : require("convex/react").useMutation;

export const api = process.env.NEXT_PUBLIC_MOCK_MODE === "true"
  ? mockApi
  : require("@/convex/_generated/api").api;
