import { components } from "./_generated/api";
import { ShardedCounter } from "@convex-dev/sharded-counter";

/**
 * Sharded counter for auto-incrementing reportId.
 * Uses 10 shards for high throughput with concurrent report creation.
 */
export const reportCounter = new ShardedCounter(components.shardedCounter, {
  shards: { reportId: 10 },
});
