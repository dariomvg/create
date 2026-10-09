# Auth0 Organizations

Multi-tenancy for Next.js App Router projects using Auth0 Organizations: create, read, update and delete organizations; list the current user's organizations; invite, accept and decline invitations; list and remove members; assign Owner / Admin / Member roles per organization; read and switch the active organization; protect Server Components by active organization.

Module: `auth` · Provider: `auth0` · Feature: `organizations`

## Dependencies

- `next` (16+)
- `@auth0/nextjs-auth0` (^4.26.1)
- `server-only`

## Environment variables

Set in `.env.local` at the project root.

| Variable | Required | Description |
|---|---|---|
| `AUTH0_DOMAIN` | Yes | Tenant domain, e.g. `your-tenant.us.auth0.com` (no protocol). |
| `AUTH0_CLIENT_ID` | Yes | Client ID of the Regular Web Application. Sent when creating invitations. |
| `AUTH0_CLIENT_SECRET` | Yes | Client secret of the Regular Web Application (used by the session reader). |
| `AUTH0_SECRET` | Yes | Same value used to encrypt the session cookie. |
| `APP_BASE_URL` | Yes | Public base URL of the app, e.g. `http://localhost:3000`. |
| `AUTH0_M2M_CLIENT_ID` | Yes | Client ID of the Machine-to-Machine app authorized for the Management API. |
| `AUTH0_M2M_CLIENT_SECRET` | Yes | Client secret of that M2M app. |

## File structure

```
lib/auth/auth0/organizations/
├── types.ts      # Shared types
├── service.ts    # Internal: Management API client, organizations, members, roles, invitations, session reader
├── actions.ts    # "use server": public API for Server Components, Server Actions, Route Handlers
└── client.ts     # Public API for Client Components (navigation helpers)

.env.local        # Project root
```

Routes consumed (served by the Auth0 SDK proxy at the project root, not part of this folder):

| Route | Used by |
|---|---|
| `/auth/login?organization=<orgId>` | `switchOrganization`, `switchActiveOrganizationAction`. Re-authenticates the user scoped to that organization. |
| `/auth/login?organization=<orgId>&invitation=<ticket>` | `acceptInvitation`, `buildAcceptInvitationUrl`, and the link in the invitation email. |

Import paths: `@/lib/auth/auth0/organizations/actions`, `@/lib/auth/auth0/organizations/client`, `@/lib/auth/auth0/organizations/types`. Never import `service.ts` from outside the folder.

## Public API

### `actions.ts` (server)

| Export | Arguments | Returns |
|---|---|---|
| `createOrganization` | `input: CreateOrganizationInput` | `Promise<AuthResult<Organization>>` |
| `getOrganization` | `organizationId: string` | `Promise<AuthResult<Organization>>`. Error code `ORGANIZATION_NOT_FOUND` on 404. |
| `updateOrganization` | `organizationId: string`, `input: UpdateOrganizationInput` | `Promise<AuthResult<Organization>>` |
| `deleteOrganization` | `organizationId: string` | `Promise<AuthResult>` |
| `listUserOrganizations` | none (uses the current session user) | `Promise<AuthResult<Organization[]>>`. Error code `NO_SESSION` if there is no session. |
| `listMembers` | `organizationId: string` | `Promise<AuthResult<OrganizationMember[]>>` |
| `inviteMember` | `input: InviteMemberInput` | `Promise<AuthResult<Invitation>>`. Fails if an `Owner` / `Admin` / `Member` role does not exist in the tenant. |
| `acceptInvitation` | `organizationId: string`, `invitationTicket: string` | Never returns; redirects to `/auth/login?organization=...&invitation=...`. |
| `declineInvitation` | `organizationId: string`, `invitationId: string` | `Promise<AuthResult>`. Revokes the pending invitation. |
| `removeMember` | `organizationId: string`, `userId: string` | `Promise<AuthResult>` |
| `changeMemberRole` | `organizationId: string`, `userId: string`, `roles: OrganizationRole[]` | `Promise<AuthResult>`. Replaces all of the member's roles with the given set. |
| `getActiveOrganization` | none | `Promise<ActiveOrganization \| null>`. `null` when the session has no `org_id` claim. |
| `requireActiveOrganization` | `redirectTo?: string` (default `"/organizations"`) | `Promise<ActiveOrganization>`. Redirects to `redirectTo` when there is no active organization. |
| `switchActiveOrganizationAction` | `organizationId: string` | Never returns; redirects to `/auth/login?organization=<organizationId>`. |

### `client.ts` (Client Components)

| Export | Arguments | Returns |
|---|---|---|
| `switchOrganization` | `organizationId: string`, `returnTo?: string` (default `"/"`) | `void`. Navigates to `/auth/login?organization=...&returnTo=...`. |
| `buildAcceptInvitationUrl` | `organizationId: string`, `invitationTicket: string` | `string`. The URL for an "Accept" link or button. |

