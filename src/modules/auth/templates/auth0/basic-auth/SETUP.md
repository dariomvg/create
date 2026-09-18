# Auth0 Authentication Module

Drop-in authentication for a Next.js App Router project, built on
`@auth0/nextjs-auth0` v4 and Auth0's Universal Login. Covers sign up, sign
in, sign out, session access, protected Server Components, social login
(Google, GitHub, Apple, Facebook), email verification, and forgot/reset
password.

## Dependencies

- `@auth0/nextjs-auth0` (^4.26.1 or newer)

## File map

| File | Where it's used | What it's for |
|---|---|---|
| `types.ts` | anywhere | Shared types (`Auth0User`, `AuthSession`, `AuthResult`, etc.) |
| `service.ts` | internal only | Auth0Client instance, raw API calls, error normalization. Never import directly. |
| `actions.ts` | Server Components / Server Actions | `"use server"` — the only server-side entry point |
| `client.ts` | Client Components | Navigation helpers for buttons/forms (`signIn`, `signUp`, `signOut`, `signInWithOAuth`) |
| `proxy.ts` | project root | Request interception boundary; mounts `/auth/*` routes |
| `.env.local` | project root | Environment variables |

## Usage

### Protecting a Server Component

```tsx
import { requireAuth } from "@/lib/auth0/actions";

export default async function DashboardPage() {
  const session = await requireAuth("/dashboard");
  return <p>Welcome, {session.user.name}</p>;
}
```

### Reading the session without redirecting

```tsx
import { getUser } from "@/lib/auth0/actions";

export default async function Header() {
  const user = await getUser();
  return user ? <p>{user.email}</p> : <a href="/auth/login">Sign in</a>;
}
```

### Sign in / sign up / sign out buttons (Client Component)

```tsx
"use client";
import { signIn, signUp, signOut, signInWithOAuth } from "@/lib/auth0/client";

export function AuthButtons() {
  return (
    <>
      <button onClick={() => signIn()}>Sign in</button>
      <button onClick={() => signUp()}>Sign up</button>
      <button onClick={() => signInWithOAuth("google-oauth2")}>Continue with Google</button>
      <button onClick={() => signOut()}>Sign out</button>
    </>
  );
}
```

### Forgot password (Server Action from a form)

```tsx
import { forgotPassword } from "@/lib/auth0/actions";

async function handleForgotPassword(formData: FormData) {
  "use server";
  const email = formData.get("email") as string;
  const result = await forgotPassword(email);
  if (!result.success) {
    // handle result.error
  }
}
```

Auth0 hosts the actual "set a new password" screen — the email sent by
`forgotPassword()` links straight to it. This module doesn't implement its
own reset-password page.

### Refreshing the session

```ts
import { refreshSession } from "@/lib/auth0/actions";

const result = await refreshSession();
if (result.success) {
  // result.data is the refreshed AuthSession
}
```

## Configuration

Code alone isn't enough — these steps happen in the Auth0 Dashboard.

1. **Create a Regular Web Application** in your Auth0 tenant.
2. Under **Application URIs**, set:
   - Allowed Callback URLs: `http://localhost:3000/auth/callback` (+ your production URL)
   - Allowed Logout URLs: `http://localhost:3000` (+ your production URL)
3. **Database connection (email + password)**: enable the
   `Username-Password-Authentication` connection on this application.
   Under the connection's settings, turn on **"Requires Email
   Verification"** if you want new users to verify before first login.
4. **Social connections**: enable and configure Google, GitHub, Apple, and
   Facebook under *Authentication → Social*. Each requires its own OAuth
   credentials (Client ID/Secret) from the respective provider's developer
   console. The connection names used in `client.ts` (`google-oauth2`,
   `github`, `apple`, `facebook`) must match what Auth0 assigns —
   double-check under each connection's settings page.
5. **Universal Login**: no custom UI is needed. Auth0's New Universal
   Login already includes sign up, sign in, forgot password, and reset
   password screens. Customize branding under *Branding → Universal
   Login* if needed.
6. **(Optional) Machine-to-Machine app for `resendVerificationEmail()`**:
   create an M2M application authorized for the **Auth0 Management API**
   with the `create:user_tickets` scope. Use its credentials for
   `AUTH0_M2M_CLIENT_ID` / `AUTH0_M2M_CLIENT_SECRET`. Skip this step (and
   remove `resendVerificationEmail` from `actions.ts`) if you're fine
   relying on the automatic verification email Auth0 sends at signup.
7. Copy `proxy.ts` to your project root (next to `package.json`), and
   adjust the import path if your module isn't at `lib/auth0`.
