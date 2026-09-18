"use server";

import {
  auth0,
  getRawSession,
  normalizeSession,
  requireSession,
  resendVerificationEmail as resendVerificationEmailInternal,
  triggerPasswordReset,
} from "./service";
import type { AuthResult, AuthSession } from "./types";

/**
 * Public server-side API of the auth0 module.
 * Import these from Server Components, Server Actions, and Route Handlers.
 * Do not import `service.ts` directly — it's internal.
 */

/**
 * Returns the current authenticated user, or null if there is no session.
 */
export async function getUser() {
  const session = await getRawSession();
  return session ? normalizeSession(session).user : null;
}

/**
 * Returns the current normalized session, or null if there is no session.
 */
export async function getSession(): Promise<AuthSession | null> {
  const session = await getRawSession();
  return session ? normalizeSession(session) : null;
}

/**
 * Forces a refresh of the access/ID token using the stored refresh token.
 * Returns the refreshed, normalized session.
 */
export async function refreshSession(): Promise<AuthResult<AuthSession>> {
  try {
    const session = await auth0.getSession();
    if (!session) {
      return { success: false, error: { code: "NO_SESSION", message: "No active session to refresh" } };
    }
    const refreshed = await auth0.getAccessToken({ refresh: true });
    const latest = await auth0.getSession();
    if (!latest) {
      return { success: false, error: { code: "NO_SESSION", message: "Session lost during refresh" } };
    }
    void refreshed; // token itself is available on `latest.tokenSet` after refresh
    return { success: true, data: normalizeSession(latest) };
  } catch (e) {
    return { success: false, error: { code: "UNKNOWN_ERROR", message: (e as Error).message } };
  }
}

/**
 * Redirects the current request to Auth0's logout endpoint, which clears
 * the session cookie and ends the Auth0 tenant session.
 */
export async function signOutAction(returnTo = "/") {
  const { redirect } = await import("next/navigation");
  redirect(`/auth/logout?returnTo=${encodeURIComponent(returnTo)}`);
}

/**
 * Sends the "forgot password" email through Auth0's hosted flow.
 * The user resets their password on an Auth0-hosted page — this module
 * does not implement its own reset-password screen.
 */
export async function forgotPassword(email: string): Promise<AuthResult> {
  if (!email || !email.includes("@")) {
    return { success: false, error: { code: "INVALID_EMAIL", message: "Provide a valid email address" } };
  }
  return triggerPasswordReset(email);
}

/**
 * Resends the email verification link to the current user.
 * Requires the Management API M2M app described in SETUP.md.
 */
export async function resendVerificationEmail(): Promise<AuthResult> {
  const session = await getRawSession();
  if (!session) {
    return { success: false, error: { code: "NO_SESSION", message: "No active session" } };
  }
  return resendVerificationEmailInternal(session.user.sub);
}

/**
 * Guard for protected Server Components. Redirects to Universal Login
 * if there is no session, otherwise returns the normalized session.
 *
 * Usage:
 *   export default async function ProtectedPage() {
 *     const session = await requireAuth();
 *     return <p>Welcome {session.user.name}</p>;
 *   }
 */
export async function requireAuth(returnTo = "/"): Promise<AuthSession> {
  const session = await requireSession(returnTo);
  return normalizeSession(session);
}
