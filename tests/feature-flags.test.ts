import assert from "node:assert/strict";
import test from "node:test";
import { getRddFeatureFlags } from "../lib/feature-flags.ts";

test("RDD flags are opt-in and only literal true enables them", () => {
  assert.equal(getRddFeatureFlags({} as unknown as NodeJS.ProcessEnv).shell, false);
  assert.equal(getRddFeatureFlags({ RDD_SHELL_ENABLED: "1" } as unknown as NodeJS.ProcessEnv).shell, false);
  assert.equal(getRddFeatureFlags({ RDD_SHELL_ENABLED: "true" } as unknown as NodeJS.ProcessEnv).shell, true);
  assert.equal(getRddFeatureFlags({} as unknown as NodeJS.ProcessEnv).workspaceReadOnly, false);
  assert.equal(getRddFeatureFlags({ RDD_WORKSPACE_READ_ONLY_ENABLED: "true" } as unknown as NodeJS.ProcessEnv).workspaceReadOnly, true);
  assert.equal(getRddFeatureFlags({ RDD_WORKSPACE_EDIT_ENABLED: "true" } as unknown as NodeJS.ProcessEnv).workspaceEdit, true);
  assert.equal(getRddFeatureFlags({} as unknown as NodeJS.ProcessEnv).commissionPreview, false);
  assert.equal(getRddFeatureFlags({ RDD_COMMISSION_PREVIEW_ENABLED: "true" } as unknown as NodeJS.ProcessEnv).commissionPreview, true);
  assert.equal(getRddFeatureFlags({} as unknown as NodeJS.ProcessEnv).commissionRealWrites, false);
  assert.equal(getRddFeatureFlags({ COMMISSION_REAL_WRITES_ENABLED: "true" } as unknown as NodeJS.ProcessEnv).commissionRealWrites, true);
});

test("workspace tracker preview enables its shell and controlled editing without changing production defaults", () => {
  const preview = getRddFeatureFlags({
    VERCEL_ENV: "preview",
    VERCEL_GIT_COMMIT_REF: "codex/workspace-line-tracker"
  } as unknown as NodeJS.ProcessEnv);
  assert.equal(preview.shell, true);
  assert.equal(preview.workspaceReadOnly, true);
  assert.equal(preview.workspaceEdit, true);

  const production = getRddFeatureFlags({
    VERCEL_ENV: "production",
    VERCEL_GIT_COMMIT_REF: "codex/workspace-line-tracker"
  } as unknown as NodeJS.ProcessEnv);
  assert.equal(production.shell, false);
  assert.equal(production.workspaceReadOnly, false);
  assert.equal(production.workspaceEdit, false);

  const explicitlyDisabled = getRddFeatureFlags({
    VERCEL_ENV: "preview",
    VERCEL_GIT_COMMIT_REF: "codex/workspace-line-tracker",
    RDD_WORKSPACE_EDIT_ENABLED: "false"
  } as unknown as NodeJS.ProcessEnv);
  assert.equal(explicitlyDisabled.workspaceEdit, false);
});
