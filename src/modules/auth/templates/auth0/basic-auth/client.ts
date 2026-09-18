import type { OAuthConnection, SignInOptions, SignUpOptions } from "./types";

/**
 * Client-safe helpers. Import these from Client Components (buttons, forms).
 * Auth0's Universal Login is redirect-based, so these are URL builders +
 * navigation — no auth logic lives here. For anything server-side
 * (getUser, getSession, forgotPassword, etc.) use `actions.ts` instead.
 */

/**
 * Redirects to Auth0's Universal Login (sign in) screen.
 * Pass `connection` to skip the picker and go straight to a social provider.
 */
export function signIn(options: SignInOptions = {}) {
  window.location.href = buildLoginUrl(options, false);
}

/**
 * Redirects to Auth0's Universal Login (sign up) screen.
 */
export function signUp(options: SignUpOptions = {}) {
  window.location.href = buildLoginUrl(options, true);
}

/**
 * Redirects straight to a specific social connection (Google, GitHub, Apple, Facebook).
 * The connection names must match what's configured in the Auth0 Dashboard
 * (see SETUP.md → Configuration).
 */
export function signInWithOAuth(connection: OAuthConnection, returnTo = "/") {
  window.location.href = buildLoginUrl({ returnTo, connection }, false);
}

/**
 * Redirects to Auth0's logout endpoint, clearing the local session cookie
 * and the Auth0 tenant session.
 */
export function signOut(returnTo = "/") {
  window.location.href = `/auth/logout?returnTo=${encodeURIComponent(returnTo)}`;
}

function buildLoginUrl(options: SignInOptions | SignUpOptions, isSignUp: boolean): string {
  const params = new URLSearchParams();
  params.set("returnTo", options.returnTo ?? "/");
  if (isSignUp) params.set("screen_hint", "signup");
  if (options.connection) params.set("connection", options.connection);
  return `/auth/login?${params.toString()}`;
}
