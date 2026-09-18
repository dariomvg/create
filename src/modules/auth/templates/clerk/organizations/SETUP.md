# Organizations/Teams module — Clerk (Next.js 16 / App Router)

Separate module from the auth module. Custom roles/permissions live in your other, separate module — this one only uses Clerk's native org roles (`org:admin` / `org:member`).

## Dependencies

- `@clerk/nextjs` (already installed for the auth module — nothing new)

## File map

```
lib/organizations/
├── service.ts   # Server-only logic. Don't touch.
├── actions.ts   # Server Actions for Server Components ("use server")
├── types.ts     # OrgSummary, OrgMember, OrgInvitation, OrgRole
└── client.ts    # Client component/hook re-exports + copy-paste examples
```

No new `.env.local` (same Clerk instance/keys as the auth module) and no new `proxy.ts` (Next.js only allows one middleware file — see "Route protection" below).

| I need to...                                | Go to |
|-----------------------------------------------|-------|
| Create/update/delete an organization           | `lib/organizations/service.ts` |
| Call org actions from a Server Component (form, button) | `lib/organizations/actions.ts` |
| Add a type for something org-related           | `lib/organizations/types.ts` |
| Render `<OrganizationSwitcher/>`, switch active org, accept invitations | `lib/organizations/client.ts` |
| Show/hide UI by org role or permission         | `lib/clerk/client.ts` → `Show` (auth module, not duplicated here) |

## Prerequisite: enable Organizations

Nothing here works until you do this in the Dashboard:

1. **Dashboard → Organizations settings → Enable Organizations.**
2. Pick the **Membership mode**:
   - `Membership required` — B2B only, no personal accounts, users are routed through a "choose organization" screen after sign-in.
   - `Membership optional` — personal accounts stay available alongside orgs (B2C + B2B).
3. **Creator role** — which role a user gets automatically when they create an org. Defaults to `org:admin` (there's no separate "Owner" role — see below).

## Clerk Dashboard checklist (no code needed)

- [ ] Organizations enabled + Membership mode chosen
- [ ] Creator role confirmed (default `org:admin`)
- [ ] Member cap (`maxAllowedMemberships`) set, if you want a hard limit — can also be passed per-org in `createOrganization()`
- [ ] Custom roles beyond `admin`/`member` — **not here**, that's your separate roles/permissions module
- [ ] Verified domains / Enterprise SSO — not covered by this module

## About roles: Owner = Admin

Clerk ships two system roles: `org:admin` and `org:member`. `org:admin` is used as the Owner equivalent throughout this module — no custom role.

## About "reject invitation"

Clerk's API only offers:
- `accept()` — client-side, called by the invitee on their pending `UserOrganizationInvitation`
- `revoke()` — server-side, called by an admin to cancel a pending invitation

`revokeInvitationAction` in this module covers that.

## Route protection

Organization-level protection happens entirely at the Server Component/Server Action/Route Handler level, same pattern as `requireUser()` in the auth module — there's no middleware-level alternative to fall back to: Clerk deprecated `createRouteMatcher()` and no longer recommends gating routes (by path or by role) in `proxy.ts`.

```tsx
import { requireOrganization, requireOrgRole } from "@/lib/organizations/service";

export default async function OrgSettingsPage() {
  const org = await requireOrgRole("org:admin"); // redirects if no active org or not admin
  return <p>Settings for {org.name}</p>;
}
```

## Usage examples

**List the user's organizations and let them switch:**

```tsx
import { OrganizationSwitcher } from "@/lib/organizations/client";

<OrganizationSwitcher hidePersonal />
```

**Invite a member from a Server Action:**

```tsx
import { inviteMemberAction } from "@/lib/organizations/actions";

<form action={() => inviteMemberAction(orgId, email, "org:member")}>
  ...
</form>
```

**Accept a pending invitation (client-side, the invitee's own list):**

```tsx
"use client";
import { useOrganizationList } from "@/lib/organizations/client";

const { userInvitations } = useOrganizationList({
  userInvitations: { infinite: true },
});
```

**Gate a section by role or permission:**

```tsx
import { Show } from "@/lib/clerk/client";

<Show when={{ role: "org:admin" }}>
  <AdminPanel />
</Show>
```