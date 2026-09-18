# Supabase Auth for Next.js App Router

Complete authentication module for Next.js App Router using Supabase Auth: email/password, email verification, forgot/reset password, and OAuth (Google, GitHub, Apple, Facebook).

## Dependencies

- `@supabase/ssr`
- `@supabase/supabase-js`

## Where everything lives

| File | Purpose |
|---|---|
| `types.ts` | Shared types (`AuthResult<T>`, `AuthUser`, `AuthSession`, `AuthError`, etc.) |
| `service.ts` | Internal logic — Supabase server client + all auth operations. Not imported outside this module. |
| `actions.ts` | `"use server"` — the public server-side API. Import from here in Server Components / forms. |
| `client.ts` | Browser Supabase client + ready-to-use functions for Client Components. |
| `proxy.ts` | Route protection + session refresh on every request. Copy to project root as `proxy.ts`. |
| `routes/route.ts` | OAuth/email-verification/recovery callback handler. Copy to `app/auth/callback/route.ts`. |
| `reset-password.tsx` | Reference page for setting a new password. Copy to `app/reset-password/page.tsx`. |
| `env.example.md` | Required environment variables. |

## Usage

### Sign up (Client Component form)

```tsx
'use client';
import { signUpClient } from '@/lib/auth/supabase/client';

async function handleSignUp(email: string, password: string) {
  const { data, error } = await signUpClient({ email, password });
  if (error) {
    // handle error.code / error.message
  }
}
```

### Protecting a Server Component

```tsx
import { requireAuth } from '@/lib/auth/supabase/actions';

export default async function DashboardPage() {
  const user = await requireAuth(); // redirects to /login if there's no session
  return <p>Welcome, {user.email}</p>;
}
```

### OAuth sign-in button

```tsx
'use client';
import { signInWithOAuthClient } from '@/lib/auth/supabase/client';

<button onClick={() => signInWithOAuthClient('google')}>
  Continue with Google
</button>
```

### Forgot / reset password

```tsx
import { forgotPasswordAction, resetPasswordAction } from '@/lib/auth/supabase/actions';

await forgotPasswordAction({ email }); // sends the recovery email
// user clicks the email link → routes/route.ts exchanges the code → lands on /reset-password
await resetPasswordAction({ newPassword }); // called from reset-password.tsx
```

## Configuration

Steps the CLI can't automate — do these manually in the Supabase dashboard:

1. **Create a Supabase project** and copy the URL + anon key into your `.env.local` (see `env.example.md`).
2. **Email Auth**: in Authentication → Providers → Email, make sure "Confirm email" is enabled. Customize the email templates (Authentication → Email Templates) if you want branded verification/reset emails.
3. **OAuth providers**: for each of Google, GitHub, Apple, Facebook — enable the provider under Authentication → Providers, and register an OAuth app on the provider's own developer console using this redirect URL:
   ```
   <SUPABASE_URL>/auth/v1/callback
   ```
   Then paste the resulting client ID/secret back into the Supabase provider config.
4. **Redirect URLs**: under Authentication → URL Configuration, add your site URL and `<SITE_URL>/auth/callback` to the allow list (needed in both dev and prod).
5. **Copy `proxy.ts`** to the project root.
6. **Copy `routes/route.ts`** to `app/auth/callback/route.ts`.
7. **Copy `reset-password.tsx`** to `app/reset-password/page.tsx`.

## Scope

No roles/permissions, no organizations — single user type, by design.
