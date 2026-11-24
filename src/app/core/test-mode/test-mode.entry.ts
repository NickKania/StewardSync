import type { EnvironmentProviders, Provider, Type } from "@angular/core";
import type { Routes } from "@angular/router";

export const IS_LOCAL_TEST_MODE = false;
export const localTestModeRoutes: Routes = [];
export const LOCAL_TEST_MODE_HEADER_COMPONENT: Type<unknown> | null = null;

export function provideLocalTestMode(): (Provider | EnvironmentProviders)[] {
  return [];
}
