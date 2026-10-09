# Auth — Clerk — organizations

## Description

Organizations/Teams with Clerk (`@clerk/nextjs` v7, Core 3) for Next.js 16 App Router: create, get, update and delete organizations; list the user's organizations; invite users; accept and revoke invitations; list, update and remove members; switch the active organization; multi-tenancy through the active organization (`orgId` / `orgSlug`); organization-based protection.

Roles used: Clerk's native `org:admin` (the Owner equivalent) and `org:member`.

Invitations: the invitee accepts client-side (`accept()` through `useOrganizationList`); an admin cancels a pending invitation server-side (`revokeInvitationAction`).

Requires in the Clerk Dashboard (no code):
- Organizations enabled (Dashboard → Organizations settings).
- Membership mode: `Membership required` (B2B, users go through a "choose organization" step after sign-in) or `Membership optional` (personal accounts + organizations).
- Creator role: role assigned to whoever creates an organization (default `org:admin`).
- Optional member cap per organization (`maxAllowedMemberships`).

Protection model: call `requireOrganization()` or `requireOrgRole(role)` (from `service.ts`) at the top of any Server Component, Server Action or Route Handler. Do not gate by path in `proxy.ts` (`createRouteMatcher()` is deprecated).

## Dependencies

- `next` (16+)
- `react`
- `@clerk/nextjs` (v7+)
- `server-only`

## Environment variables

| Variable | Example | Notes |
|---|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_test_...` | Clerk Dashboard → API Keys |
| `CLERK_SECRET_KEY` | `sk_test_...` | Clerk Dashboard → API Keys. Server only |

## File structure

```
@/lib/auth/clerk/organizations/
├── service.ts   # Server-only logic. Do not edit.
├── actions.ts   # Server Actions ("use server")
├── types.ts     # OrgSummary, OrgMember, OrgInvitation, OrgRole, AuthResult<T>
├── client.ts    # Client component/hook re-exports + usage examples
└── SETUP.md

.env.local       # project root
```

## Public API

### `actions.ts` — Server Actions

Import: `@/lib/auth/clerk/organizations/actions`. All return `AuthResult<T>`.

| Export | Arguments | Returns |
|---|---|---|
| `createOrganizationAction` | `name: string` | `Promise<AuthResult<OrgSummary>>` — current user becomes the creator |
| `getOrganizationAction` | `organizationId: string` | `Promise<AuthResult<OrgSummary>>` |
| `updateOrganizationAction` | `organizationId: string`, `data: { name?: string; slug?: string }` | `Promise<AuthResult<OrgSummary>>` |
| `deleteOrganizationAction` | `organizationId: string` | `Promise<AuthResult>` |
| `listUserOrganizationsAction` | none | `Promise<AuthResult<OrgSummary[]>>` — organizations of the current user |
| `listMembersAction` | `organizationId: string` | `Promise<AuthResult<OrgMember[]>>` |
| `updateMemberRoleAction` | `organizationId: string`, `userId: string`, `role: OrgRole` | `Promise<AuthResult>` |
| `removeMemberAction` | `organizationId: string`, `userId: string` | `Promise<AuthResult>` |
| `inviteMemberAction` | `organizationId: string`, `emailAddress: string`, `role: OrgRole` | `Promise<AuthResult<OrgInvitation>>` — requires `org:sys_memberships:manage` |
| `listInvitationsAction` | `organizationId: string` | `Promise<AuthResult<OrgInvitation[]>>` |
| `revokeInvitationAction` | `organizationId: string`, `invitationId: string` | `Promise<AuthResult>` — cancels a pending invitation |

### `client.ts` — Client components and hooks

Import: `@/lib/auth/clerk/organizations/client`. Re-exports from `@clerk/nextjs`.

| Export | Arguments | Returns |
|---|---|---|
| `OrganizationSwitcher` | optional Clerk props (e.g. `hidePersonal`) | UI to create, list and switch organizations |
| `useOrganization` | none | `{ isLoaded, organization, membership, ... }` for the active organization |
| `useOrganizationList` | optional `{ userInvitations?, userMemberships? }` | `{ isLoaded, setActive, userInvitations, userMemberships, ... }` |
| `Show` | `{ when: { role: string } \| { permission: string }, children, fallback? }` | Renders `children` when the active-organization role/permission matches |

Switch the active organization: `setActive({ organization: orgId })`. Accept an invitation: `invitation.accept()` on each item of `userInvitations.data`.

### Types (`types.ts`)

```ts
type OrgRole = "org:admin" | "org:member";
interface OrgSummary {
  id: string; name: string; slug: string | null;
  imageUrl: string; membersCount: number; createdAt: Date;
}
interface OrgMember {
  userId: string; organizationId: string; role: OrgRole;
  identifier: string; imageUrl: string;
}
interface OrgInvitation {
  id: string; organizationId: string; emailAddress: string;
  role: OrgRole; status: "pending" | "accepted" | "revoked"; createdAt: Date;
}
type AuthResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };
```

## Examples

**Switcher UI:**

```tsx
import { OrganizationSwitcher } from "@/lib/auth/clerk/organizations/client";

<OrganizationSwitcher hidePersonal />
```

**Create an organization from a Server Action:**

```tsx
import { createOrganizationAction } from "@/lib/auth/clerk/organizations/actions";

<form
  action={async (formData: FormData) => {
    "use server";
    await createOrganizationAction(String(formData.get("name")));
  }}
>
  <input name="name" />
  <button type="submit">Create</button>
</form>
```

**List members in a Server Component:**

```tsx
import { listMembersAction } from "@/lib/auth/clerk/organizations/actions";

export default async function MembersPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const result = await listMembersAction(orgId);
  if (!result.success) return null;
  return <ul>{result.data.map((m) => <li key={m.userId}>{m.identifier} — {m.role}</li>)}</ul>;
}
```

**Invite a member:**

```tsx
import { inviteMemberAction } from "@/lib/auth/clerk/organizations/actions";

<form
  action={async (formData: FormData) => {
    "use server";
    await inviteMemberAction(orgId, String(formData.get("email")), "org:member");
  }}
>
  <input name="email" type="email" />
  <button type="submit">Invite</button>
</form>
```

**Accept pending invitations (invitee, Client Component):**

```tsx
"use client";
import { useOrganizationList } from "@/lib/auth/clerk/organizations/client";

export function PendingInvitations() {
  const { userInvitations } = useOrganizationList({ userInvitations: { infinite: true } });
  return (
    <>
      {userInvitations.data?.map((invitation) => (
        <button key={invitation.id} onClick={() => invitation.accept()}>Accept</button>
      ))}
    </>
  );
}
```

**Switch the active organization (Client Component):**

```tsx
"use client";
import { useOrganizationList } from "@/lib/auth/clerk/organizations/client";

export function SwitchTo({ orgId }: { orgId: string }) {
  const { setActive } = useOrganizationList();
  return <button onClick={() => setActive?.({ organization: orgId })}>Switch</button>;
}
```

**Protect a page by active organization and role** (`requireOrgRole` lives in `service.ts`; returns `OrgSummary`):

```tsx
import { requireOrgRole } from "@/lib/auth/clerk/organizations/service";

export default async function OrgSettingsPage() {
  const org = await requireOrgRole("org:admin");
  return <p>Settings for {org.name}</p>;
}
```

**Show UI by role:**

```tsx
import { Show } from "@/lib/auth/clerk/organizations/client";

<Show when={{ role: "org:admin" }}>
  <AdminPanel />
</Show>
```