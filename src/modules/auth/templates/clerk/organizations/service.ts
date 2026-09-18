import "server-only";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { OrgSummary, OrgMember, OrgInvitation, OrgRole } from "./types";

function toOrgSummary(org: {
  id: string;
  name: string;
  slug: string | null;
  imageUrl: string;
  membersCount?: number | null;
  createdAt: number;
}): OrgSummary {
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    imageUrl: org.imageUrl,
    membersCount: org.membersCount ?? 0,
    createdAt: new Date(org.createdAt),
  };
}

/**
 * Creates a new organization. The signed-in user becomes its
 * creator (gets the Dashboard-configured "Creator role", org:admin
 * by default).
 */
export async function createOrganization(name: string): Promise<OrgSummary> {
  const { userId } = await auth();
  if (!userId) throw new Error("Not signed in");

  const client = await clerkClient();
  const org = await client.organizations.createOrganization({
    name,
    createdBy: userId,
  });

  return toOrgSummary(org);
}

/**
 * Gets an organization by id.
 */
export async function getOrganization(
  organizationId: string
): Promise<OrgSummary | null> {
  const client = await clerkClient();
  const org = await client.organizations.getOrganization({ organizationId });
  if (!org) return null;
  return toOrgSummary(org);
}

/**
 * Gets the currently active organization (from the session),
 * or null if the user has no active org.
 */
export async function getActiveOrganization(): Promise<OrgSummary | null> {
  const { orgId } = await auth();
  if (!orgId) return null;
  return getOrganization(orgId);
}

/**
 * Updates an organization. Metadata fields REPLACE rather than
 * merge on Clerk's side — read the org first if you need to patch
 * a single metadata field instead of overwriting all of it.
 */
export async function updateOrganization(
  organizationId: string,
  data: { name?: string; slug?: string }
): Promise<OrgSummary> {
  const client = await clerkClient();
  const org = await client.organizations.updateOrganization(
    organizationId,
    data
  );
  return toOrgSummary(org);
}

/**
 * Deletes an organization. Only admins can do this on Clerk's side;
 * this also deletes all its memberships and invitations.
 */
export async function deleteOrganization(
  organizationId: string
): Promise<void> {
  const client = await clerkClient();
  await client.organizations.deleteOrganization(organizationId);
}

/**
 * Lists every organization the given user belongs to.
 * Defaults to the current signed-in user.
 */
export async function listUserOrganizations(
  userId?: string
): Promise<OrgSummary[]> {
  const { userId: currentUserId } = await auth();
  const targetUserId = userId ?? currentUserId;
  if (!targetUserId) return [];

  const client = await clerkClient();
  const { data } = await client.users.getOrganizationMembershipList({
    userId: targetUserId,
  });

  return data.map((membership) => toOrgSummary(membership.organization));
}

/**
 * Lists the members of an organization.
 */
export async function listMembers(
  organizationId: string
): Promise<OrgMember[]> {
  const client = await clerkClient();
  const { data } = await client.organizations.getOrganizationMembershipList({
    organizationId,
  });

  return data.map((membership) => ({
    userId: membership.publicUserData?.userId ?? "",
    organizationId,
    role: membership.role as OrgRole,
    identifier: membership.publicUserData?.identifier ?? "",
    imageUrl: membership.publicUserData?.imageUrl ?? "",
  }));
}

/**
 * Changes a member's role within an organization.
 */
export async function updateMemberRole(
  organizationId: string,
  userId: string,
  role: OrgRole
): Promise<void> {
  const client = await clerkClient();
  await client.organizations.updateOrganizationMembership({
    organizationId,
    userId,
    role,
  });
}

/**
 * Removes a member from an organization.
 */
export async function removeMember(
  organizationId: string,
  userId: string
): Promise<void> {
  const client = await clerkClient();
  await client.organizations.deleteOrganizationMembership({
    organizationId,
    userId,
  });
}

/**
 * Invites a user to an organization by email. Requires the caller
 * to hold the org:sys_memberships:manage system permission.
 */
export async function inviteMember(
  organizationId: string,
  emailAddress: string,
  role: OrgRole
): Promise<OrgInvitation> {
  const { userId, has } = await auth();
  if (!userId) throw new Error("Not signed in");
  if (!has({ permission: "org:sys_memberships:manage" })) {
    throw new Error("Not authorized to invite members");
  }

  const client = await clerkClient();
  const invitation = await client.organizations.createOrganizationInvitation({
    organizationId,
    inviterUserId: userId,
    emailAddress,
    role,
  });

  return {
    id: invitation.id,
    organizationId,
    emailAddress: invitation.emailAddress,
    role: invitation.role as OrgRole,
    status: invitation.status as OrgInvitation["status"],
    createdAt: new Date(invitation.createdAt),
  };
}

/**
 * Lists an organization's invitations (defaults to pending ones).
 */
export async function listInvitations(
  organizationId: string
): Promise<OrgInvitation[]> {
  const client = await clerkClient();
  const { data } = await client.organizations.getOrganizationInvitationList({
    organizationId,
  });

  return data.map((invitation) => ({
    id: invitation.id,
    organizationId,
    emailAddress: invitation.emailAddress,
    role: invitation.role as OrgRole,
    status: invitation.status as OrgInvitation["status"],
    createdAt: new Date(invitation.createdAt),
  }));
}

/**
 * Revokes a pending invitation (admin-side).
 */
export async function revokeInvitation(
  organizationId: string,
  invitationId: string
): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("Not signed in");

  const client = await clerkClient();
  await client.organizations.revokeOrganizationInvitation({
    organizationId,
    invitationId,
    requestingUserId: userId,
  });
}

/**
 * Quick role check against the active organization.
 */
export async function hasOrgRole(role: OrgRole): Promise<boolean> {
  const { has } = await auth();
  return has({ role });
}

/**
 * Quick permission check against the active organization.
 * Use canonical org:sys_* system permission names — see SETUP.md.
 */
export async function hasOrgPermission(permission: string): Promise<boolean> {
  const { has } = await auth();
  return has({ permission });
}

/**
 * Returns the active organization or redirects if there isn't one.
 * Use at the top of any Server Component/Server Action that
 * requires an active organization.
 */
export async function requireOrganization(): Promise<OrgSummary> {
  const org = await getActiveOrganization();
  if (!org) redirect("/dashboard");
  return org;
}

/**
 * Returns the active organization or redirects if the current user
 * doesn't hold the given role in it.
 */
export async function requireOrgRole(role: OrgRole): Promise<OrgSummary> {
  const org = await requireOrganization();
  const ok = await hasOrgRole(role);
  if (!ok) redirect(`/orgs/${org.slug ?? org.id}`);
  return org;
}
