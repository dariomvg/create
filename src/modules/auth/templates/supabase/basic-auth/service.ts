import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type {
  AuthError,
  AuthErrorCode,
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
 * service.ts — internal auth module logic. Never imported outside this
 * directory; all external consumption goes through `actions.ts` (server) or `client.ts` (browser).
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
            // proxy.ts handles refreshing the session in that case.
          }
        },
      },
    }
  );
}

function mapAuthError(rawMessage?: string, rawCode?: string): AuthError {
  const codeMap: Record<string, AuthErrorCode> = {
    invalid_credentials: 'invalid_credentials',
    email_not_confirmed: 'email_not_verified',
    user_already_exists: 'user_already_exists',
    weak_password: 'weak_password',
    email_address_invalid: 'invalid_email',
    same_password: 'same_password',
    over_request_rate_limit: 'rate_limited',
    session_not_found: 'no_session',
  };

  return {
    code: codeMap[rawCode ?? ''] ?? 'unknown',
    message: rawMessage ?? 'Ocurrió un error inesperado.',
  };
}

function toAuthUser(user: {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
  created_at: string;
}): AuthUser {
  return {
    id: user.id,
    email: user.email ?? null,
    emailVerified: Boolean(user.email_confirmed_at),
    createdAt: user.created_at,
  };
}

function toAuthSession(session: {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  user: Parameters<typeof toAuthUser>[0];
}): AuthSession {
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at ?? null,
    user: toAuthUser(session.user),
  };
}

export async function signUp(input: SignUpInput): Promise<AuthResult<{ userId: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback` },
  });

  if (error || !data.user) {
    return { data: null, error: mapAuthError(error?.message, error?.code) };
  }

  return { data: { userId: data.user.id }, error: null };
}

export async function signIn(input: SignInInput): Promise<AuthResult<AuthSession>> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });

  if (error || !data.session) {
    return { data: null, error: mapAuthError(error?.message, error?.code) };
  }

  return { data: toAuthSession(data.session), error: null };
}

export async function signOut(): Promise<AuthResult<null>> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    return { data: null, error: mapAuthError(error.message, error.code) };
  }

  return { data: null, error: null };
}

/**
 * Validates the session against the Supabase server. ALWAYS use this function
 * (not `getSession()`) to protect routes or Server Components.
 */
export async function getUser(): Promise<AuthResult<AuthUser>> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return { data: null, error: mapAuthError(error?.message, error?.code ?? 'no_session') };
  }

  return { data: toAuthUser(data.user), error: null };
}

export async function getSession(): Promise<AuthResult<AuthSession>> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getSession();

  if (error || !data.session) {
    return { data: null, error: mapAuthError(error?.message, error?.code ?? 'no_session') };
  }

  return { data: toAuthSession(data.session), error: null };
}

export async function refreshSession(): Promise<AuthResult<AuthSession>> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.refreshSession();

  if (error || !data.session) {
    return { data: null, error: mapAuthError(error?.message, error?.code) };
  }

  return { data: toAuthSession(data.session), error: null };
}

export async function signInWithOAuth(
  provider: OAuthProvider
): Promise<AuthResult<{ url: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback` },
  });

  if (error || !data.url) {
    return { data: null, error: mapAuthError(error?.message, error?.code) };
  }

  return { data: { url: data.url }, error: null };
}

export async function forgotPassword(input: ForgotPasswordInput): Promise<AuthResult<null>> {
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(input.email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/reset-password`,
  });

  if (error) {
    return { data: null, error: mapAuthError(error.message, error.code) };
  }

  return { data: null, error: null };
}

/**
 * Requires an active recovery session (the user arrived via the forgot-password
 * email link, which went through `route.ts` → `exchangeCodeForSession`).
 */
export async function resetPassword(input: ResetPasswordInput): Promise<AuthResult<null>> {
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: input.newPassword });

  if (error) {
    return { data: null, error: mapAuthError(error.message, error.code) };
  }

  return { data: null, error: null };
}

export async function resendVerificationEmail(email: string): Promise<AuthResult<null>> {
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback` },
  });

  if (error) {
    return { data: null, error: mapAuthError(error.message, error.code) };
  }

  return { data: null, error: null };
}

/**
 * Protection helper for Server Components. Redirects if there's no valid session.
 * Re-exported from `actions.ts` for external consumption.
 */
export async function requireAuth(redirectTo = '/login'): Promise<AuthUser> {
  const { data: user, error } = await getUser();

  if (error || !user) {
    redirect(redirectTo);
  }

  return user;
}
