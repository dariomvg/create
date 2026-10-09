# Supabase User Management for Next.js App Router

## Description

Self-service user management for Next.js App Router using Supabase Auth: read the current profile, update name, avatar, metadata and preferences, change email, change password, upload an avatar, and delete the account. Every operation acts only on the signed-in user, resolved from the session cookies.

Profile data is stored in Supabase's `user_metadata`. The keys `name`, `avatar_url` and `preferences` are reserved: they are exposed as `name`, `avatarUrl` and `preferences` on `UserProfile`, and `UserProfile.metadata` contains every other key.

Every function returns a `UserManagementResult<T>` (`{ data, error }`) instead of throwing.

## Dependencies

- `@supabase/ssr`
- `@supabase/supabase-js`
- `server-only`

## Environment variables

| Variable | Exposed to client | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL (Project Settings → API). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Supabase anon (public) key (Project Settings → API). |
| `NEXT_PUBLIC_SITE_URL` | yes | Public base URL of the app (e.g. `http://localhost:3000`). Used for the email change confirmation redirect (`<NEXT_PUBLIC_SITE_URL>/auth/callback`), which must be in Supabase's Redirect URLs allow list (Authentication → URL Configuration). |
| `SUPABASE_SERVICE_ROLE_KEY` | **no — server only** | Supabase service role key (Project Settings → API). Never prefix it with `NEXT_PUBLIC_`. Used only by `deleteOwnAccountAction`, and only to delete the id of the caller's own verified session. |

## File structure

```
@/lib/auth/supabase/user-management/
├── types.ts      # Shared types
├── service.ts    # Internal logic (Supabase server client + user operations)
├── actions.ts    # "use server" — public server-side API
└── client.ts     # "use client" — browser Supabase client + Client Component helpers

app/auth/callback/route.ts       # must exist: the email change confirmation link redirects to /auth/callback
.env.local                       # project root — environment variables
```

- Avatars are uploaded to a Supabase Storage bucket named `avatars`, under `<user_id>/<timestamp>-<file name>`. The bucket must exist and be public (the public URL is saved in the profile), with RLS policies that let each user write only inside their own `<user_id>/` folder.
- Email change confirmation: Supabase emails a link that redirects to `/auth/callback`, so the route handler at `app/auth/callback/route.ts` must be present.

## Public API

### `actions.ts` (`"use server"`)

| Export | Arguments | Returns |
|---|---|---|
| `getCurrentUserProfile` | none | `Promise<UserManagementResult<UserProfile>>` |
| `updateProfileAction` | `input: { name?: string; avatarUrl?: string; metadata?: Record<string, unknown>; preferences?: Record<string, unknown> }` | `Promise<UserManagementResult<UserProfile>>`. Only the provided fields change. `metadata` and `preferences` are shallow-merged into the existing values. |
| `updateNameAction` | `name: string` | `Promise<UserManagementResult<UserProfile>>` |
| `updateAvatarAction` | `avatarUrl: string` | `Promise<UserManagementResult<UserProfile>>`. Saves a URL; it does not upload a file. |
| `updateMetadataAction` | `metadata: Record<string, unknown>` | `Promise<UserManagementResult<UserProfile>>`. Shallow-merged into the existing metadata. |
| `updatePreferencesAction` | `preferences: Record<string, unknown>` | `Promise<UserManagementResult<UserProfile>>`. Shallow-merged into the existing preferences. |
| `changeEmailAction` | `input: { newEmail: string }` | `Promise<UserManagementResult<null>>`. Sends a confirmation email; the email changes once the user confirms. |
| `changePasswordAction` | `input: { currentPassword: string; newPassword: string }` | `Promise<UserManagementResult<null>>`. Verifies `currentPassword` first; fails with `invalid_credentials` if it is wrong. |
| `deleteOwnAccountAction` | none | `Promise<UserManagementResult<null>>`. Permanently deletes the caller's account and signs them out. |
| `uploadAvatarAction` | `formData: FormData` with a `File` under the `avatar` key | `Promise<UserManagementResult<UserProfile>>`. Uploads the file to the `avatars` bucket and saves its public URL in the profile in one step. |

### `client.ts` (`"use client"`)

