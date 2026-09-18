import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type {
  ChangeEmailInput,
  ChangePasswordInput,
  UpdateProfileInput,
  UserManagementError,
  UserManagementErrorCode,
  UserManagementResult,
  UserProfile,
} from './types';

/**
 * service.ts — internal logic for the user management module. Self-contained
 * on purpose (doesn't import from the auth module) so this boilerplate can be
 * dropped into a project independently, in its own folder.
 */

async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component without cookie write permission.
          }
        },
      },
    }
  );
}

/**
 * Admin client (service_role key). Used ONLY by `deleteOwnAccount` below —
 * never exposed as a general-purpose export, and never called with a
 * user-supplied id. See the note on `deleteOwnAccount`.
 */
function createAdminClient() {
  return createSupabaseAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function mapError(rawMessage?: string, rawCode?: string): UserManagementError {
  const codeMap: Record<string, UserManagementErrorCode> = {
    invalid_credentials: 'invalid_credentials',
    email_exists: 'email_already_in_use',
    email_address_invalid: 'invalid_email',
    weak_password: 'weak_password',
    same_password: 'same_password',
    over_request_rate_limit: 'rate_limited',
    session_not_found: 'no_session',
  };

  return {
    code: codeMap[rawCode ?? ''] ?? 'unknown',
    message: rawMessage ?? 'Ocurrió un error inesperado.',
  };
}

function toUserProfile(user: {
  id: string;
  email?: string | null;
  created_at: string;
  user_metadata?: Record<string, unknown>;
}): UserProfile {
  const metadata = user.user_metadata ?? {};
  const { name, avatar_url, preferences, ...rest } = metadata as {
    name?: string;
    avatar_url?: string;
    preferences?: Record<string, unknown>;
    [key: string]: unknown;
  };

  return {
    id: user.id,
    email: user.email ?? null,
    name: name ?? null,
    avatarUrl: avatar_url ?? null,
    metadata: rest,
    preferences: preferences ?? {},
    createdAt: user.created_at,
  };
}

export async function getProfile(): Promise<UserManagementResult<UserProfile>> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return { data: null, error: mapError(error?.message, error?.code ?? 'session_not_found') };
  }

  return { data: toUserProfile(data.user), error: null };
}

export async function updateProfile(
  input: UpdateProfileInput
): Promise<UserManagementResult<UserProfile>> {
  const supabase = await createClient();
  const { data: current, error: getError } = await supabase.auth.getUser();

  if (getError || !current.user) {
    return { data: null, error: mapError(getError?.message, getError?.code ?? 'session_not_found') };
  }

  const currentMetadata = (current.user.user_metadata ?? {}) as Record<string, unknown>;
  const currentPreferences = (currentMetadata.preferences ?? {}) as Record<string, unknown>;

  const nextMetadata: Record<string, unknown> = {
    ...currentMetadata,
    ...input.metadata,
  };

  if (input.name !== undefined) nextMetadata.name = input.name;
  if (input.avatarUrl !== undefined) nextMetadata.avatar_url = input.avatarUrl;
  if (input.preferences) {
    nextMetadata.preferences = { ...currentPreferences, ...input.preferences };
  }

  const { data, error } = await supabase.auth.updateUser({ data: nextMetadata });

  if (error || !data.user) {
    return { data: null, error: mapError(error?.message, error?.code) };
  }

  return { data: toUserProfile(data.user), error: null };
}

export async function updateName(name: string): Promise<UserManagementResult<UserProfile>> {
  return updateProfile({ name });
}

export async function updateAvatar(avatarUrl: string): Promise<UserManagementResult<UserProfile>> {
  return updateProfile({ avatarUrl });
}

export async function updateMetadata(
  metadata: Record<string, unknown>
): Promise<UserManagementResult<UserProfile>> {
  return updateProfile({ metadata });
}

export async function updatePreferences(
  preferences: Record<string, unknown>
): Promise<UserManagementResult<UserProfile>> {
  return updateProfile({ preferences });
}

/**
 * Triggers Supabase's email change confirmation flow. Reuses the auth
 * module's `app/auth/callback/route.ts` — this module assumes that route
 * already exists in the consuming project.
 */
export async function changeEmail(input: ChangeEmailInput): Promise<UserManagementResult<null>> {
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser(
    { email: input.newEmail },
    { emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback` }
  );

  if (error) {
    return { data: null, error: mapError(error.message, error.code) };
  }

  return { data: null, error: null };
}

export async function changePassword(
  input: ChangePasswordInput
): Promise<UserManagementResult<null>> {
  const supabase = await createClient();
  const { data: current, error: getError } = await supabase.auth.getUser();

  if (getError || !current.user?.email) {
    return { data: null, error: mapError(getError?.message, getError?.code ?? 'session_not_found') };
  }

  // Re-authenticate with the current password before allowing the change.
  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: current.user.email,
    password: input.currentPassword,
  });

  if (reauthError) {
    return { data: null, error: mapError(reauthError.message, 'invalid_credentials') };
  }

  const { error } = await supabase.auth.updateUser({ password: input.newPassword });

  if (error) {
    return { data: null, error: mapError(error.message, error.code) };
  }

  return { data: null, error: null };
}

/**
 * Deletes the currently authenticated user's own account. This needs the
 * service_role key because the client SDK has no self-delete endpoint — but
 * it always operates on the id from the caller's own verified session, never
 * a user-supplied id, so it stays a genuinely "self" operation despite using
 * the admin client internally.
 */
export async function deleteOwnAccount(): Promise<UserManagementResult<null>> {
  const supabase = await createClient();
  const { data, error: getError } = await supabase.auth.getUser();

  if (getError || !data.user) {
    return { data: null, error: mapError(getError?.message, getError?.code ?? 'session_not_found') };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(data.user.id);

  if (error) {
    return { data: null, error: mapError(error.message, error.code) };
  }

  await supabase.auth.signOut();

  return { data: null, error: null };
}

export async function uploadAvatar(
  file: File
): Promise<UserManagementResult<{ url: string }>> {
  const supabase = await createClient();
  const { data: current, error: getError } = await supabase.auth.getUser();

  if (getError || !current.user) {
    return { data: null, error: mapError(getError?.message, getError?.code ?? 'session_not_found') };
  }

  const filePath = `${current.user.id}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, file, { upsert: true });

  if (uploadError) {
    return { data: null, error: { code: 'upload_failed', message: uploadError.message } };
  }

  const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(filePath);

  return { data: { url: publicUrlData.publicUrl }, error: null };
}
