// Conditional Convex client based on MOCK_MODE environment variable

import { ConvexReactClient } from "convex/react";

// Only create real Convex client if not in mock mode
const convex = process.env.NEXT_PUBLIC_MOCK_MODE === "true" 
  ? null
  : new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export { convex };
