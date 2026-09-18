"use server";

import {
  createOrganization,
  getOrganization,
  updateOrganization,
  deleteOrganization,
  listUserOrganizations,
  listMembers,
  updateMemberRole,
  removeMember,
  inviteMember,
  listInvitations,
  revokeInvitation,
} from "./service";
import type { AuthResult, OrgSummary, OrgMember, OrgInvitation, OrgRole } from "./types";

export async function createOrganizationAction(
  name: string
): Promise<AuthResult<OrgSummary>> {
  try {
    const org = await createOrganization(name);
    return { success: true, data: org };
  } catch {
    return { success: false, error: "Could not create the organization" };
  }
}

export async function getOrganizationAction(
  organizationId: string
): Promise<AuthResult<OrgSummary>> {
  const org = await getOrganization(organizationId);
  if (!org) return { success: false, error: "Organization not found" };
  return { success: true, data: org };
}

export async function updateOrganizationAction(
  organizationId: string,
  data: { name?: string; slug?: string }
): Promise<AuthResult<OrgSummary>> {
  try {
    const org = await updateOrganization(organizationId, data);
    return { success: true, data: org };
  } catch {
    return { success: false, error: "Could not update the organization" };
  }
}

export async function deleteOrganizationAction(
  organizationId: string
): Promise<AuthResult> {
  try {
    await deleteOrganization(organizationId);
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: "Could not delete the organization" };
  }
}

export async function listUserOrganizationsAction(): Promise<
  AuthResult<OrgSummary[]>
> {
  const orgs = await listUserOrganizations();
  return { success: true, data: orgs };
}

export async function listMembersAction(
  organizationId: string
): Promise<AuthResult<OrgMember[]>> {
  const members = await listMembers(organizationId);
  return { success: true, data: members };
}

export async function updateMemberRoleAction(
  organizationId: string,
  userId: string,
  role: OrgRole
): Promise<AuthResult> {
  try {
    await updateMemberRole(organizationId, userId, role);
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: "Could not update the member's role" };
  }
}

export async function removeMemberAction(
  organizationId: string,
  userId: string
): Promise<AuthResult> {
  try {
    await removeMember(organizationId, userId);
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: "Could not remove the member" };
  }
}

export async function inviteMemberAction(
  organizationId: string,
  emailAddress: string,
  role: OrgRole
): Promise<AuthResult<OrgInvitation>> {
  try {
    const invitation = await inviteMember(organizationId, emailAddress, role);
    return { success: true, data: invitation };
  } catch {
    return { success: false, error: "Could not send the invitation" };
  }
}

export async function listInvitationsAction(
  organizationId: string
): Promise<AuthResult<OrgInvitation[]>> {
  const invitations = await listInvitations(organizationId);
  return { success: true, data: invitations };
}

/**
 * Revokes a pending invitation (admin-side).
 */
export async function revokeInvitationAction(
  organizationId: string,
  invitationId: string
): Promise<AuthResult> {
  try {
    await revokeInvitation(organizationId, invitationId);
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: "Could not revoke the invitation" };
  }
}
