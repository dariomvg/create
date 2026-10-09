# Supabase Basic Auth for Next.js App Router

## Description

Email/password authentication for Next.js App Router using Supabase Auth: sign up, sign in, sign out, current user and session, email verification, forgot/reset password, and OAuth sign-in (Google, GitHub, Apple, Facebook). Sessions persist in cookies and are refreshed on every request by `proxy.ts`, which also redirects unauthenticated users away from protected routes. Server Components are protected with `requireAuth()`.

Every function returns an `AuthResult<T>` (`{ data, error }`) instead of throwing, except `requireAuth`, which redirects.

## Dependencies

- `@supabase/ssr`
- `@supabase/supabase-js`
- `server-only`

## Environment variables

| Variable | Exposed to client | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL (Project Settings → API). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Supabase anon (public) key (Project Settings → API). |
| `NEXT_PUBLIC_SITE_URL` | yes | Public base URL of the app (e.g. `http://localhost:3000`). Used to build the redirect URLs for OAuth, email verification and forgot password. Both this URL and `<NEXT_PUBLIC_SITE_URL>/auth/callback` must be in Supabase's Redirect URLs allow list (Authentication → URL Configuration). |

## File structure

```
@/lib/auth/supabase/basic-auth/
├── types.ts      # Shared types
├── service.ts    # Internal logic (Supabase server client + auth operations)
├── actions.ts    # "use server" — public server-side API
└── client.ts     # "use client" — browser Supabase client + Client Component helpers

proxy.ts                         # project root — session refresh + route protection
app/auth/callback/route.ts       # GET handler: OAuth, email verification and password recovery callback
app/reset-password/page.tsx      # Client page where the user sets a new password
.env.local                       # project root — environment variables
```

- `proxy.ts` is self-contained (imports nothing from the module). Edit the `PROTECTED_PATHS` constant (default `['/dashboard']`) to choose which routes require a session, and `AUTH_ONLY_PATHS` (default `['/login', '/signup']`) for routes that redirect to `/dashboard` when already signed in. Unauthenticated access to a protected path redirects to `/login?next=<path>`.
- `app/auth/callback/route.ts` exchanges the `code` query param for a session (`exchangeCodeForSession`) and redirects to the `next` query param (default `/dashboard`). On failure it redirects to `/login?error=missing_code` or `/login?error=auth_callback_failed`.
- `app/reset-password/page.tsx` is reached from the forgot-password email (`/auth/callback?next=/reset-password`), so the user arrives with an active recovery session. It calls `resetPasswordAction` and, on success, redirects to `/login?reset=success`.
- The module expects the app to provide `/login` and `/signup` pages.

## Public API

### `actions.ts` (`"use server"`)

| Export | Arguments | Returns |
|---|---|---|
| `signUpAction` | `input: { email: string; password: string }` | `Promise<AuthResult<{ userId: string }>>`. Sends the verification email (redirects to `/auth/callback`). |
| `signInAction` | `input: { email: string; password: string }` | `Promise<AuthResult<AuthSession>>`. Sets the session cookies. |
| `signOutAction` | none | `Promise<AuthResult<null>>`. Clears the session cookies. |
| `getCurrentUser` | none | `Promise<AuthResult<AuthUser>>`. Validated against the Supabase server (safe for access checks). |
| `getCurrentSession` | none | `Promise<AuthResult<AuthSession>>`. Read from cookies, not re-validated; do not use it for access checks. |
| `forgotPasswordAction` | `input: { email: string }` | `Promise<AuthResult<null>>`. Sends the recovery email (link goes through `/auth/callback?next=/reset-password`). |
| `resetPasswordAction` | `input: { newPassword: string }` | `Promise<AuthResult<null>>`. Requires the active recovery session created by the email link. |
| `resendVerificationEmailAction` | `email: string` | `Promise<AuthResult<null>>`. |
| `signInWithOAuthAction` | `provider: 'google' \| 'github' \| 'apple' \| 'facebook'` | `Promise<AuthResult<{ url: string }>>`. The caller must navigate to `url`. The provider must be enabled in the Supabase dashboard. |
| `requireAuth` | `redirectTo?: string` (default `'/login'`) | `Promise<AuthUser>`. Redirects to `redirectTo` if there is no valid session; otherwise returns the user. Use in Server Components. |

