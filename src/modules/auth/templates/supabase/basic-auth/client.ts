'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { AuthResult, AuthSession, OAuthProvider, SignInInput, SignUpInput } from './types';

/**
 * client.ts — browser Supabase client + ready-to-import functions for
 * Client Components. For Server Components/Server Actions use `actions.ts`.
 */

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

function toAuthSession(session: {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  user: {
    id: string;
    email?: string | null;
    email_confirmed_at?: string | null;
    created_at: string;
  };
}): AuthSession {
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at ?? null,
    user: {
      id: session.user.id,
      email: session.user.email ?? null,
      emailVerified: Boolean(session.user.email_confirmed_at),
      createdAt: session.user.created_at,
    },
  };
}

export async function signUpClient(
  input: SignUpInput
): Promise<AuthResult<{ userId: string }>> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
  });

  if (error || !data.user) {
    return {
      data: null,
      error: { code: 'unknown', message: error?.message ?? 'Error al registrarse.' },
    };
  }

  return { data: { userId: data.user.id }, error: null };
}

export async function signInClient(input: SignInInput): Promise<AuthResult<AuthSession>> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });

  if (error || !data.session) {
    return {
      data: null,
      error: { code: 'invalid_credentials', message: error?.message ?? 'Credenciales inválidas.' },
    };
  }

  return { data: toAuthSession(data.session), error: null };
}

export async function signOutClient(): Promise<AuthResult<null>> {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    return { data: null, error: { code: 'unknown', message: error.message } };
  }

  return { data: null, error: null };
}

/**
 * Triggers the OAuth redirect directly from the browser. Doesn't return
 * anything useful: Supabase takes over navigation.
 */
export async function signInWithOAuthClient(provider: OAuthProvider): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  });
}

export function onAuthStateChange(callback: (session: AuthSession | null) => void) {
  const supabase = createClient();
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session ? toAuthSession(session) : null);
  });

  return () => data.subscription.unsubscribe();
}
