"use server";

import { redirect } from "next/navigation";
import * as service from "./service";
import type {
  ActiveOrganization,
  AuthResult,
  CreateOrganizationInput,
  Invitation,
  InviteMemberInput,
  Organization,
  OrganizationMember,
  OrganizationRole,
  UpdateOrganizationInput,
} from "./types";

/**
 * Public server-side API of the organizations module.
 * Import these from Server Components, Server Actions, and Route Handlers.
 * Do not import `service.ts` directly — it's internal.
 */

export async function createOrganization(input: CreateOrganizationInput): Promise<AuthResult<Organization>> {
  return service.createOrganization(input);
}

export async function getOrganization(organizationId: string): Promise<AuthResult<Organization>> {
  return service.getOrganization(organizationId);
}

export async function updateOrganization(
  organizationId: string,
  input: UpdateOrganizationInput
): Promise<AuthResult<Organization>> {
  return service.updateOrganization(organizationId, input);
}

export async function deleteOrganization(organizationId: string): Promise<AuthResult> {
  return service.deleteOrganization(organizationId);
}

/**
 * Lists the organizations the currently authenticated user belongs to.
 */
export async function listUserOrganizations(): Promise<AuthResult<Organization[]>> {
  const userId = await service.getCurrentUserId();
  if (!userId) return { success: false, error: { code: "NO_SESSION", message: "No active session" } };
  return service.listUserOrganizations(userId);
}

export async function listMembers(organizationId: string): Promise<AuthResult<OrganizationMember[]>> {
  return service.listMembers(organizationId);
}

export async function inviteMember(input: InviteMemberInput): Promise<AuthResult<Invitation>> {
  return service.inviteMember(input);
}

/**
 * Accepting an invitation is normally just following the link from the
 * invitation email, which lands on `/auth/login?organization=...&invitation=...`
 * (mounted by the auth module's proxy). This action exists for a custom
 * "Accept" confirmation screen that redirects into that same flow.
 */
export async function acceptInvitation(organizationId: string, invitationTicket: string) {
  redirect(`/auth/login?organization=${organizationId}&invitation=${invitationTicket}`);
}

/**
 * Declines an invitation by revoking it via the Management API.
 * The invited user never gets a session created, so there's nothing to
 * "undo" beyond removing the pending invitation.
 */
export async function declineInvitation(organizationId: string, invitationId: string): Promise<AuthResult> {
  return service.deleteInvitation(organizationId, invitationId);
}

export async function removeMember(organizationId: string, userId: string): Promise<AuthResult> {
  return service.removeMember(organizationId, userId);
}

export async function changeMemberRole(
  organizationId: string,
  userId: string,
  roles: OrganizationRole[]
): Promise<AuthResult> {
  return service.changeMemberRole(organizationId, userId, roles);
}

/**
 * Reads the active organization from the current session (the `org_id`
 * claim set at login). Returns null if the user isn't scoped to an org.
 */
export async function getActiveOrganization(): Promise<ActiveOrganization | null> {
  return service.getActiveOrganizationFromSession();
}

/**
 * Guard for Server Components that require an active organization.
 * Redirects to an organization picker page if none is set.
 * Adjust `redirectTo` to wherever your app lets the user choose an org.
 */
export async function requireActiveOrganization(redirectTo = "/organizations"): Promise<ActiveOrganization> {
  const active = await service.getActiveOrganizationFromSession();
  if (!active) {
    redirect(redirectTo);
  }
  return active;
}

/**
 * Server-side redirect that re-authenticates the user scoped to a
 * different organization. Auth0 organizations are tied to the tokens
 * issued at login, so switching requires a new login round-trip against
 * that org (usually silent, since the user is already authenticated).
 */
export async function switchActiveOrganizationAction(organizationId: string) {
  redirect(`/auth/login?organization=${organizationId}`);
}
