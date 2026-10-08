/**
 * Source-specific live use stays disabled until an explicit permission decision
 * is recorded. `conditional` is not treated as approval by this guard.
 */
export type PermissionState = "permitted" | "conditional" | "unclear" | "prohibited";
export type EvidenceActivity = "retrieve" | "display_metadata" | "display_excerpt" | "cache";

export type EvidenceUseGrant = Readonly<Record<EvidenceActivity, PermissionState>>;

export class EvidenceUseNotAuthorizedError extends Error {
  constructor(activity: EvidenceActivity) {
    super(`Job evidence activity is not explicitly authorized: ${activity}`);
    this.name = "EvidenceUseNotAuthorizedError";
  }
}

export function requireEvidencePermission(grant: EvidenceUseGrant, activity: EvidenceActivity): void {
  if (grant[activity] !== "permitted") throw new EvidenceUseNotAuthorizedError(activity);
}

export function mayCacheEvidence(grant: EvidenceUseGrant): boolean {
  return grant.cache === "permitted";
}
