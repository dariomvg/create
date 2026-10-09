# Auth — Clerk — authorization

## Description

Role-based access control (RBAC) with Clerk (`@clerk/nextjs` v7, Core 3) for Next.js 16 App Router: manage the catalog of roles and permissions (create, get, update, delete), link permissions to roles, assign and remove roles on users, read a user's role and permissions, and check roles/permissions for route, Server Component, Server Action and API authorization. Native roles: `org:admin`, `org:member`. Custom roles and permissions are supported.

Notes:
- Requires Organizations enabled in the Clerk Dashboard (Organizations settings). Roles are scoped to an organization membership.
- Role checks (`checkRole`, `requireOrgRole`) read the role from the session token and are reliable server-side.
- Permission checks (`checkPermission`, `requireOrgPermission`) are reliable server-side for **Custom Permissions** (`org:<feature>:<action>`, e.g. `org:invoices:create`). System permissions (`org:sys_*`) are not included in the session token: do not use them for server-side checks.
- Resource-based permissions: name Custom Permissions per resource (`org:invoices:edit`, `org:tasks:delete`).
- Role/permission catalog functions call Clerk's Backend API (`https://api.clerk.com/v1/organization_roles` and `/organization_permissions`) with `fetch` and `CLERK_SECRET_KEY`.
- A Custom Permission is tied to a Feature that must already exist (created in the Clerk Dashboard).
- A custom role is assignable in an organization only after it is included in that organization's Role Set (Dashboard).
- A role that is the Creator role, the Default role, or is assigned to members cannot be deleted.
- Custom roles/permissions are free in development and require the paid B2B/Enhanced Organizations add-on in production.
- `removeRoleFromUserAction` removes the user from the organization (Clerk has no "no role" membership state).
- Protection model: call `requireOrgRole` / `requireOrgPermission` / `checkPermission` at the top of the Server Component, Server Action or Route Handler. Do not gate by path in `proxy.ts` (`createRouteMatcher()` is deprecated).

## Dependencies

- `next` (16+)
- `react`
- `@clerk/nextjs` (v7+)
- `server-only`

## Environment variables

| Variable | Example | Notes |
|---|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_test_...` | Clerk Dashboard → API Keys |
| `CLERK_SECRET_KEY` | `sk_test_...` | Clerk Dashboard → API Keys. Server only. Used by the Backend API calls |

## File structure

```
@/lib/auth/clerk/authorization/
├── service.ts   # Server-only logic. Do not edit.
├── actions.ts   # Server Actions ("use server")
├── types.ts     # Role, Permission, OrgRole, AuthResult<T>
├── client.ts    # Show re-export + usage examples
└── SETUP.md

