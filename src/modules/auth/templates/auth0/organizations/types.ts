/**
 * Types for the Auth0 Organizations/Teams module.
 * Self-contained — does not import from the auth module.
 * Consumers should only import from here, `client.ts`, or `actions.ts`.
 */

export type OrganizationRole = "owner" | "admin" | "member";

export interface Organization {
  id: string;
  name: string;
  displayName: string;
  logoUrl?: string;
  metadata?: Record<string, string>;
}

export interface OrganizationMember {
  userId: string;
  email: string;
  name?: string;
  picture?: string;
  roles: OrganizationRole[];
}

export interface Invitation {
  id: string;
  organizationId: string;
  email: string;
  inviterName: string;
  roles: OrganizationRole[];
  invitationUrl: string;
  expiresAt: string;
}

export interface ActiveOrganization {
  id: string;
  name: string;
  displayName: string;
}

export interface CreateOrganizationInput {
  name: string;
  displayName: string;
  logoUrl?: string;
  metadata?: Record<string, string>;
}

export interface UpdateOrganizationInput {
  displayName?: string;
  logoUrl?: string;
  metadata?: Record<string, string>;
}

export interface InviteMemberInput {
  organizationId: string;
  email: string;
  roles: OrganizationRole[];
  /** Name shown in the invitation email as the inviter. */
  inviterName: string;
}

export type AuthResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: AuthError };

export interface AuthError {
  code: AuthErrorCode;
  message: string;
}

export type AuthErrorCode =
  | "NO_SESSION"
  | "NO_ACTIVE_ORGANIZATION"
  | "NOT_A_MEMBER"
  | "ORGANIZATION_NOT_FOUND"
  | "MANAGEMENT_API_ERROR"
  | "UNKNOWN_ERROR";
