import assert from "node:assert/strict";
import test from "node:test";
import { getRddFeatureFlags } from "../lib/feature-flags.ts";

test("RDD flags are opt-in and only literal true enables them", () => {
  assert.equal(getRddFeatureFlags({} as unknown as NodeJS.ProcessEnv).shell, false);
  assert.equal(getRddFeatureFlags({ RDD_SHELL_ENABLED: "1" } as unknown as NodeJS.ProcessEnv).shell, false);
  assert.equal(getRddFeatureFlags({ RDD_SHELL_ENABLED: "true" } as unknown as NodeJS.ProcessEnv).shell, true);
});
