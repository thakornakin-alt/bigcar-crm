export type RddFeatureFlags = {
  shell: boolean;
  authEnforcement: boolean;
  ownerMetadata: boolean;
  activityV2: boolean;
  workspaceReadOnly: boolean;
  workspaceEdit: boolean;
  commissionPreview: boolean;
  commissionRealWrites: boolean;
};

function enabled(value: string | undefined) {
  return value === "true";
}

function enabledForWorkspacePreview(value: string | undefined, previewEnabled: boolean) {
  if (value !== undefined) return enabled(value);
  return previewEnabled;
}

export function getRddFeatureFlags(env: NodeJS.ProcessEnv = process.env): RddFeatureFlags {
  const previewRef = String(env.VERCEL_GIT_COMMIT_REF || "");
  const workspacePreview = env.VERCEL_ENV === "preview"
    && (previewRef === "codex/workspace-line-tracker"
      || previewRef === "fix/workspace-edit-v2"
      || previewRef === "fix/production-navigation-v2"
      || previewRef === "fix/navigation-cleanup-production"
      || previewRef === "feat/commission-real-data-v1");
  const workspaceProduction = env.VERCEL_ENV === "production";
  return {
    shell: enabledForWorkspacePreview(env.RDD_SHELL_ENABLED, workspacePreview),
    authEnforcement: enabled(env.RDD_AUTH_ENFORCEMENT_ENABLED),
    ownerMetadata: enabled(env.RDD_OWNER_METADATA_ENABLED),
    activityV2: enabled(env.RDD_ACTIVITY_V2_ENABLED),
    workspaceReadOnly: workspaceProduction ? false : enabledForWorkspacePreview(env.RDD_WORKSPACE_READ_ONLY_ENABLED, workspacePreview),
    workspaceEdit: workspaceProduction ? true : enabledForWorkspacePreview(env.RDD_WORKSPACE_EDIT_ENABLED, workspacePreview),
    commissionPreview: workspaceProduction ? true : enabledForWorkspacePreview(env.RDD_COMMISSION_PREVIEW_ENABLED, workspacePreview),
    commissionRealWrites: enabled(env.COMMISSION_REAL_WRITES_ENABLED)
  };
}
