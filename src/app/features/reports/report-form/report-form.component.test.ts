import "@angular/compiler";
import { Injector, runInInjectionContext } from "@angular/core";
import { FormBuilder } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { afterEach, describe, expect, it, mock, setSystemTime } from "bun:test";

import { AuthService } from "@core/services/auth.service";
import { ConvexService } from "@core/services/convex.service";
import { ToastService } from "@core/services/toast.service";
import { ReportFormComponent } from "./report-form.component";

const event = {
  eventDate: "2026-03-10T12:00:00.000Z",
  series: {
    isReportingLocked: false,
    reportingOpenTime: "14:00",
    reportingCloseDuration: 24,
  },
};

function createReportForm() {
  const update = mock(async () => "report1");
  const injector = Injector.create({
    providers: [
      { provide: FormBuilder, useValue: new FormBuilder() },
      {
        provide: ConvexService,
        useValue: { api: { reports: { update: "reports:update" } }, mutation: update },
      },
      { provide: AuthService, useValue: { getUserId: () => "user1" } },
      { provide: ToastService, useValue: { success: mock(), error: mock() } },
      { provide: Router, useValue: { navigate: mock() } },
      { provide: ActivatedRoute, useValue: {} },
    ],
  });
  const component = runInInjectionContext(injector, () => new ReportFormComponent());
  return { component, update };
}

describe("ReportFormComponent", () => {
  afterEach(() => setSystemTime());

  it("allows reporting when no event is selected", () => {
    const { component } = createReportForm();
    expect(component.isReportingOpen()).toBe(true);
    expect(component.reportingStatusMessage()).toBe("");
  });

  it("blocks reporting when the series is locked", () => {
    const { component } = createReportForm();
    component.selectedEvent.set({
      ...event,
      series: { ...event.series, isReportingLocked: true },
    });
    expect(component.isReportingOpen()).toBe(false);
    expect(component.reportingStatusMessage()).toBe("Reports have been locked for this series");
  });

  it.each<[string, string | null, number | null]>([
    ["missing reporting window", null, null],
    ["missing opening time", null, 24],
    ["zero duration", "14:00", 0],
  ])("allows reporting with %s", (_label, reportingOpenTime, reportingCloseDuration) => {
    const { component } = createReportForm();
    component.selectedEvent.set({
      ...event,
      series: { ...event.series, reportingOpenTime, reportingCloseDuration },
    });
    expect(component.isReportingOpen()).toBe(true);
    expect(component.reportingStatusMessage()).toBe("");
  });

  it.each<[string, string, number, boolean, string]>([
    ["before opening", "2026-03-10T13:00:00.000Z", 24, false, "Reporting opens at"],
    ["during the window", "2026-03-10T15:00:00.000Z", 24, true, ""],
    ["after closing", "2026-03-11T15:00:00.000Z", 24, false, "Reporting closed at"],
    ["after a one-hour window", "2026-03-10T15:30:00.000Z", 1, false, "Reporting closed at"],
  ])("checks reporting %s", (_label, now, reportingCloseDuration, open, message) => {
    setSystemTime(new Date(now));
    const { component } = createReportForm();
    component.selectedEvent.set({
      ...event,
      series: { ...event.series, reportingCloseDuration },
    });
    expect(component.isReportingOpen()).toBe(open);
    const status = component.reportingStatusMessage();
    if (message) {
      expect(status.startsWith(message)).toBe(true);
    } else {
      expect(status).toBe("");
    }
  });

  it("includes the reported driver when updating a report", async () => {
    const { component, update } = createReportForm();
    component.id = "report1";
    component.isEdit = true;
    component.form.setValue({
      seriesId: "series1",
      reportedDriverId: "driver2",
      eventId: "event1",
      raceId: "race1",
      lap: "3",
      turn: "2-3",
      description: "Updated incident description text",
      videoLink: "",
      videoTimestamp: "",
      createAnother: false,
    });

    await component.onSubmit();

    expect(update).toHaveBeenCalledWith(
      "reports:update",
      expect.objectContaining({ currentUserId: "user1", reportedDriverId: "driver2" }),
    );
  });
});
