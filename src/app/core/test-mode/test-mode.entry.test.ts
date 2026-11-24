import "@angular/compiler";
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { routes } from "../../app.routes";
import {
  IS_LOCAL_TEST_MODE,
  LOCAL_TEST_MODE_HEADER_COMPONENT,
  localTestModeRoutes,
  provideLocalTestMode,
} from "./test-mode.entry";

interface AssetPattern {
  glob: string;
  input: string;
  output: string;
}

interface BuildConfiguration {
  assets?: (string | AssetPattern)[];
  fileReplacements?: { replace: string; with: string }[];
}

interface WorkspaceConfiguration {
  projects: {
    "steward-sync": {
      architect: {
        build: {
          defaultConfiguration?: string;
          configurations: Record<string, BuildConfiguration>;
        };
        serve: {
          configurations: Record<string, { buildTarget?: string }>;
        };
      };
    };
  };
}

describe("local build isolation", () => {
  test("uses disabled stubs with no local runtime imports", () => {
    expect(IS_LOCAL_TEST_MODE).toBe(false);
    expect(localTestModeRoutes).toEqual([]);
    expect(provideLocalTestMode()).toEqual([]);
    expect(LOCAL_TEST_MODE_HEADER_COMPONENT).toBeNull();
    expect(routes.some((route) => route.path === "test-mode")).toBe(false);

    const source = readFileSync(new URL("./test-mode.entry.ts", import.meta.url), "utf8");
    const runtimeImports = [...source.matchAll(/^import (?!type\b)/gm)];
    expect(runtimeImports).toHaveLength(0);
    expect(source).not.toMatch(/\b(TestModeService|TestModeComponent|TestModeHeaderControlComponent)\b/);
  });

  test("replaces the entry only in local build configurations and isolates test-mode runtime config", () => {
    const path = new URL("../../../../angular.json", import.meta.url);
    const json = JSON.parse(readFileSync(path, "utf8")) as WorkspaceConfiguration;
    const { build, serve } = json.projects["steward-sync"].architect;
    const configs = build.configurations;
    const entry = "src/app/core/test-mode/test-mode.entry.ts";
    const localEntry = "src/app/core/test-mode/test-mode.entry.local.ts";
    const replacements = Object.entries(configs).flatMap(([config, { fileReplacements = [] }]) =>
      fileReplacements.filter(({ replace, with: replacement }) =>
        replace === entry || replacement === localEntry,
      ).map((replacement) => ({ config, ...replacement })),
    );
    expect(replacements).toEqual([
      { config: "local", replace: entry, with: localEntry },
      { config: "test-mode", replace: entry, with: localEntry },
    ]);
    expect(build.defaultConfiguration).toBe("production");
    for (const config of ["local", "test-mode"]) {
      expect(configs[config].fileReplacements).toContainEqual({
        replace: "src/environments/environment.ts",
        with: "src/environments/environment.local.ts",
      });
    }
    expect(configs["test-mode"].assets).toContainEqual({
      glob: "runtime-config.js",
      input: ".convex/test-mode",
      output: "/",
    });
    expect(configs["test-mode"].assets).not.toContainEqual({
      glob: "runtime-config.js",
      input: "src",
      output: "/",
    });
    expect(serve.configurations["test-mode"]).toEqual({ buildTarget: "steward-sync:build:test-mode" });
  });

  test("keys the authenticated app outlet on the session version", () => {
    const file = new URL("../../app.component.ts", import.meta.url);
    expect(readFileSync(file, "utf8")).toMatch(
      /@for \(key of \[authService\.sessionVersion\(\)\]; track key\)\s*\{\s*<router-outlet \/>/,
    );
  });
});
