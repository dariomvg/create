import "server-only";
import { redirect } from "next/navigation";
import { Auth0Client } from "@auth0/nextjs-auth0/server";
import type { AuthError, AuthErrorCode, AuthResult, AuthSession } from "./types";

/**
 * INTERNAL MODULE — do not import this file from outside the auth0 folder.
 * Consumers should use `actions.ts` (server) or `client.ts` (client) instead.
 *
 * Holds the single Auth0Client instance, raw API calls to Auth0 that the
 * SDK doesn't cover via redirect-based Universal Login, and error normalization.
 */

// Single shared instance. Reads AUTH0_DOMAIN, AUTH0_CLIENT_ID,
// AUTH0_CLIENT_SECRET, AUTH0_SECRET and APP_BASE_URL from process.env.
export const auth0 = new Auth0Client();

/**
 * Reads the current session or returns null. Never throws.
 */
export async function getRawSession() {
  const session = await auth0.getSession();
  return session;
}

/**
 * Maps the SDK session shape to the module's normalized `AuthSession`.
 */
export function normalizeSession(session: NonNullable<Awaited<ReturnType<typeof auth0.getSession>>>): AuthSession {
  return {
    user: {
      sub: session.user.sub,
      email: session.user.email ?? "",
      emailVerified: Boolean(session.user.email_verified),
      name: session.user.name,
      nickname: session.user.nickname,
      picture: session.user.picture,
      updatedAt: session.user.updated_at,
    },
    accessToken: session.tokenSet?.accessToken,
    idToken: session.tokenSet?.idToken,
    expiresAt: session.tokenSet?.expiresAt ?? 0,
  };
}

/**
 * Redirects to Universal Login if there is no active session.
 * Use at the top of any Server Component / layout that must be protected.
 */
export async function requireSession(returnTo = "/") {
  const session = await getRawSession();
  if (!session) {
    redirect(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  }
  return session;
}

/**
 * Triggers Auth0's hosted "forgot password" email via the public
 * Authentication API. Auth0 hosts the actual reset-password screen —
 * this module does not need a resetPassword() function of its own.
 * Docs: https://auth0.com/docs/api/authentication#change-password
 */
export async function triggerPasswordReset(email: string): Promise<AuthResult> {
  try {
    const res = await fetch(`https://${requireEnv("AUTH0_DOMAIN")}/dbconnections/change_password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: requireEnv("AUTH0_CLIENT_ID"),
        email,
        connection: "Username-Password-Authentication",
      }),
    });

    if (!res.ok) {
      return err("AUTH0_API_ERROR", `Auth0 responded with ${res.status}`);
    }
    return { success: true, data: undefined };
  } catch (e) {
    return err("UNKNOWN_ERROR", (e as Error).message);
  }
}

/**
 * Resends the email verification link for a given user via the
 * Management API. Requires a Machine-to-Machine application authorized
 * for the Management API with the "create:user_tickets" scope
 * (see SETUP.md → Configuration). If you didn't set up the M2M app,
 * remove this function and rely on Auth0's automatic verification email
 * sent at signup instead.
 */
export async function resendVerificationEmail(userId: string): Promise<AuthResult> {
  try {
    const token = await getManagementApiToken();
    if (!token.success) return token;

    const res = await fetch(`https://${requireEnv("AUTH0_DOMAIN")}/api/v2/jobs/verification-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token.data}`,
      },
      body: JSON.stringify({ user_id: userId }),
    });

    if (!res.ok) {
      return err("MANAGEMENT_API_ERROR", `Auth0 responded with ${res.status}`);
    }
    return { success: true, data: undefined };
  } catch (e) {
    return err("UNKNOWN_ERROR", (e as Error).message);
  }
}

/**
 * Fetches a short-lived Management API access token via the
 * client_credentials grant. Not cached across requests in this
 * boilerplate — swap in a KV/Redis cache if you call this often.
 */
async function getManagementApiToken(): Promise<AuthResult<string>> {
  try {
    const res = await fetch(`https://${requireEnv("AUTH0_DOMAIN")}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: requireEnv("AUTH0_M2M_CLIENT_ID"),
        client_secret: requireEnv("AUTH0_M2M_CLIENT_SECRET"),
        audience: `https://${requireEnv("AUTH0_DOMAIN")}/api/v2/`,
      }),
    });

    if (!res.ok) {
      return err("MANAGEMENT_API_ERROR", `Token request failed with ${res.status}`);
    }

    const json = (await res.json()) as { access_token: string };
    return { success: true, data: json.access_token };
  } catch (e) {
    return err("UNKNOWN_ERROR", (e as Error).message);
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function err(code: AuthErrorCode, message: string): { success: false; error: AuthError } {
  return { success: false, error: { code, message } };
}