### `client.ts` (`"use client"`)

| Export | Arguments | Returns |
|---|---|---|
| `createClient` | none | Browser Supabase client (`createBrowserClient`). |
| `signUpClient` | `input: { email: string; password: string }` | `Promise<AuthResult<{ userId: string }>>`. Sends the verification email. |
| `signInClient` | `input: { email: string; password: string }` | `Promise<AuthResult<AuthSession>>`. |
| `signOutClient` | none | `Promise<AuthResult<null>>`. |
| `signInWithOAuthClient` | `provider: 'google' \| 'github' \| 'apple' \| 'facebook'` | `Promise<void>`. Redirects the browser to the provider; nothing useful is returned. |
| `onAuthStateChange` | `callback: (session: AuthSession \| null) => void` | `() => void` — call it to unsubscribe. |

### Shared types

```ts
type AuthResult<T> = { data: T; error: null } | { data: null; error: AuthError };

interface AuthError { code: AuthErrorCode; message: string }

type AuthErrorCode =
  | 'invalid_credentials' | 'email_not_verified' | 'user_already_exists'
  | 'weak_password' | 'invalid_email' | 'oauth_error' | 'session_expired'
  | 'no_session' | 'same_password' | 'rate_limited' | 'unknown';

interface AuthUser { id: string; email: string | null; emailVerified: boolean; createdAt: string }

interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number | null;
  user: AuthUser;
}
```

## Examples

### Sign up (Client Component)

```tsx
'use client';
import { signUpClient } from '@/lib/auth/supabase/basic-auth/client';

const { data, error } = await signUpClient({ email, password });
if (error) {
  // error.code === 'user_already_exists' | 'weak_password' | ...
}
// data.userId — the user must confirm their email before signing in
```

### Sign in (Server Action called from a Client Component)

```tsx
'use client';
import { useRouter } from 'next/navigation';
import { signInAction } from '@/lib/auth/supabase/basic-auth/actions';

const router = useRouter();
const { error } = await signInAction({ email, password });
if (error) {
  // error.code === 'invalid_credentials' | 'email_not_verified' | ...
} else {
  router.push('/dashboard');
}
```

### OAuth

```tsx
'use client';
import { signInWithOAuthClient } from '@/lib/auth/supabase/basic-auth/client';

<button onClick={() => signInWithOAuthClient('google')}>Continue with Google</button>
```

Or through a Server Action, navigating to the returned URL:

```tsx
import { signInWithOAuthAction } from '@/lib/auth/supabase/basic-auth/actions';

const { data } = await signInWithOAuthAction('github');
if (data) window.location.href = data.url;
```

### Protect a Server Component

```tsx
import { requireAuth } from '@/lib/auth/supabase/basic-auth/actions';

export default async function DashboardPage() {
  const user = await requireAuth(); // redirects to /login if there is no session
  return <p>Welcome, {user.email}</p>;
}
```

### Read the current user without redirecting

```tsx
import { getCurrentUser } from '@/lib/auth/supabase/basic-auth/actions';

const { data: user } = await getCurrentUser();
```

### Sign out

```tsx
'use client';
import { signOutAction } from '@/lib/auth/supabase/basic-auth/actions';

await signOutAction();
```

### Forgot / reset password

```tsx
import {
  forgotPasswordAction,
  resetPasswordAction,
} from '@/lib/auth/supabase/basic-auth/actions';

await forgotPasswordAction({ email });
// The email link goes through /auth/callback and lands on /reset-password,
// where app/reset-password/page.tsx calls:
await resetPasswordAction({ newPassword });
```

### Resend the verification email

```tsx
import { resendVerificationEmailAction } from '@/lib/auth/supabase/basic-auth/actions';

await resendVerificationEmailAction(email);
```

### Listen to session changes (Client Component)

```tsx
'use client';
import { useEffect, useState } from 'react';
import { onAuthStateChange } from '@/lib/auth/supabase/basic-auth/client';
import type { AuthSession } from '@/lib/auth/supabase/basic-auth/types';

const [session, setSession] = useState<AuthSession | null>(null);

useEffect(() => onAuthStateChange(setSession), []);
```