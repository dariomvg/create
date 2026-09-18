/**
 * Shared types for the Supabase user management module.
 * Consumed via `actions.ts` (Server Components/Actions) and `client.ts` (Client Components).
 */

export type UserManagementErrorCode =
  | 'no_session'
  | 'invalid_credentials'
  | 'email_already_in_use'
  | 'invalid_email'
  | 'weak_password'
  | 'same_password'
  | 'upload_failed'
  | 'rate_limited'
  | 'unknown';

export interface UserManagementError {
  code: UserManagementErrorCode;
  message: string;
}

export type UserManagementResult<T> =
  | { data: T; error: null }
  | { data: null; error: UserManagementError };

export type UserMetadata = Record<string, unknown>;
export type UserPreferences = Record<string, unknown>;

export interface UserProfile {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  metadata: UserMetadata;
  preferences: UserPreferences;
  createdAt: string;
}

export interface UpdateProfileInput {
  name?: string;
  avatarUrl?: string;
  metadata?: UserMetadata;
  preferences?: UserPreferences;
}

export interface ChangeEmailInput {
  newEmail: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}
