# Supabase User Management for Next.js App Router

Self-service user management module: get/update profile, change email, change password, avatar, name, metadata, user preferences, delete own account. Separate from the auth module — self-contained, lives in its own folder.

## Dependencies

- `@supabase/ssr`
- `@supabase/supabase-js`

## Where everything lives

| File | Purpose |
|---|---|
| `types.ts` | Shared types (`UserProfile`, `UserManagementResult<T>`, `UserManagementError`, etc.) |
| `service.ts` | Internal logic — Supabase server client + all user management operations. Not imported outside this module. |
| `actions.ts` | `"use server"` — the public server-side API. Import from here in Server Components / forms. |
| `client.ts` | Browser Supabase client + ready-to-use functions for Client Components. |
| `env.example.md` | Required environment variables. |

No `proxy.ts` and no `route.ts` in this module — route protection is already handled by the auth module's `proxy.ts`, and email-change confirmation reuses the auth module's `app/auth/callback/route.ts` as-is.

## Usage

### Read the current profile (Server Component)

```tsx
import { getCurrentUserProfile } from '@/lib/user-management/supabase/actions';

export default async function AccountPage() {
  const { data: profile } = await getCurrentUserProfile();
  return <p>{profile?.name ?? profile?.email}</p>;
}
```

### Update name / metadata / preferences (Client Component)

```tsx
'use client';
import { updateNameClient, updatePreferencesClient } from '@/lib/user-management/supabase/client';

await updateNameClient('Dari');
await updatePreferencesClient({ theme: 'dark' });
```

### Change password (requires the current password)

```tsx
import { changePasswordAction } from '@/lib/user-management/supabase/actions';

const { error } = await changePasswordAction({ currentPassword, newPassword });
```

### Change email

```tsx
import { changeEmailAction } from '@/lib/user-management/supabase/actions';

await changeEmailAction({ newEmail }); // confirmation email → app/auth/callback/route.ts
```

### Avatar upload (Server Action from a form)

```tsx
import { uploadAvatarAction } from '@/lib/user-management/supabase/actions';

<form action={uploadAvatarAction}>
  <input type="file" name="avatar" accept="image/*" />
  <button type="submit">Upload</button>
</form>
```

### Delete own account

```tsx
import { deleteOwnAccountAction } from '@/lib/user-management/supabase/actions';

await deleteOwnAccountAction(); // signs the user out afterward
```

## Configuration

Steps the CLI can't automate — do these manually in the Supabase dashboard:

1. **Storage bucket**: create a bucket named `avatars` (Storage → New bucket). Make it public if you want `getPublicUrl` to serve images directly, or keep it private and swap `getPublicUrl` for `createSignedUrl` in `service.ts`/`client.ts` if not.
2. **Storage RLS policies** on `avatars`: restrict `insert`/`update`/`delete` to `auth.uid()::text = (storage.foldername(name))[1]` so each user can only write inside their own folder (the module already uploads to `<user_id>/<filename>`).
3. **Service role key**: copy `SUPABASE_SERVICE_ROLE_KEY` from Project Settings → API into `.env.local`. Keep it out of version control and never expose it to the client.
4. **Dependency on the auth module**: this module assumes `app/auth/callback/route.ts` (from the auth boilerplate) already exists in the project — email change confirmations redirect there.

## Scope

Self-service only. No `listUsers`, `searchUsers`, or deleting other users' accounts — those are admin-level operations that would need their own authorization layer, which is out of scope here.
