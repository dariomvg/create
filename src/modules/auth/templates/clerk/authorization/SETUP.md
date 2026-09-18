# Roles & Permissions (RBAC) module — Clerk (Next.js 16 / App Router)

Self-contained module — doesn't import from the auth or organizations modules, even where functionality overlaps (e.g. assigning a role to a user).

## Dependencies

- `@clerk/nextjs` (already installed — nothing new)

## File map

```
lib/rbac/
├── service.ts   # Server-only logic. Don't touch.
├── actions.ts   # Server Actions for Server Components ("use server")
├── types.ts     # Role, Permission, OrgRole, AuthResult
└── client.ts    # Show re-export + copy-paste usage examples
```

No new `.env.local` (same Clerk instance/keys) and no new `proxy.ts` (same reasons as the organizations module — one middleware file per Next.js project).

## Prerequisite

Organizations must already be enabled for roles/permissions to mean anything (Dashboard → Organizations settings). If you haven't done that yet, it's covered in the organizations module's SETUP.md.

## Important gotchas (read before relying on this in production)

### System permissions (`org:sys_*`) aren't in the session token

Clerk's own docs warn about this: **System Permissions don't travel in session claims.** `checkPermission()` works reliably server-side for **Custom Permissions**, but if you pass it a `org:sys_*` value, the result may not reflect reality on the server. Role checks (`checkRole()`) don't have this problem — the role is in the session token.

### Role/Permission catalog CRUD uses a fairly new API

`createRole`, `updateRole`, `deleteRole`, `createPermission`, etc. call Clerk's Backend API directly (`https://api.clerk.com/v1/organization_roles` and `/organization_permissions`), added in Nov 2025. A stable wrapped method on the JS SDK (`clerkClient.organizationRoles...` or similar) couldn't be confirmed at the time this was written, so `service.ts` uses an authenticated `fetch` instead of guessing a method name. **Before relying on this in production, check the current Backend API reference** (`https://clerk.com/docs/reference/backend-api`) in case a wrapped SDK method exists now — swapping it in is a one-line change, the request/response shapes here should still line up.

### Custom Permissions need a Feature first

Per Clerk's docs, a Custom Permission is tied to a Feature within a Role. `createPermission()` assumes the Feature already exists — create it first in Dashboard → Features (or under the Role's page in Roles & Permissions). This module doesn't manage Features.

### Custom roles/permissions require a paid plan in production

Free in development. In production they require Clerk's B2B/Enhanced Organizations add-on (check current pricing when you enable it).

### Role Sets

A custom role isn't assignable to an organization until it's included in that organization's Role Set. Configure this in Dashboard → Organizations settings → Roles & Permissions → Role Sets.

## Clerk Dashboard checklist (no code needed)

- [ ] Organizations enabled (prerequisite, see above)
- [ ] Plan/add-on for custom roles in production, if you'll need more than `org:admin`/`org:member`
- [ ] Feature created for each Custom Permission you plan to add via `createPermission()`
- [ ] New custom roles added to the relevant Role Set(s)
- [ ] Creator role / Default role reassigned, if you're deleting a role that currently holds either

## Usage examples

**Create a custom role and a permission, then link them:**

```ts
import { createRole, createPermission, assignPermissionToRole } from "@/lib/rbac/service";

const role = await createRole({ name: "Billing", key: "billing" }); // -> org:billing
const permission = await createPermission({
  name: "Create invoices",
  key: "invoices:create", // -> org:invoices:create (Feature "invoices" must exist)
});
await assignPermissionToRole(role.id, permission.id);
```

**Protect a Server Component by role:**

```tsx
import { requireOrgRole } from "@/lib/rbac/service";

export default async function AdminSettingsPage() {
  await requireOrgRole("org:admin", "/dashboard");
  return <p>Admin settings</p>;
}
```

**Protect an API Route by permission:**

```ts
import { checkPermission } from "@/lib/rbac/service";

export async function POST(request: Request) {
  if (!(await checkPermission("org:invoices:create"))) {
    return new Response("Forbidden", { status: 403 });
  }
  // ...
}
```

**Gate UI by role or permission:**

```tsx
import { Show } from "@/lib/rbac/client";

<Show when={{ role: "org:admin" }}>
  <AdminPanel />
</Show>
```
