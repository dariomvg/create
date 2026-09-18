'use client';

import { createBrowserClient } from '@supabase/ssr';
import type {
  ChangeEmailInput,
  ChangePasswordInput,
  UserManagementResult,
  UserProfile,
} from './types';

/**
 * client.ts — browser Supabase client + ready-to-import functions for
 * Client Components. For Server Components/Server Actions use `actions.ts`.
 * `deleteOwnAccount` is intentionally NOT here — it needs the service_role
 * key and only lives server-side in `actions.ts`.
 */

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
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

export async function getCurrentUserProfileClient(): Promise<UserManagementResult<UserProfile>> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return {
      data: null,
      error: { code: 'no_session', message: error?.message ?? 'No hay sesión activa.' },
    };
  }

  return { data: toUserProfile(data.user), error: null };
}

async function updateMetadataInternal(
  patch: Record<string, unknown>
): Promise<UserManagementResult<UserProfile>> {
  const supabase = createClient();
  const { data: current, error: getError } = await supabase.auth.getUser();

  if (getError || !current.user) {
    return {
      data: null,
      error: { code: 'no_session', message: getError?.message ?? 'No hay sesión activa.' },
    };
  }

  const nextMetadata = { ...(current.user.user_metadata ?? {}), ...patch };
  const { data, error } = await supabase.auth.updateUser({ data: nextMetadata });

  if (error || !data.user) {
    return {
      data: null,
      error: { code: 'unknown', message: error?.message ?? 'No se pudo actualizar el perfil.' },
    };
  }

  return { data: toUserProfile(data.user), error: null };
}

export async function updateNameClient(name: string): Promise<UserManagementResult<UserProfile>> {
  return updateMetadataInternal({ name });
}

export async function updateMetadataClient(
  metadata: Record<string, unknown>
): Promise<UserManagementResult<UserProfile>> {
  return updateMetadataInternal(metadata);
}

export async function updatePreferencesClient(
  preferences: Record<string, unknown>
): Promise<UserManagementResult<UserProfile>> {
  const supabase = createClient();
  const { data: current, error: getError } = await supabase.auth.getUser();

  if (getError || !current.user) {
    return {
      data: null,
      error: { code: 'no_session', message: getError?.message ?? 'No hay sesión activa.' },
    };
  }

  const currentPreferences = (current.user.user_metadata?.preferences ?? {}) as Record<
    string,
    unknown
  >;

  return updateMetadataInternal({ preferences: { ...currentPreferences, ...preferences } });
}

/**
 * Uploads directly to Storage from the browser (the `avatars` bucket's RLS
 * should restrict each user to writing only their own path). Persist the
 * resulting URL afterward with `updateAvatarAction` from `actions.ts`.
 */
export async function uploadAvatarClient(
  file: File
): Promise<UserManagementResult<{ url: string }>> {
  const supabase = createClient();
  const { data: current, error: getError } = await supabase.auth.getUser();

  if (getError || !current.user) {
    return {
      data: null,
      error: { code: 'no_session', message: getError?.message ?? 'No hay sesión activa.' },
    };
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

export async function changeEmailClient(
  input: ChangeEmailInput
): Promise<UserManagementResult<null>> {
  const supabase = createClient();
  const { error } = await supabase.auth.updateUser(
    { email: input.newEmail },
    { emailRedirectTo: `${window.location.origin}/auth/callback` }
  );

  if (error) {
    return { data: null, error: { code: 'unknown', message: error.message } };
  }

  return { data: null, error: null };
}

export async function changePasswordClient(
  input: ChangePasswordInput
): Promise<UserManagementResult<null>> {
  const supabase = createClient();
  const { data: current, error: getError } = await supabase.auth.getUser();

  if (getError || !current.user?.email) {
    return {
      data: null,
      error: { code: 'no_session', message: getError?.message ?? 'No hay sesión activa.' },
    };
  }

  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: current.user.email,
    password: input.currentPassword,
  });

  if (reauthError) {
    return { data: null, error: { code: 'invalid_credentials', message: reauthError.message } };
  }

  const { error } = await supabase.auth.updateUser({ password: input.newPassword });

  if (error) {
    return { data: null, error: { code: 'unknown', message: error.message } };
  }

  return { data: null, error: null };
}
