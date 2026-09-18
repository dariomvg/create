# Auth module — Clerk (Next.js 16 / App Router)

Authentication module built on `@clerk/nextjs` (Core 3 / v7).

## Dependencies

- `@clerk/nextjs`

## File map

```
proxy.ts                                  # Route protection (Next.js 16 middleware replacement)
app/
├── sign-in/[[...sign-in]]/page.tsx       # Sign-in page (see client.ts for the component)
└── sign-up/[[...sign-up]]/page.tsx       # Sign-up page (see client.ts for the component)

lib/clerk/
├── service.ts   # Server-only logic. Don't touch — everything else calls into this.
├── actions.ts   # Server Actions for Server Components ("use server")
├── types.ts     # AuthUser, AuthSession, AuthResult<T>
└── client.ts    # Client component/hook re-exports + copy-paste usage examples

.env.local       # Clerk keys and URLs
```

| I need to...                          | Go to                          |
|----------------------------------------|---------------------------------|
| Get the current user in a Server Component | `lib/clerk/service.ts` → `getUser()` / `requireUser()` |
| Call auth from a Server Component (button, form) | `lib/clerk/actions.ts` |
| Add a type for something auth-related | `lib/clerk/types.ts` |
| Render `<SignIn/>`, `<SignUp/>`, `<UserButton/>`, `<Show/>`, or use a client hook | `lib/clerk/client.ts` |
| Change which routes are public/protected | `proxy.ts` (project root) |

## Setup

### 1. Environment variables

Fill in `.env.local` with the keys from your Clerk instance (Dashboard → API Keys):

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
```

### 2. Wrap the app with `ClerkProvider`

```tsx
// app/layout.tsx
import { ClerkProvider } from "@/lib/clerk/client";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
```

### 3. Sign-in / sign-up pages

Already covered by `app/sign-in/[[...sign-in]]/page.tsx` and `app/sign-up/[[...sign-up]]/page.tsx` — see `client.ts` for the exact component code to paste in.

### 4. `proxy.ts`

Already set up at the project root. `createRouteMatcher()` is deprecated, so it no longer decides what's public or private — it just attaches Clerk's session context to every request. Actual protection happens per-resource: call `requireUser()` from `lib/clerk/service.ts` at the top of any Server Component, Server Action, or Route Handler that needs a signed-in user. A page is "public" simply because nothing on it calls `requireUser()`.

## Clerk Dashboard checklist

Configure these directly in the Dashboard — no code needed on this side:

- [ ] Email + password sign-in enabled
- [ ] Email verification enabled
- [ ] Forgot password / reset password flow enabled
- [ ] OAuth providers connected: Google, GitHub, Apple, Facebook
- [ ] Sign-in/sign-up paths in Dashboard → Paths match `/sign-in` and `/sign-up`

Not included in this module (out of scope): Magic Link, MFA/2FA, Passkeys, roles/permissions, organizations.

## Usage examples

**Protect a Server Component:**

```tsx
import { requireUser } from "@/lib/clerk/service";

export default async function DashboardPage() {
  const user = await requireUser(); // redirects to /sign-in if not authenticated
  return <p>Welcome, {user.firstName}</p>;
}
```

**User menu (avatar, profile, sign out):**

```tsx
import { UserButton } from "@/lib/clerk/client";

<UserButton />
```

**Sign out from a Server Action:**

```tsx
import { signOutAction } from "@/lib/clerk/actions";

<form action={signOutAction}>
  <button type="submit">Sign out</button>
</form>
```

**Show content based on session state:**

```tsx
import { Show } from "@/lib/clerk/client";

<Show when="signed-in">You're logged in</Show>
<Show when="signed-out">Please sign in</Show>
```