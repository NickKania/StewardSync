import { APP_INITIALIZER, inject, type EnvironmentProviders, type Provider } from "@angular/core";
import type { Routes } from "@angular/router";
import { TestModeHeaderControlComponent } from "@features/test-mode/test-mode-header-control.component";
import { TestModeService } from "./test-mode.service";

export const IS_LOCAL_TEST_MODE = true;
export const localTestModeRoutes: Routes = [
  {
    path: "test-mode",
    loadComponent: () =>
      import("@features/test-mode/test-mode.component").then((m) => m.TestModeComponent),
  },
];
export const LOCAL_TEST_MODE_HEADER_COMPONENT = TestModeHeaderControlComponent;

export function provideLocalTestMode(): (Provider | EnvironmentProviders)[] {
  return [
    TestModeService,
    {
      provide: APP_INITIALIZER,
      multi: true,
      useFactory: () => {
        const testMode = inject(TestModeService);
        return () => testMode.installBridge();
      },
    },
  ];
}
