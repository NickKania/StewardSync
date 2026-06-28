import type { Id } from "../_generated/dataModel";

const sameId = (left: unknown, right: unknown): boolean =>
  left != null && right != null && String(left) === String(right);

export const validateAtFaultDriverForReport = async (
  ctx: any,
  report: { eventId: Id<"events"> },
  atFaultDriverId: Id<"drivers"> | undefined,
): Promise<string | null> => {
  if (!atFaultDriverId) {
    return null;
  }

  const [event, driver] = await Promise.all([
    ctx.db.get(report.eventId),
    ctx.db.get(atFaultDriverId),
  ]);

  if (!event) {
    return "Report event not found";
  }

  if (!driver) {
    return "At-fault driver not found";
  }

  if (!sameId(driver.championshipId, event.seriesId)) {
    return "At-fault driver must belong to the report event's series";
  }

  return null;
};
