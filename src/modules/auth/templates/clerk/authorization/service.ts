import "server-only";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { OrgRole, Role, Permission } from "./types";

/**
 * Thin authenticated fetch against Clerk's Backend API, for the
 * organization_roles / organization_permissions endpoints (added
 * Nov 2025). Used instead of a clerkClient wrapper because a
 * stable SDK method name for these couldn't be confirmed at the
 * time this was written — see SETUP.md. If a wrapped method exists
 * by the time you read this, swap it in; the request/response
 * shape below should still be a useful reference.
 */
async function clerkApiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`https://api.clerk.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Clerk API error (${res.status}): ${body}`);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

interface RawRole {
  id: string;
  key: string;
  name: string;
  description: string | null;
  permissions?: RawPermission[];
}

interface RawPermission {
  id: string;
  key: string;
  name: string;
  description: string | null;
}

function toRole(raw: RawRole): Role {
  return {
    id: raw.id,
    key: raw.key,
    name: raw.name,
    description: raw.description,
    permissions: raw.permissions?.map(toPermission),
  };
}

function toPermission(raw: RawPermission): Permission {
  return {
    id: raw.id,
    key: raw.key,
    name: raw.name,
    description: raw.description,
  };
}

// ---------- Roles catalog ----------

export async function listRoles(): Promise<Role[]> {
  const { data } = await clerkApiFetch<{ data: RawRole[] }>(
    "/organization_roles"
  );
  return data.map(toRole);
}

export async function getRole(roleId: string): Promise<Role> {
  const role = await clerkApiFetch<RawRole>(`/organization_roles/${roleId}`);
  return toRole(role);
}

export async function createRole(params: {
  name: string;
  key: string; // final key will be "org:<key>"
  description?: string;
}): Promise<Role> {
  const role = await clerkApiFetch<RawRole>("/organization_roles", {
    method: "POST",
    body: JSON.stringify(params),
  });
  return toRole(role);
}

export async function updateRole(
  roleId: string,
  data: { name?: string; description?: string }
): Promise<Role> {
  const role = await clerkApiFetch<RawRole>(`/organization_roles/${roleId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  return toRole(role);
}

/**
 * Deletes a role. Clerk won't let you delete a role that's the
 * Creator role, the Default role, or currently assigned to any
 * member — reassign those first (Dashboard or assignRoleToUser).
 */
export async function deleteRole(roleId: string): Promise<void> {
  await clerkApiFetch(`/organization_roles/${roleId}`, { method: "DELETE" });
}

export async function getRolePermissions(roleId: string): Promise<Permission[]> {
  const role = await getRole(roleId);
  return role.permissions ?? [];
}

// ---------- Permissions catalog ----------

export async function listPermissions(): Promise<Permission[]> {
  const { data } = await clerkApiFetch<{ data: RawPermission[] }>(
    "/organization_permissions"
  );
  return data.map(toPermission);
}

export async function getPermission(permissionId: string): Promise<Permission> {
  const permission = await clerkApiFetch<RawPermission>(
    `/organization_permissions/${permissionId}`
  );
  return toPermission(permission);
}

/**
 * Creates a Custom Permission. Assumes the Feature it's tied to
 * already exists (created in the Dashboard) — this function
 * doesn't manage Features. See SETUP.md.
 */
export async function createPermission(params: {
  name: string;
  key: string; // final key will be "org:<feature>:<key>"
  description?: string;
}): Promise<Permission> {
  const permission = await clerkApiFetch<RawPermission>(
    "/organization_permissions",
    {
      method: "POST",
      body: JSON.stringify(params),
    }
  );
  return toPermission(permission);
}

export async function updatePermission(
  permissionId: string,
  data: { name?: string; description?: string }
): Promise<Permission> {
  const permission = await clerkApiFetch<RawPermission>(
    `/organization_permissions/${permissionId}`,
    {
      method: "PATCH",
      body: JSON.stringify(data),
    }
  );
  return toPermission(permission);
}

export async function deletePermission(permissionId: string): Promise<void> {
  await clerkApiFetch(`/organization_permissions/${permissionId}`, {
    method: "DELETE",
  });
}

export async function assignPermissionToRole(
  roleId: string,
  permissionId: string
): Promise<void> {
  await clerkApiFetch(
    `/organization_roles/${roleId}/permissions/${permissionId}`,
    { method: "POST" }
  );
}

export async function removePermissionFromRole(
  roleId: string,
  permissionId: string
): Promise<void> {
  await clerkApiFetch(
    `/organization_roles/${roleId}/permissions/${permissionId}`,
    { method: "DELETE" }
  );
}

// ---------- User ↔ role/permission ----------

/**
 * Gets a user's role within an organization. Self-contained: reads
 * the membership list directly instead of importing from
 * lib/organizations.
 */
export async function getUserRole(
  organizationId: string,
  userId: string
): Promise<OrgRole | null> {
  const client = await clerkClient();
  const { data } = await client.organizations.getOrganizationMembershipList({
    organizationId,
  });
  const membership = data.find((m) => m.publicUserData?.userId === userId);
  return (membership?.role as OrgRole) ?? null;
}

/**
 * Gets the permissions attached to a user's role in an
 * organization. Depends on getRolePermissions() returning embedded
 * permissions — see the note on Role.permissions in types.ts.
 */
export async function getUserPermissions(
  organizationId: string,
  userId: string
): Promise<Permission[]> {
  const role = await getUserRole(organizationId, userId);
  if (!role) return [];

  const roles = await listRoles();
  const match = roles.find((r) => r.key === role);
  return match?.permissions ?? [];
}

/**
 * Assigns a role to a user within an organization. Self-contained:
 * calls clerkClient directly instead of importing from
 * lib/organizations, even though it's the same underlying call.
 */
export async function assignRoleToUser(
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
 * Removes a user's role. Clerk doesn't have a "no role" membership
 * state, so in practice this removes the user from the
 * organization entirely.
 */
export async function removeRoleFromUser(
  organizationId: string,
  userId: string
): Promise<void> {
  const client = await clerkClient();
  await client.organizations.deleteOrganizationMembership({
    organizationId,
    userId,
  });
}

// ---------- Authorization checks ----------

/**
 * Role check — reliable server-side, the role IS in the session
 * token.
 */
export async function checkRole(role: OrgRole): Promise<boolean> {
  const { has } = await auth();
  return has({ role });
}

/**
 * Permission check. Works reliably server-side for Custom
 * Permissions. System Permissions (org:sys_*) are NOT included in
 * the session token per Clerk's own docs — don't rely on this for
 * org:sys_* checks server-side.
 */
export async function checkPermission(permission: string): Promise<boolean> {
  const { has } = await auth();
  return has({ permission });
}

/**
 * Route/Server Component/Server Action authorization: redirects if
 * the current user doesn't hold the given role.
 */
export async function requireOrgRole(
  role: OrgRole,
  redirectTo = "/"
): Promise<void> {
  const ok = await checkRole(role);
  if (!ok) redirect(redirectTo);
}

/**
 * Same as requireOrgRole but for a permission.
 */
export async function requireOrgPermission(
  permission: string,
  redirectTo = "/"
): Promise<void> {
  const ok = await checkPermission(permission);
  if (!ok) redirect(redirectTo);
}
