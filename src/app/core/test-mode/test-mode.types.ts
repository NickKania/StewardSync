import type { FunctionArgs, FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";
import type { Role, User } from "@core/models";

export const TEST_USERS = {
  driver: "Driver",
  driver_2: "Second driver",
  steward: "Steward",
  steward_2: "Second steward",
  head_steward: "Head steward",
  event_manager: "Event manager",
  league_manager: "League manager",
} as const;

export const TEST_SCENARIOS = {
  baseline: "Baseline",
  review_workflow: "Review workflow",
  race_ban_review: "Race ban review",
} as const;

export type TestUserKey = keyof typeof TEST_USERS;
export type TestScenarioName = keyof typeof TEST_SCENARIOS;
export type TestModeReadiness =
  | "non_loopback_target"
  | "unreachable"
  | "functions_missing"
  | "disabled"
  | "ready";

type TestModeApi = typeof api.testMode;
export type StageScenarioArgs = FunctionArgs<TestModeApi["stageScenario"]>;
export type StagedScenarioManifest = FunctionReturnType<TestModeApi["stageScenario"]>;
export type StageCustomArgs = FunctionArgs<TestModeApi["stageCustom"]>;
export type StageCustomResult = FunctionReturnType<TestModeApi["stageCustom"]>;
export type TestModeState = FunctionReturnType<TestModeApi["getState"]>;
export type ResetArgs = FunctionArgs<TestModeApi["reset"]>;
export type TestModeResetResult = FunctionReturnType<TestModeApi["reset"]>;

export interface LoginAsOptions {
  redirectTo?: string;
  navigate?: boolean;
  ttlSeconds?: number;
}

export interface TestModeLoginResult {
  user: User & { role: Role };
  expiresAt: number;
  expiresInSeconds: number;
}

export interface TestModeBridge {
  getReadiness(timeoutMs?: number): Promise<TestModeReadiness>;
  listTestUsers(): Promise<FunctionReturnType<TestModeApi["listTestUsers"]>>;
  ensureTestUsers(): Promise<FunctionReturnType<TestModeApi["ensureTestUsers"]>>;
  loginAs(roleOrKey: string, options?: LoginAsOptions): Promise<TestModeLoginResult>;
  stageScenario(args: StageScenarioArgs): Promise<StagedScenarioManifest>;
  stageCustom(args: StageCustomArgs): Promise<StageCustomResult>;
  getState(args?: FunctionArgs<TestModeApi["getState"]>): Promise<TestModeState>;
  reset(args?: ResetArgs): Promise<TestModeResetResult>;
}