.env.local       # project root
```

## Public API

### `actions.ts` — Server Actions

Import: `@/lib/auth/clerk/authorization/actions`. All return `Promise<AuthResult<T>>`.

| Export | Arguments | Returns |
|---|---|---|
| `listRolesAction` | none | `AuthResult<Role[]>` |
| `getRoleAction` | `roleId: string` | `AuthResult<Role>` |
| `createRoleAction` | `{ name: string; key: string; description?: string }` | `AuthResult<Role>` — final key is `org:<key>` |
| `updateRoleAction` | `roleId: string`, `{ name?: string; description?: string }` | `AuthResult<Role>` |
| `deleteRoleAction` | `roleId: string` | `AuthResult` |
| `getRolePermissionsAction` | `roleId: string` | `AuthResult<Permission[]>` |
| `listPermissionsAction` | none | `AuthResult<Permission[]>` |
| `getPermissionAction` | `permissionId: string` | `AuthResult<Permission>` |
| `createPermissionAction` | `{ name: string; key: string; description?: string }` | `AuthResult<Permission>` — final key is `org:<feature>:<key>` |
| `updatePermissionAction` | `permissionId: string`, `{ name?: string; description?: string }` | `AuthResult<Permission>` |
| `deletePermissionAction` | `permissionId: string` | `AuthResult` |
| `assignPermissionToRoleAction` | `roleId: string`, `permissionId: string` | `AuthResult` |
| `removePermissionFromRoleAction` | `roleId: string`, `permissionId: string` | `AuthResult` |
| `getUserRoleAction` | `organizationId: string`, `userId: string` | `AuthResult<OrgRole>` (`success: false` if the user is not a member) |
| `getUserPermissionsAction` | `organizationId: string`, `userId: string` | `AuthResult<Permission[]>` |
| `assignRoleToUserAction` | `organizationId: string`, `userId: string`, `role: OrgRole` | `AuthResult` |
| `removeRoleFromUserAction` | `organizationId: string`, `userId: string` | `AuthResult` |
| `checkRoleAction` | `role: OrgRole` | `AuthResult<boolean>` — active organization, current user |
| `checkPermissionAction` | `permission: string` | `AuthResult<boolean>` — active organization, current user |

### `client.ts` — Client components

Import: `@/lib/auth/clerk/authorization/client`. Re-export from `@clerk/nextjs`.

| Export | Arguments | Returns |
|---|---|---|
| `Show` | `{ when: { role: string } \| { permission: string }, children, fallback? }` | Renders `children` when the current user's role/permission matches |

### Types (`types.ts`)

```ts
type OrgRole = "org:admin" | "org:member" | (string & {}); // custom role keys allowed
interface Permission {
  id: string; key: string; name: string; description: string | null;
}
interface Role {
  id: string; key: OrgRole; name: string; description: string | null;
  permissions?: Permission[];
}
type AuthResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };
```

## Examples

**Create a custom role, a permission, and link them:**

```ts
import {
  createRoleAction,
  createPermissionAction,
  assignPermissionToRoleAction,
} from "@/lib/auth/clerk/authorization/actions";

const role = await createRoleAction({ name: "Billing", key: "billing" }); // org:billing
const permission = await createPermissionAction({
  name: "Create invoices",
  key: "invoices:create", // org:invoices:create (Feature "invoices" must exist)
});

if (role.success && permission.success) {
  await assignPermissionToRoleAction(role.data.id, permission.data.id);
}
```

**Assign a role to a user:**

```ts
import { assignRoleToUserAction } from "@/lib/auth/clerk/authorization/actions";

await assignRoleToUserAction(organizationId, userId, "org:billing");
```

**Protect a Server Component by role** (`requireOrgRole` lives in `service.ts`; redirects to `redirectTo`, default `/`):

```tsx
import { requireOrgRole } from "@/lib/auth/clerk/authorization/service";

export default async function AdminSettingsPage() {
  await requireOrgRole("org:admin", "/dashboard");
  return <p>Admin settings</p>;
}
```

**Protect a Server Component by permission:**

```tsx
import { requireOrgPermission } from "@/lib/auth/clerk/authorization/service";

export default async function InvoicesPage() {
  await requireOrgPermission("org:invoices:create", "/dashboard");
  return <p>Invoices</p>;
}
```

**Protect a Route Handler** (`checkPermission` lives in `service.ts`; returns `Promise<boolean>`):

```ts
import { checkPermission } from "@/lib/auth/clerk/authorization/service";

export async function POST(request: Request) {
  if (!(await checkPermission("org:invoices:create"))) {
    return new Response("Forbidden", { status: 403 });
  }
  // ...
}
```

**Check from a Server Component without redirecting:**

```tsx
import { checkRoleAction } from "@/lib/auth/clerk/authorization/actions";

const result = await checkRoleAction("org:admin");
const isAdmin = result.success && result.data;
```

**Show UI by role or permission:**

```tsx
import { Show } from "@/lib/auth/clerk/authorization/client";

<Show when={{ role: "org:admin" }}>
  <AdminPanel />
</Show>

<Show when={{ permission: "org:invoices:create" }}>
  <CreateInvoiceButton />
</Show>
```