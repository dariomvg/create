# Auth0 Basic Auth

Authentication for Next.js App Router projects using Auth0 Universal Login (redirect-based, no custom login UI). Provides sign in, sign up, sign out, session access, session refresh, protected Server Components, social login (Google, GitHub, Apple, Facebook), email verification, and forgot/reset password.

Module: `auth` · Provider: `auth0` · Feature: `basic-auth`

## Dependencies

- `next` (16+, uses `proxy.ts`)
- `@auth0/nextjs-auth0` (^4.26.1)
- `server-only`

## Environment variables

Set in `.env.local` at the project root.

| Variable | Required | Description |
|---|---|---|
| `AUTH0_DOMAIN` | Yes | Tenant domain, e.g. `your-tenant.us.auth0.com` (no protocol). |
| `AUTH0_CLIENT_ID` | Yes | Client ID of the Regular Web Application. |
| `AUTH0_CLIENT_SECRET` | Yes | Client secret of the Regular Web Application. |
| `AUTH0_SECRET` | Yes | Random string (32+ bytes, hex) used to encrypt the session cookie. |
| `APP_BASE_URL` | Yes | Public base URL of the app, e.g. `http://localhost:3000`. |
| `AUTH0_SCOPE` | No | Overrides the default scopes. If set, keep `offline_access`, otherwise `refreshSession()` has no refresh token to use. |
| `AUTH0_AUDIENCE` | No | API identifier. Only needed to get an access token for a custom API. |
| `AUTH0_M2M_CLIENT_ID` | Only for `resendVerificationEmail` | Client ID of the Machine-to-Machine app authorized for the Management API. |
| `AUTH0_M2M_CLIENT_SECRET` | Only for `resendVerificationEmail` | Client secret of that M2M app. |

## File structure

```
lib/auth/auth0/basic-auth/
├── types.ts      # Shared types
├── service.ts    # Internal: Auth0Client instance, Authentication/Management API calls, error mapping
├── actions.ts    # "use server": public API for Server Components, Server Actions, Route Handlers
└── client.ts     # Public API for Client Components (navigation helpers)

proxy.ts          # Project root. Calls auth0.middleware(); mounts the SDK auth routes
.env.local        # Project root
```

Routes mounted automatically by the SDK through `proxy.ts` (no `route.ts` exists for them):

| Route | Purpose |
|---|---|
| `/auth/login` | Starts Universal Login. Accepts `returnTo`, `screen_hint=signup`, `connection`. |
| `/auth/logout` | Clears the local session and the Auth0 session. Accepts `returnTo`. |
| `/auth/callback` | Auth0 redirect target after login. |
| `/auth/profile` | Returns the current user as JSON. |

Import paths: `@/lib/auth/auth0/basic-auth/actions`, `@/lib/auth/auth0/basic-auth/client`, `@/lib/auth/auth0/basic-auth/types`. Never import `service.ts` from outside the folder.

## Public API

### `actions.ts` (server)

| Export | Arguments | Returns |
|---|---|---|
| `getUser` | none | `Promise<Auth0User \| null>`. `null` when there is no session. |
| `getSession` | none | `Promise<AuthSession \| null>`. `null` when there is no session. |
| `refreshSession` | none | `Promise<AuthResult<AuthSession>>`. Error code `NO_SESSION` if there is no session. |
| `signOutAction` | `returnTo?: string` (default `"/"`) | Never returns; redirects to `/auth/logout?returnTo=...`. |
| `forgotPassword` | `email: string` | `Promise<AuthResult>`. Error code `INVALID_EMAIL` if the email has no `@`. Sends Auth0's reset email. |
| `resendVerificationEmail` | none (uses the current session user) | `Promise<AuthResult>`. Error code `NO_SESSION` if there is no session. Needs the M2M env vars. |
| `requireAuth` | `returnTo?: string` (default `"/"`) | `Promise<AuthSession>`. Redirects to `/auth/login?returnTo=...` when there is no session. |

### `client.ts` (Client Components)

All functions navigate with `window.location.href` and return `void`.

