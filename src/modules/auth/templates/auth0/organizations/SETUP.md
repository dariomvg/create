# Auth0 Organizations Module

Multi-tenancy for a Next.js App Router project using Auth0 Organizations:
create/manage organizations, invite and manage members, assign basic
Owner/Admin/Member roles per organization, switch active organization, and
protect Server Components based on organization membership.

This module is self-contained — no imports from the separate auth module —
but it assumes that module (or an equivalent) already mounts `/auth/login`
and `/auth/logout` via its `proxy.ts`, since switching organizations and
accepting invitations both work by re-authenticating through that route.

This module does **not** implement generic roles/permissions (RBAC) — only
the fixed Owner/Admin/Member roles scoped to organization membership. Use
your separate roles/permissions module for anything beyond that.

## Dependencies

- `@auth0/nextjs-auth0` (^4.26.1 or newer)

## File map

| File | Where it's used | What it's for |
|---|---|---|
| `types.ts` | anywhere | Shared types (`Organization`, `OrganizationMember`, `Invitation`, etc.) |
| `service.ts` | internal only | Management API client, CRUD, invitations, role assignment. Never import directly. |
| `actions.ts` | Server Components / Server Actions | `"use server"` — the only server-side entry point |
| `client.ts` | Client Components | `switchOrganization`, `buildAcceptInvitationUrl` |
| `.env` / `.env.local` | project root | Environment variables |

No `proxy.ts` in this module — only one proxy can exist per Next.js
project, and organization switching/invitation-accept both reuse the
`/auth/login` route already mounted by the auth module's `proxy.ts`.

## Usage

### Listing and creating organizations

```ts
import { listUserOrganizations, createOrganization } from "@/lib/auth0-organizations/actions";

const orgs = await listUserOrganizations();
const created = await createOrganization({ name: "acme-inc", displayName: "Acme Inc." });
```

### Protecting a Server Component by active organization

```tsx
import { requireActiveOrganization } from "@/lib/auth0-organizations/actions";

export default async function TeamPage() {
  const org = await requireActiveOrganization("/organizations");
  return <p>You're viewing {org.displayName}</p>;
}
```

### Organization switcher (Client Component)

```tsx
"use client";
import { switchOrganization } from "@/lib/auth0-organizations/client";

export function OrgSwitcher({ organizations }: { organizations: { id: string; name: string }[] }) {
  return (
    <select onChange={(e) => switchOrganization(e.target.value)}>
      {organizations.map((o) => (
        <option key={o.id} value={o.id}>{o.name}</option>
      ))}
    </select>
  );
}
```

### Inviting a member

```ts
import { inviteMember } from "@/lib/auth0-organizations/actions";

await inviteMember({
  organizationId: org.id,
  email: "teammate@example.com",
  roles: ["member"],
  inviterName: "Jane (Acme Inc.)",
});
```

### Accepting / declining an invitation

Accepting is normally just the invited user clicking the link in the
invitation email — it lands on `/auth/login?organization=...&invitation=...`
and Auth0 finishes the flow automatically. `acceptInvitation()` in
`actions.ts` is only for a custom confirmation screen before that redirect.

```ts
import { declineInvitation } from "@/lib/auth0-organizations/actions";

await declineInvitation(organizationId, invitationId);
```

### Changing a member's role

```ts
import { changeMemberRole } from "@/lib/auth0-organizations/actions";

await changeMemberRole(organizationId, userId, ["admin"]);
```

## Configuration

These steps happen in the Auth0 Dashboard — there's no code for them.

1. **Enable Organizations on the application**: under your Application →
   *Organizations* tab, choose how login should behave: *No Prompt*,
   *Prompt for organization*, or *Require organization*. "Require
   organization" is the most common choice for B2B multi-tenant apps.
2. **Create the Roles**: under *User Management → Roles*, create three
   roles named exactly `Owner`, `Admin`, and `Member` (case-insensitive
   match is used by `resolveRoleIds` in `service.ts`, but keep the names
   consistent). Define whatever permissions/API scopes each role should
   carry — this module only assigns and reads role assignments, it never
   defines what a role can do.
3. **Invitation email branding**: customize the template under
   *Branding → Email Templates → Organization Invitation* if you want
   something other than Auth0's default.
4. **Machine-to-Machine application**: reuse the M2M app from the auth
   module (or create a new one) authorized for the **Auth0 Management
   API**, with these scopes: `create:organizations`, `read:organizations`,
   `update:organizations`, `delete:organizations`,
   `create:organization_members`, `read:organization_members`,
   `delete:organization_members`, `create:organization_invitations`,
   `read:organization_invitations`, `delete:organization_invitations`,
   `create:organization_member_roles`, `read:organization_member_roles`,
   `delete:organization_member_roles`, and `read:roles` (used to resolve
   Owner/Admin/Member to their Auth0 Role IDs).
5. **Organization-specific connections** (optional): if different
   organizations should use different login connections (e.g. one org
   uses Google Workspace SSO, another uses email+password), enable the
   relevant connections per organization under each organization's
   *Connections* tab. Nothing in this module needs to change for that.
