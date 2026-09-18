'use server';

import * as authService from './service';
import type {
  AuthResult,
  AuthSession,
  AuthUser,
  ForgotPasswordInput,
  OAuthProvider,
  ResetPasswordInput,
  SignInInput,
  SignUpInput,
} from './types';

/**
 * actions.ts — the module's single public server-side API. Anything a
 * Server Component or a form needs from auth goes through here.
 */

export async function signUpAction(
  input: SignUpInput
): Promise<AuthResult<{ userId: string }>> {
  return authService.signUp(input);
}

export async function signInAction(input: SignInInput): Promise<AuthResult<AuthSession>> {
  return authService.signIn(input);
}

export async function signOutAction(): Promise<AuthResult<null>> {
  return authService.signOut();
}

export async function getCurrentUser(): Promise<AuthResult<AuthUser>> {
  return authService.getUser();
}

export async function getCurrentSession(): Promise<AuthResult<AuthSession>> {
  return authService.getSession();
}

export async function forgotPasswordAction(
  input: ForgotPasswordInput
): Promise<AuthResult<null>> {
  return authService.forgotPassword(input);
}

export async function resetPasswordAction(
  input: ResetPasswordInput
): Promise<AuthResult<null>> {
  return authService.resetPassword(input);
}

export async function resendVerificationEmailAction(email: string): Promise<AuthResult<null>> {
  return authService.resendVerificationEmail(email);
}

export async function signInWithOAuthAction(
  provider: OAuthProvider
): Promise<AuthResult<{ url: string }>> {
  return authService.signInWithOAuth(provider);
}

/**
 * Server Component protection: `const user = await requireAuth()`.
 * Redirects to `/login` (or the path you pass in) if there's no session.
 */
export async function requireAuth(redirectTo?: string): Promise<AuthUser> {
  return authService.requireAuth(redirectTo);
}
