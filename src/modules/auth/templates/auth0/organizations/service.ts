import "server-only";
import { Auth0Client } from "@auth0/nextjs-auth0/server";
import type {
  ActiveOrganization,
  AuthError,
  AuthErrorCode,
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
 * INTERNAL MODULE — do not import this file from outside this folder.
 * Consumers should use `actions.ts` (server) or `client.ts` (client) instead.
 *
 * This module is self-contained: it instantiates its own Auth0Client to
 * read the session (same cookie/secret as the auth module, if present in
 * the same project) and talks to the Auth0 Management API directly for
 * everything Organizations-related.
 */

const auth0 = new Auth0Client();

// --- Management API token -------------------------------------------------

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getManagementApiToken(): Promise<AuthResult<string>> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 5_000) {
    return { success: true, data: cachedToken.value };
  }

  try {
    const res = await fetch(`https://${requireEnv("AUTH0_DOMAIN")}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: requireEnv("AUTH0_M2M_CLIENT_ID"),
        client_secret: requireEnv("AUTH0_M2M_CLIENT_SECRET"),
        audience: `https://${requireEnv("AUTH0_DOMAIN")}/api/v2/`,
      }),
    });
    if (!res.ok) return err("MANAGEMENT_API_ERROR", `Token request failed with ${res.status}`);

    const json = (await res.json()) as { access_token: string; expires_in: number };
    cachedToken = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
    return { success: true, data: json.access_token };
  } catch (e) {
    return err("UNKNOWN_ERROR", (e as Error).message);
  }
}

async function managementApiFetch<T>(
  path: string,
  init?: RequestInit
): Promise<AuthResult<T>> {
  const token = await getManagementApiToken();
  if (!token.success) return token;

  try {
    const res = await fetch(`https://${requireEnv("AUTH0_DOMAIN")}/api/v2${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token.data}`,
        ...init?.headers,
      },
    });

    if (!res.ok) {
      if (res.status === 404) return err("ORGANIZATION_NOT_FOUND", `Not found: ${path}`);
      return err("MANAGEMENT_API_ERROR", `Auth0 responded with ${res.status} for ${path}`);
    }

    if (res.status === 204) return { success: true, data: undefined as T };
    const json = (await res.json()) as T;
    return { success: true, data: json };
  } catch (e) {
    return err("UNKNOWN_ERROR", (e as Error).message);
  }
}

// --- Organizations CRUD -----------------------------------------------------

export async function createOrganization(input: CreateOrganizationInput): Promise<AuthResult<Organization>> {
  const result = await managementApiFetch<RawOrganization>("/organizations", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      display_name: input.displayName,
      branding: input.logoUrl ? { logo_url: input.logoUrl } : undefined,
      metadata: input.metadata,
    }),
  });
  return mapResult(result, mapOrganization);
}

export async function getOrganization(organizationId: string): Promise<AuthResult<Organization>> {
  const result = await managementApiFetch<RawOrganization>(`/organizations/${organizationId}`);
  return mapResult(result, mapOrganization);
}

export async function updateOrganization(
  organizationId: string,
  input: UpdateOrganizationInput
): Promise<AuthResult<Organization>> {
  const result = await managementApiFetch<RawOrganization>(`/organizations/${organizationId}`, {
    method: "PATCH",
    body: JSON.stringify({
      display_name: input.displayName,
      branding: input.logoUrl ? { logo_url: input.logoUrl } : undefined,
      metadata: input.metadata,
    }),
  });
  return mapResult(result, mapOrganization);
}

export async function deleteOrganization(organizationId: string): Promise<AuthResult> {
  return managementApiFetch(`/organizations/${organizationId}`, { method: "DELETE" });
}

export async function listUserOrganizations(userId: string): Promise<AuthResult<Organization[]>> {
  const result = await managementApiFetch<RawOrganization[]>(
    `/users/${encodeURIComponent(userId)}/organizations`
  );
  return mapResult(result, (raw) => raw.map(mapOrganization));
}

// --- Members -----------------------------------------------------------------

export async function listMembers(organizationId: string): Promise<AuthResult<OrganizationMember[]>> {
  const membersResult = await managementApiFetch<RawMember[]>(`/organizations/${organizationId}/members`);
  if (!membersResult.success) return membersResult;

  const members = await Promise.all(
    membersResult.data.map(async (m) => {
      const roles = await managementApiFetch<RawRole[]>(
        `/organizations/${organizationId}/members/${m.user_id}/roles`
      );
      return {
        userId: m.user_id,
        email: m.email,
        name: m.name,
        picture: m.picture,
        roles: roles.success ? roles.data.map((r) => r.name.toLowerCase() as OrganizationRole) : [],
      };
    })
  );
  return { success: true, data: members };
}

export async function removeMember(organizationId: string, userId: string): Promise<AuthResult> {
  return managementApiFetch(`/organizations/${organizationId}/members`, {
    method: "DELETE",
    body: JSON.stringify({ members: [userId] }),
  });
}