| Export | Arguments | Behavior |
|---|---|---|
| `signIn` | `options?: SignInOptions` (`{ returnTo?, connection? }`) | Goes to `/auth/login`. |
| `signUp` | `options?: SignUpOptions` (`{ returnTo?, connection? }`) | Goes to `/auth/login` with `screen_hint=signup`. |
| `signInWithOAuth` | `connection: OAuthConnection`, `returnTo?: string` (default `"/"`) | Goes to `/auth/login` with the given social connection. |
| `signOut` | `returnTo?: string` (default `"/"`) | Goes to `/auth/logout`. |

### Types (`types.ts`)

```ts
type OAuthConnection = "google-oauth2" | "github" | "apple" | "facebook";

interface Auth0User {
  sub: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  nickname?: string;
  picture?: string;
  updatedAt?: string;
}

interface AuthSession {
  user: Auth0User;
  accessToken?: string;
  idToken?: string;
  expiresAt: number;
}

type AuthResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: { code: AuthErrorCode; message: string } };

type AuthErrorCode =
  | "NO_SESSION"
  | "INVALID_EMAIL"
  | "USER_NOT_FOUND"
  | "MANAGEMENT_API_ERROR"
  | "AUTH0_API_ERROR"
  | "UNKNOWN_ERROR";
```

Behavior notes:
- Functions that return `AuthResult` do not throw; check `success` before reading `data`.
- Email + password signup/login happens on Auth0's Universal Login page. Reset password also happens on an Auth0-hosted page, reached from the link in the email sent by `forgotPassword`. There is no `resetPassword` function.
- `forgotPassword` targets the database connection named `Username-Password-Authentication`.

## Examples

Protect a Server Component:

```tsx
import { requireAuth } from "@/lib/auth/auth0/basic-auth/actions";

export default async function DashboardPage() {
  const session = await requireAuth("/dashboard");
  return <p>Welcome, {session.user.name}</p>;
}
```

Read the user without redirecting:

```tsx
import { getUser } from "@/lib/auth/auth0/basic-auth/actions";

export default async function Header() {
  const user = await getUser();
  return user ? <p>{user.email}</p> : <a href="/auth/login">Sign in</a>;
}
```

Auth buttons in a Client Component:

```tsx
"use client";
import { signIn, signUp, signInWithOAuth, signOut } from "@/lib/auth/auth0/basic-auth/client";

export function AuthButtons() {
  return (
    <>
      <button onClick={() => signIn({ returnTo: "/dashboard" })}>Sign in</button>
      <button onClick={() => signUp()}>Sign up</button>
      <button onClick={() => signInWithOAuth("google-oauth2", "/dashboard")}>Continue with Google</button>
      <button onClick={() => signOut()}>Sign out</button>
    </>
  );
}
```

Forgot password from a form:

```tsx
import { forgotPassword } from "@/lib/auth/auth0/basic-auth/actions";

async function handleForgotPassword(formData: FormData) {
  "use server";
  const result = await forgotPassword(formData.get("email") as string);
  if (!result.success) {
    console.error(result.error.code, result.error.message);
  }
}
```

Refresh the session and resend the verification email:

```ts
import { refreshSession, resendVerificationEmail } from "@/lib/auth/auth0/basic-auth/actions";

const refreshed = await refreshSession();
if (refreshed.success) {
  console.log(refreshed.data.user.emailVerified);
}

await resendVerificationEmail();
```

## Configuration

Steps in the Auth0 Dashboard that cannot be done from code.

1. Create a **Regular Web Application**. Under *Application URIs* set Allowed Callback URLs to `<APP_BASE_URL>/auth/callback` and Allowed Logout URLs to `<APP_BASE_URL>` (add the production URL too).
2. Enable the `Username-Password-Authentication` database connection on the application. In the connection settings, turn on **Requires Email Verification** if users must verify before first login.
3. Enable the social connections under *Authentication → Social*: Google, GitHub, Apple, Facebook. Each needs its own OAuth credentials from the provider's developer console. The names used by `client.ts` (`google-oauth2`, `github`, `apple`, `facebook`) must match the connection names in Auth0.
4. Sign up, sign in, forgot password, and reset password screens come from New Universal Login. Customize branding under *Branding → Universal Login*.
5. For `resendVerificationEmail`: create a **Machine-to-Machine** application authorized for the **Auth0 Management API** with the `update:users` scope (required by `POST /api/v2/jobs/verification-email`, the endpoint `service.ts` calls), and set its credentials in `AUTH0_M2M_CLIENT_ID` / `AUTH0_M2M_CLIENT_SECRET`.