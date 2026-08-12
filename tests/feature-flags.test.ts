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
