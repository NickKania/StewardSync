import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ReactiveFormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { of } from "rxjs";

import { ReportFormComponent } from "./report-form.component";
import { ConvexService } from "@core/services/convex.service";
import { ToastService } from "@core/services/toast.service";
import { AuthService } from "@core/services/auth.service";

describe("ReportFormComponent", () => {
  let component: ReportFormComponent;
  let fixture: ComponentFixture<ReportFormComponent>;
  let mockConvexService: jasmine.SpyObj<ConvexService>;
  let mockAuthService: jasmine.SpyObj<AuthService>;
  let mockRouter: jasmine.SpyObj<Router>;
  let mockToastService: jasmine.SpyObj<ToastService>;

  const mockSeries = [
    {
      _id: "series1",
      name: "Test Series",
      isReportingLocked: false,
      reportingOpenTime: "14:00",
      reportingCloseDuration: 24, // 24 hours
      requireVideoEvidence: false,
    },
  ];

  const mockEvent = {
    _id: "event1",
    eventDate: "2026-03-10T12:00:00.000Z",
    trackName: "Test Track",
    eventNumber: 1,
    seriesId: "series1",
    series: mockSeries[0],
  };

  beforeEach(async () => {
    mockConvexService = jasmine.createSpyObj("ConvexService", [
      "query",
      "mutation",
      "createReactiveQuery",
    ]);
    mockAuthService = jasmine.createSpyObj("AuthService", [
      "getUserId",
      "user",
    ]);
    mockRouter = jasmine.createSpyObj("Router", ["navigate"]);
    mockToastService = jasmine.createSpyObj("ToastService", [
      "success",
      "error",
      "warning",
    ]);

    mockAuthService.getUserId.and.returnValue("user1");
    mockAuthService.user.and.returnValue({ name: "Test User" });

    await TestBed.configureTestingModule({
      imports: [ReactiveFormsModule, ReportFormComponent],
      providers: [
        { provide: ConvexService, useValue: mockConvexService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
        { provide: ToastService, useValue: mockToastService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ReportFormComponent);
    component = fixture.componentInstance;
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  describe("isReportingOpen", () => {
    it("should return true when no event is selected", () => {
      component.selectedEvent.set(null);
      fixture.detectChanges();

      expect(component.isReportingOpen()).toBe(true);
    });

    it("should return false when series is locked", () => {
      const lockedSeriesEvent = {
        ...mockEvent,
        series: { ...mockSeries[0], isReportingLocked: true },
      };
      component.selectedEvent.set(lockedSeriesEvent);
      fixture.detectChanges();

      expect(component.isReportingOpen()).toBe(false);
    });

    it("should return true when reporting window is not configured", () => {
      const noConfigEvent = {
        ...mockEvent,
        series: {
          ...mockSeries[0],
          reportingOpenTime: null,
          reportingCloseDuration: null,
        },
      };
      component.selectedEvent.set(noConfigEvent);
      fixture.detectChanges();

      expect(component.isReportingOpen()).toBe(true);
    });

    it("should return false when reporting window has closed", () => {
      // Event date is 2026-03-10T12:00:00.000Z
      // Reporting opens at 14:00 UTC on 2026-03-10
      // Reporting closes 24 hours after open time = 2026-03-11T14:00:00.000Z
      // Current time is 2026-03-11T15:00:00.000Z (after close time)
      spyOn(window, "Date").and.returnValue({
        prototype: Date.prototype,
        now: () => new Date("2026-03-11T15:00:00.000Z").getTime(),
      } as any);

      component.selectedEvent.set(mockEvent);
      fixture.detectChanges();

      expect(component.isReportingOpen()).toBe(false);
    });

    it("should return true when within reporting window", () => {
      // Event date is 2026-03-10T12:00:00.000Z
      // Reporting opens at 14:00 UTC on 2026-03-10
      // Current time is 2026-03-10T15:00:00.000Z (within window)
      spyOn(window, "Date").and.returnValue({
        prototype: Date.prototype,
        now: () => new Date("2026-03-10T15:00:00.000Z").getTime(),
      } as any);

      component.selectedEvent.set(mockEvent);
      fixture.detectChanges();

      expect(component.isReportingOpen()).toBe(true);
    });

    it("should return false when before reporting window opens", () => {
      // Event date is 2026-03-10T12:00:00.000Z
      // Reporting opens at 14:00 UTC on 2026-03-10
      // Current time is 2026-03-10T13:00:00.000Z (before open)
      spyOn(window, "Date").and.returnValue({
        prototype: Date.prototype,
        now: () => new Date("2026-03-10T13:00:00.000Z").getTime(),
      } as any);

      component.selectedEvent.set(mockEvent);
      fixture.detectChanges();

      expect(component.isReportingOpen()).toBe(false);
    });
  });

  describe("reportingStatusMessage", () => {
    it("should return empty string when no event is selected", () => {
      component.selectedEvent.set(null);
      fixture.detectChanges();

      expect(component.reportingStatusMessage()).toBe("");
    });

    it("should return locked message when series is locked", () => {
      const lockedSeriesEvent = {
        ...mockEvent,
        series: { ...mockSeries[0], isReportingLocked: true },
      };
      component.selectedEvent.set(lockedSeriesEvent);
      fixture.detectChanges();

      expect(component.reportingStatusMessage()).toBe(
        "Reports have been locked for this series"
      );
    });

    it("should return empty string when reporting window is not configured", () => {
      const noConfigEvent = {
        ...mockEvent,
        series: {
          ...mockSeries[0],
          reportingOpenTime: null,
          reportingCloseDuration: null,
        },
      };
      component.selectedEvent.set(noConfigEvent);
      fixture.detectChanges();

      expect(component.reportingStatusMessage()).toBe("");
    });

    it("should return closed message when reporting window has closed", () => {
      spyOn(window, "Date").and.returnValue({
        prototype: Date.prototype,
        now: () => new Date("2026-03-11T15:00:00.000Z").getTime(),
      } as any);

      component.selectedEvent.set(mockEvent);
      fixture.detectChanges();

      expect(component.reportingStatusMessage()).toContain(
        "Reporting closed at"
      );
    });

    it("should return opens message when before reporting window", () => {
      spyOn(window, "Date").and.returnValue({
        prototype: Date.prototype,
        now: () => new Date("2026-03-10T13:00:00.000Z").getTime(),
      } as any);

      component.selectedEvent.set(mockEvent);
      fixture.detectChanges();

      expect(component.reportingStatusMessage()).toContain(
        "Reporting opens at"
      );
    });

    it("should return empty string when within reporting window", () => {
      spyOn(window, "Date").and.returnValue({
        prototype: Date.prototype,
        now: () => new Date("2026-03-10T15:00:00.000Z").getTime(),
      } as any);

      component.selectedEvent.set(mockEvent);
      fixture.detectChanges();

      expect(component.reportingStatusMessage()).toBe("");
    });
  });

  describe("edge cases", () => {
    it("should handle 1 hour close duration", () => {
      const oneHourEvent = {
        ...mockEvent,
        series: { ...mockSeries[0], reportingCloseDuration: 1 }, // 1 hour
      };

      // Current time is 2026-03-10T15:30:00.000Z (after 1 hour window)
      spyOn(window, "Date").and.returnValue({
        prototype: Date.prototype,
        now: () => new Date("2026-03-10T15:30:00.000Z").getTime(),
      } as any);

      component.selectedEvent.set(oneHourEvent);
      fixture.detectChanges();

      expect(component.isReportingOpen()).toBe(false);
      expect(component.reportingStatusMessage()).toContain("Reporting closed at");
    });

    it("should handle null reportingOpenTime with closeDuration set", () => {
      const nullOpenTimeEvent = {
        ...mockEvent,
        series: {
          ...mockSeries[0],
          reportingOpenTime: null,
          reportingCloseDuration: 1440,
        },
      };

      component.selectedEvent.set(nullOpenTimeEvent);
      fixture.detectChanges();

      // Should allow reporting when openTime is not set
      expect(component.isReportingOpen()).toBe(true);
    });

    it("should handle zero closeDuration", () => {
      const zeroDurationEvent = {
        ...mockEvent,
        series: { ...mockSeries[0], reportingCloseDuration: 0 },
      };

      // Current time is 2026-03-10T14:01:00.000Z (1 minute after open)
      spyOn(window, "Date").and.returnValue({
        prototype: Date.prototype,
        now: () => new Date("2026-03-10T14:01:00.000Z").getTime(),
      } as any);

      component.selectedEvent.set(zeroDurationEvent);
      fixture.detectChanges();

      // With 0 duration, window closes immediately after opening
      expect(component.isReportingOpen()).toBe(false);
    });
  });
});
