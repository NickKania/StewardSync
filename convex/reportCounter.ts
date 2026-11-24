import { internalMutation } from "./_generated/server";
import { components } from "./_generated/api";
import { ShardedCounter } from "@convex-dev/sharded-counter";

// Sequential IDs require an exact count in the same transaction as the increment.
// count() still sums all stored shards, including those created before this change.
export const reportCounter = new ShardedCounter(components.shardedCounter, {
  shards: { reportId: 1 },
});

// Run once on existing deployments to consolidate the legacy shards without changing the total.
export const rebalanceReportId = internalMutation({
  args: {},
  handler: async (ctx) => {
    await reportCounter.rebalance(ctx, "reportId");
  },
});
