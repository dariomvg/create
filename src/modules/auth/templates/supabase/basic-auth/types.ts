/**
 * Shared types for the Supabase auth module.
 * Consumed via `actions.ts` (Server Components/Actions) and `client.ts` (Client Components).
 */

export type AuthErrorCode =
  | 'invalid_credentials'
  | 'email_not_verified'
  | 'user_already_exists'
  | 'weak_password'
  | 'invalid_email'
  | 'oauth_error'
  | 'session_expired'
  | 'no_session'
  | 'same_password'
  | 'rate_limited'
  | 'unknown';

export interface AuthError {
  code: AuthErrorCode;
  message: string;
}

export type AuthResult<T> = { data: T; error: null } | { data: null; error: AuthError };

export interface AuthUser {
  id: string;
  email: string | null;
  emailVerified: boolean;
  createdAt: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number | null;
  user: AuthUser;
}

export type OAuthProvider = 'google' | 'github' | 'apple' | 'facebook';

export interface SignUpInput {
  email: string;
  password: string;
}

export interface SignInInput {
  email: string;
  password: string;
}

export interface ForgotPasswordInput {
  email: string;
}

export interface ResetPasswordInput {
  newPassword: string;
}