### Types (`types.ts`)

```ts
type OrganizationRole = "owner" | "admin" | "member";

interface Organization {
  id: string;
  name: string;
  displayName: string;
  logoUrl?: string;
  metadata?: Record<string, string>;
}

interface OrganizationMember {
  userId: string;
  email: string;
  name?: string;
  picture?: string;
  roles: OrganizationRole[];
}

interface Invitation {
  id: string;
  organizationId: string;
  email: string;
  inviterName: string;
  roles: OrganizationRole[]; // empty array in the result of inviteMember
  invitationUrl: string;
  expiresAt: string;
}

interface ActiveOrganization {
  id: string;
  name: string;
  displayName: string;
}

interface CreateOrganizationInput {
  name: string; // Auth0 organization name: lowercase, e.g. "acme-inc"
  displayName: string;
  logoUrl?: string;
  metadata?: Record<string, string>;
}

interface UpdateOrganizationInput {
  displayName?: string;
  logoUrl?: string;
  metadata?: Record<string, string>;
}

interface InviteMemberInput {
  organizationId: string;
  email: string;
  roles: OrganizationRole[];
  inviterName: string; // shown in the invitation email
}

type AuthResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: { code: AuthErrorCode; message: string } };

type AuthErrorCode =
  | "NO_SESSION"
  | "NO_ACTIVE_ORGANIZATION"
  | "NOT_A_MEMBER"
  | "ORGANIZATION_NOT_FOUND"
  | "MANAGEMENT_API_ERROR"
  | "UNKNOWN_ERROR";
```

Behavior notes:
- Functions that return `AuthResult` do not throw; check `success` before reading `data`.
- The active organization comes from the `org_id` claim of the session. That claim exists only when the user logged in with an organization. Changing the active organization always goes through a new login against that organization.
- The actions do not check the caller's role or membership. Any code that calls `deleteOrganization`, `inviteMember`, `removeMember` or `changeMemberRole` must verify the caller is allowed to do so first.
- Owner / Admin / Member are matched by name (case-insensitive) against the tenant's Auth0 Roles. The module assigns and reads them; it does not create them or define their permissions.

## Examples

List the user's organizations and create one:

```ts
import { listUserOrganizations, createOrganization } from "@/lib/auth/auth0/organizations/actions";

const orgs = await listUserOrganizations();
if (orgs.success) {
  console.log(orgs.data.map((o) => o.displayName));
}

const created = await createOrganization({ name: "acme-inc", displayName: "Acme Inc." });
```

Protect a Server Component by active organization:

```tsx
import { requireActiveOrganization } from "@/lib/auth/auth0/organizations/actions";

export default async function TeamPage() {
  const org = await requireActiveOrganization("/organizations");
  return <p>Viewing {org.displayName}</p>;
}
```

Organization switcher in a Client Component:

```tsx
"use client";
import { switchOrganization } from "@/lib/auth/auth0/organizations/client";

export function OrgSwitcher({ organizations }: { organizations: { id: string; displayName: string }[] }) {
  return (
    <select onChange={(e) => switchOrganization(e.target.value, "/dashboard")}>
      {organizations.map((o) => (
        <option key={o.id} value={o.id}>{o.displayName}</option>
      ))}
    </select>
  );
}
```

Invite a member and change a role:

```ts
import { inviteMember, changeMemberRole } from "@/lib/auth/auth0/organizations/actions";

const invitation = await inviteMember({
  organizationId: "org_abc123",
  email: "teammate@example.com",
  roles: ["member"],
  inviterName: "Jane (Acme Inc.)",
});

await changeMemberRole("org_abc123", "auth0|user123", ["admin"]);
```

Accept and decline an invitation:

```tsx
import { acceptInvitation, declineInvitation } from "@/lib/auth/auth0/organizations/actions";

async function accept() {
  "use server";
  await acceptInvitation("org_abc123", "ticket_xyz");
}

async function decline() {
  "use server";
  await declineInvitation("org_abc123", "inv_abc123");
}
```

## Configuration

Steps in the Auth0 Dashboard that cannot be done from code.

1. In the application's **Organizations** tab, choose the login behavior: *No Prompt*, *Prompt for organization*, or *Require organization*.
2. Under *User Management → Roles*, create the roles `Owner`, `Admin` and `Member`, and define their permissions there.
3. Optionally customize the invitation email under *Branding → Email Templates → Organization Invitation*.
4. Authorize the Machine-to-Machine application for the **Auth0 Management API** with these scopes: `create:organizations`, `read:organizations`, `update:organizations`, `delete:organizations`, `create:organization_members`, `read:organization_members`, `delete:organization_members`, `create:organization_invitations`, `read:organization_invitations`, `delete:organization_invitations`, `create:organization_member_roles`, `read:organization_member_roles`, `delete:organization_member_roles`, `read:roles`.
5. To use different login connections per organization, enable them under each organization's *Connections* tab.