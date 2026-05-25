export interface ReportingWindow {
  openTime: Date;
  closeTime: Date;
}

function isSameLocalDate(candidate: Date, eventDate: Date): boolean {
  return (
    candidate.getFullYear() === eventDate.getFullYear() &&
    candidate.getMonth() === eventDate.getMonth() &&
    candidate.getDate() === eventDate.getDate()
  );
}

export function getReportingWindow(
  eventDateValue: number | string | Date,
  reportingOpenTime: string,
  reportingCloseDuration: number,
): ReportingWindow {
  const eventDate = new Date(eventDateValue);
  const [hours, minutes] = reportingOpenTime.split(":").map(Number);
  const year = eventDate.getFullYear();
  const month = eventDate.getMonth();
  const day = eventDate.getDate();

  const candidates = [-1, 0, 1].map(
    (dayOffset) =>
      new Date(Date.UTC(year, month, day + dayOffset, hours, minutes, 0, 0)),
  );
  const openTime =
    candidates.find((candidate) => isSameLocalDate(candidate, eventDate)) ??
    candidates[1];

  const closeTime = new Date(openTime);
  closeTime.setHours(closeTime.getHours() + reportingCloseDuration);

  return { openTime, closeTime };
}
