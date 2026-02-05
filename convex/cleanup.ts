import { mutation } from "./_generated/server";

export const cleanupDriverClassField = mutation({
  args: {},
  handler: async (ctx) => {
    const drivers = await ctx.db.query("drivers").collect();

    // The driverClass field has been removed from schema
    // Convex will automatically remove it from all documents
    // This function is a no-op but kept for reference

    return { count: drivers.length };
  },
});
