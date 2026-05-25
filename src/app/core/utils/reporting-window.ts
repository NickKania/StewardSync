export interface ReportingWindow {
  openTime: Date;
  closeTime: Date;
}

export function getReportingWindow(
  eventDateValue: number | string | Date,
  reportingOpenTime: string,
  reportingCloseDuration: number,
): ReportingWindow {
  const eventDate = new Date(eventDateValue);
  const [hours, minutes] = reportingOpenTime.split(":").map(Number);
  const utcYear = eventDate.getUTCFullYear();
  const utcMonth = eventDate.getUTCMonth();
  const utcDay = eventDate.getUTCDate();
  const utcDateStart = Date.UTC(utcYear, utcMonth, utcDay);
  const offsetFromUtcDateStart = eventDate.getTime() - utcDateStart;
  const dayMs = 24 * 60 * 60 * 1000;
  const eventTimezoneOffset =
    offsetFromUtcDateStart > dayMs / 2
      ? offsetFromUtcDateStart - dayMs
      : offsetFromUtcDateStart;
  const eventLocalDateStart = eventDate.getTime() - eventTimezoneOffset;
  const eventLocalDate = new Date(eventLocalDateStart);
  const eventYear = eventLocalDate.getUTCFullYear();
  const eventMonth = eventLocalDate.getUTCMonth();
  const eventDay = eventLocalDate.getUTCDate();

  const candidates = [-1, 0, 1].map(
    (dayOffset) =>
      new Date(
        Date.UTC(
          eventYear,
          eventMonth,
          eventDay + dayOffset,
          hours,
          minutes,
          0,
          0,
        ),
      ),
  );
  const openTime =
    candidates.find((candidate) => {
      const shiftedCandidate = new Date(
        candidate.getTime() - eventTimezoneOffset,
      );
      return (
        shiftedCandidate.getUTCFullYear() === eventYear &&
        shiftedCandidate.getUTCMonth() === eventMonth &&
        shiftedCandidate.getUTCDate() === eventDay
      );
    }) ?? candidates[1];

  const closeTime = new Date(
    openTime.getTime() + reportingCloseDuration * 60 * 60 * 1000,
  );

  return { openTime, closeTime };
}
