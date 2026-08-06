export type RddFeatureFlags = {
  shell: boolean;
  authEnforcement: boolean;
  ownerMetadata: boolean;
  activityV2: boolean;
  workspaceReadOnly: boolean;
  workspaceEdit: boolean;
};

function enabled(value: string | undefined) {
  return value === "true";
}

export function getRddFeatureFlags(env: NodeJS.ProcessEnv = process.env): RddFeatureFlags {
  return {
    shell: enabled(env.RDD_SHELL_ENABLED),
    authEnforcement: enabled(env.RDD_AUTH_ENFORCEMENT_ENABLED),
    ownerMetadata: enabled(env.RDD_OWNER_METADATA_ENABLED),
    activityV2: enabled(env.RDD_ACTIVITY_V2_ENABLED),
    workspaceReadOnly: enabled(env.RDD_WORKSPACE_READ_ONLY_ENABLED),
    workspaceEdit: enabled(env.RDD_WORKSPACE_EDIT_ENABLED)
  };
}

