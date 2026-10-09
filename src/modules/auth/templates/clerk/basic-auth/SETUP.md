# Auth — Clerk — basic-auth

## Description

Authentication with Clerk (`@clerk/nextjs` v7, Core 3) for Next.js 16 App Router: sign up, sign in, sign out, current user, current session, session refresh, per-resource route protection and session persistence.

Sign-in methods, email verification, forgot/reset password and OAuth providers (Google, GitHub, Apple, Facebook) are rendered by Clerk's `<SignIn />` / `<SignUp />` components and enabled in the Clerk Dashboard (no code).

Protection model: `proxy.ts` only attaches Clerk's session context to each request (`createRouteMatcher()` is deprecated, do not use it). Protection happens per resource: call `requireUser()` (from `service.ts`) at the top of any Server Component, Server Action or Route Handler that needs a signed-in user. A page is public when nothing on it calls `requireUser()`.

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
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` | Must match the sign-in page route |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` | Must match the sign-up page route |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | `/` | Redirect after sign in |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | `/` | Redirect after sign up |

## File structure

```
@/lib/auth/clerk/basic-auth/
├── service.ts   # Server-only logic. Do not edit.
├── actions.ts   # Server Actions ("use server")
├── types.ts     # AuthUser, AuthSession, AuthResult<T>
├── client.ts    # Client component/hook re-exports + usage examples
└── SETUP.md

proxy.ts                                 # project root (or src/)
.env.local                               # project root
app/layout.tsx                           # wrapped with <ClerkProvider>
app/sign-in/[[...sign-in]]/page.tsx      # renders <SignIn />
app/sign-up/[[...sign-up]]/page.tsx      # renders <SignUp />
```

## Public API

### `actions.ts` — Server Actions

Import: `@/lib/auth/clerk/basic-auth/actions`. All return `AuthResult<T>`.

| Export | Arguments | Returns |
|---|---|---|
| `getCurrentUserAction` | none | `Promise<AuthResult<AuthUser>>` (`success: false` if no session) |
| `getSessionAction` | none | `Promise<AuthResult<AuthSession>>` (`success: false` if no session) |
| `refreshSessionAction` | none | `Promise<AuthResult<AuthSession>>` — revalidates the session against Clerk's API |
| `signOutAction` | none | `Promise<AuthResult>` — revokes the session server-side |

### `client.ts` — Client components and hooks

Import: `@/lib/auth/clerk/basic-auth/client`. Re-exports from `@clerk/nextjs`.

| Export | Arguments | Returns |
|---|---|---|
| `ClerkProvider` | `{ children }` (+ optional Clerk options) | Provider component. Wrap the app in `app/layout.tsx` |
| `SignIn` | optional Clerk props | Sign-in form component |
| `SignUp` | optional Clerk props | Sign-up form component |
| `Show` | `{ when: "signed-in" \| "signed-out", children, fallback? }` | Renders `children` when the condition matches. Replaces `SignedIn`/`SignedOut`/`Protect` |
| `UserButton` | optional Clerk props | Avatar menu (profile, sign out) |
| `useUser` | none | `{ isLoaded, isSignedIn, user }` |
| `useAuth` | none | `{ isLoaded, isSignedIn, userId, sessionId, signOut, getToken, ... }` |
| `useSession` | none | `{ isLoaded, isSignedIn, session }` |
| `useClerk` | none | Clerk instance (`signOut({ redirectUrl })`, ...) |

### `proxy.ts` — project root

| Export | Arguments | Returns |
|---|---|---|
| `default` | none (`clerkMiddleware()`) | Proxy handler that attaches the Clerk session to each request |
| `config` | — | `{ matcher: string[] }` — skips Next internals and static files, always runs for `/api` and `/trpc` |

### Types (`types.ts`)

```ts
interface AuthUser {
  id: string; email: string;
  firstName: string | null; lastName: string | null;
  imageUrl: string; emailVerified: boolean; createdAt: Date;
}
interface AuthSession {
  sessionId: string; userId: string;
  status: "active" | "expired" | "revoked"; expireAt: Date;
}
type AuthResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };
```

## Examples

**Wrap the app:**

```tsx
// app/layout.tsx
import { ClerkProvider } from "@/lib/auth/clerk/basic-auth/client";

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

**Sign-in / sign-up pages:**

```tsx
// app/sign-in/[[...sign-in]]/page.tsx
import { SignIn } from "@/lib/auth/clerk/basic-auth/client";

export default function SignInPage() {
  return <SignIn />;
}
```

```tsx
// app/sign-up/[[...sign-up]]/page.tsx
import { SignUp } from "@/lib/auth/clerk/basic-auth/client";

export default function SignUpPage() {
  return <SignUp />;
}
```

**Protect a Server Component** (`requireUser` lives in `service.ts`; redirects to `/sign-in` when there is no session):

```tsx
import { requireUser } from "@/lib/auth/clerk/basic-auth/service";

export default async function DashboardPage() {
  const user = await requireUser();
  return <p>Welcome, {user.firstName}</p>;
}
```

**Read the user in a Server Component without forcing a redirect:**

```tsx
import { getCurrentUserAction } from "@/lib/auth/clerk/basic-auth/actions";

export default async function Header() {
  const result = await getCurrentUserAction();
  return <p>{result.success ? result.data.email : "Guest"}</p>;
}
```

**Show content by session state and render the user menu:**

```tsx
import { Show, UserButton } from "@/lib/auth/clerk/basic-auth/client";

<Show when="signed-in"><UserButton /></Show>
<Show when="signed-out"><a href="/sign-in">Sign in</a></Show>
```

**Sign out from a Client Component:**

```tsx
"use client";
import { useClerk } from "@/lib/auth/clerk/basic-auth/client";

export function SignOutButton() {
  const { signOut } = useClerk();
  return <button onClick={() => signOut({ redirectUrl: "/" })}>Sign out</button>;
}
```

**Sign out from the server:**

```tsx
import { redirect } from "next/navigation";
import { signOutAction } from "@/lib/auth/clerk/basic-auth/actions";

<form
  action={async () => {
    "use server";
    await signOutAction();
    redirect("/");
  }}
>
  <button type="submit">Sign out</button>
</form>
```