| Export | Arguments | Returns |
|---|---|---|
| `createClient` | none | Browser Supabase client (`createBrowserClient`). |
| `getCurrentUserProfileClient` | none | `Promise<UserManagementResult<UserProfile>>` |
| `updateNameClient` | `name: string` | `Promise<UserManagementResult<UserProfile>>` |
| `updateMetadataClient` | `metadata: Record<string, unknown>` | `Promise<UserManagementResult<UserProfile>>`. Shallow-merged into the existing metadata. |
| `updatePreferencesClient` | `preferences: Record<string, unknown>` | `Promise<UserManagementResult<UserProfile>>`. Shallow-merged into the existing preferences. |
| `uploadAvatarClient` | `file: File` | `Promise<UserManagementResult<{ url: string }>>`. Uploads to the `avatars` bucket but does not save the URL; follow it with `updateAvatarAction(url)`. |
| `changeEmailClient` | `input: { newEmail: string }` | `Promise<UserManagementResult<null>>`. Sends a confirmation email. |
| `changePasswordClient` | `input: { currentPassword: string; newPassword: string }` | `Promise<UserManagementResult<null>>`. Verifies `currentPassword` first. |

Error codes returned by `client.ts` are coarser than those from `actions.ts`: only `no_session`, `upload_failed`, `invalid_credentials` (wrong current password) and `unknown` are used.

### Shared types

```ts
type UserManagementResult<T> =
  | { data: T; error: null }
  | { data: null; error: UserManagementError };

interface UserManagementError { code: UserManagementErrorCode; message: string }

type UserManagementErrorCode =
  | 'no_session' | 'invalid_credentials' | 'email_already_in_use' | 'invalid_email'
  | 'weak_password' | 'same_password' | 'upload_failed' | 'rate_limited' | 'unknown';

interface UserProfile {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  metadata: Record<string, unknown>;     // every user_metadata key except name, avatar_url, preferences
  preferences: Record<string, unknown>;
  createdAt: string;
}
```

## Examples

### Read the profile (Server Component)

```tsx
import { getCurrentUserProfile } from '@/lib/auth/supabase/user-management/actions';

export default async function AccountPage() {
  const { data: profile, error } = await getCurrentUserProfile();
  if (error) return <p>{error.message}</p>;
  return <p>{profile.name ?? profile.email}</p>;
}
```

### Update name and preferences (Client Component)

```tsx
'use client';
import {
  updateNameClient,
  updatePreferencesClient,
} from '@/lib/auth/supabase/user-management/client';

await updateNameClient('Dari');
await updatePreferencesClient({ theme: 'dark', language: 'es' });
```

### Update several fields at once (Server Action)

```tsx
import { updateProfileAction } from '@/lib/auth/supabase/user-management/actions';

await updateProfileAction({
  name: 'Dari',
  metadata: { company: 'Acme' },
  preferences: { theme: 'dark' },
});
```

### Upload an avatar (Server Action, one step)

```tsx
'use client';
import { uploadAvatarAction } from '@/lib/auth/supabase/user-management/actions';

async function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
  const file = event.target.files?.[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('avatar', file);

  const { data: profile, error } = await uploadAvatarAction(formData);
  // profile.avatarUrl — public URL of the uploaded image
}
```

### Upload an avatar directly from the browser

```tsx
'use client';
import { uploadAvatarClient } from '@/lib/auth/supabase/user-management/client';
import { updateAvatarAction } from '@/lib/auth/supabase/user-management/actions';

const { data, error } = await uploadAvatarClient(file);
if (data) await updateAvatarAction(data.url);
```

### Change email

```tsx
import { changeEmailAction } from '@/lib/auth/supabase/user-management/actions';

const { error } = await changeEmailAction({ newEmail });
// The new email takes effect after the user clicks the confirmation link.
```

### Change password

```tsx
import { changePasswordAction } from '@/lib/auth/supabase/user-management/actions';

const { error } = await changePasswordAction({ currentPassword, newPassword });
if (error?.code === 'invalid_credentials') {
  // current password is wrong
}
```

### Delete the account

```tsx
'use client';
import { useRouter } from 'next/navigation';
import { deleteOwnAccountAction } from '@/lib/auth/supabase/user-management/actions';

const router = useRouter();
const { error } = await deleteOwnAccountAction();
if (!error) router.push('/');
```