/**
 * Replaces a member's organization roles with the given set.
 * Requires the Auth0 Role IDs to be resolvable by name — see
 * `resolveRoleIds` and SETUP.md for how Owner/Admin/Member map to Auth0 Roles.
 */
export async function changeMemberRole(
  organizationId: string,
  userId: string,
  roles: OrganizationRole[]
): Promise<AuthResult> {
  const current = await managementApiFetch<RawRole[]>(
    `/organizations/${organizationId}/members/${userId}/roles`
  );
  if (!current.success) return current;

  if (current.data.length > 0) {
    const removed = await managementApiFetch(`/organizations/${organizationId}/members/${userId}/roles`, {
      method: "DELETE",
      body: JSON.stringify({ roles: current.data.map((r) => r.id) }),
    });
    if (!removed.success) return removed;
  }

  const roleIds = await resolveRoleIds(roles);
  if (!roleIds.success) return roleIds;

  return managementApiFetch(`/organizations/${organizationId}/members/${userId}/roles`, {
    method: "POST",
    body: JSON.stringify({ roles: roleIds.data }),
  });
}

/**
 * Looks up Auth0 Role IDs by name ("Owner", "Admin", "Member").
 * These roles must already exist in the tenant — created from the
 * Dashboard, see SETUP.md → Configuration. This module never creates
 * or defines roles/permissions itself.
 */
async function resolveRoleIds(roles: OrganizationRole[]): Promise<AuthResult<string[]>> {
  const all = await managementApiFetch<RawRole[]>("/roles");
  if (!all.success) return all;

  const wanted = roles.map((r) => r.toLowerCase());
  const ids = all.data.filter((r) => wanted.includes(r.name.toLowerCase())).map((r) => r.id);

  if (ids.length !== roles.length) {
    return err(
      "MANAGEMENT_API_ERROR",
      `Could not resolve one or more roles: ${roles.join(", ")}. Make sure they exist in the tenant.`
    );
  }
  return { success: true, data: ids };
}

// --- Invitations ---------------------------------------------------------------

export async function inviteMember(input: InviteMemberInput): Promise<AuthResult<Invitation>> {
  const roleIds = await resolveRoleIds(input.roles);
  if (!roleIds.success) return roleIds;

  const result = await managementApiFetch<RawInvitation>(
    `/organizations/${input.organizationId}/invitations`,
    {
      method: "POST",
      body: JSON.stringify({
        client_id: requireEnv("AUTH0_CLIENT_ID"),
        inviter: { name: input.inviterName },
        invitee: { email: input.email },
        roles: roleIds.data,
      }),
    }
  );
  return mapResult(result, (raw) => mapInvitation(raw, input.organizationId));
}

export async function deleteInvitation(organizationId: string, invitationId: string): Promise<AuthResult> {
  return managementApiFetch(`/organizations/${organizationId}/invitations/${invitationId}`, {
    method: "DELETE",
  });
}

// --- Active organization / session helpers --------------------------------------

/**
 * Reads the active organization from the current session's `org_id` claim.
 * The claim is only present when the user authenticated against a specific
 * organization (via `?organization=` at login) — see `client.ts` → `switchOrganization`.
 */
export async function getActiveOrganizationFromSession(): Promise<ActiveOrganization | null> {
  const session = await auth0.getSession();
  const orgId = (session?.user as Record<string, unknown> | undefined)?.org_id as string | undefined;
  if (!session || !orgId) return null;

  const org = await getOrganization(orgId);
  if (!org.success) return null;
  return { id: org.data.id, name: org.data.name, displayName: org.data.displayName };
}

export async function getCurrentUserId(): Promise<string | null> {
  const session = await auth0.getSession();
  return session?.user.sub ?? null;
}

// --- Mapping helpers ---------------------------------------------------------

interface RawOrganization {
  id: string;
  name: string;
  display_name: string;
  branding?: { logo_url?: string };
  metadata?: Record<string, string>;
}
interface RawMember {
  user_id: string;
  email: string;
  name?: string;
  picture?: string;
}
interface RawRole {
  id: string;
  name: string;
}
interface RawInvitation {
  id: string;
  invitation_url: string;
  expires_at: string;
  inviter: { name: string };
  invitee: { email: string };
}

function mapOrganization(raw: RawOrganization): Organization {
  return {
    id: raw.id,
    name: raw.name,
    displayName: raw.display_name,
    logoUrl: raw.branding?.logo_url,
    metadata: raw.metadata,
  };
}

function mapInvitation(raw: RawInvitation, organizationId: string): Invitation {
  return {
    id: raw.id,
    organizationId,
    email: raw.invitee.email,
    inviterName: raw.inviter.name,
    roles: [],
    invitationUrl: raw.invitation_url,
    expiresAt: raw.expires_at,
  };
}

function mapResult<A, B>(result: AuthResult<A>, map: (data: A) => B): AuthResult<B> {
  return result.success ? { success: true, data: map(result.data) } : result;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function err(code: AuthErrorCode, message: string): { success: false; error: AuthError } {
  return { success: false, error: { code, message } };
}
