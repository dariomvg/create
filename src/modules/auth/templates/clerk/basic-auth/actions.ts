"use server";

import {
  getUser,
  getSession,
  refreshSession,
  signOutServer,
} from "./service";
import type { AuthUser, AuthSession, AuthResult } from "./types";

/**
 * Returns the current user. success:false when there's no session
 * (not a real error, just the "not logged in" case).
 */
export async function getCurrentUserAction(): Promise<AuthResult<AuthUser>> {
  const user = await getUser();
  if (!user) return { success: false, error: "No active session" };
  return { success: true, data: user };
}

/**
 * Returns the active session.
 */
export async function getSessionAction(): Promise<AuthResult<AuthSession>> {
  const session = await getSession();
  if (!session) return { success: false, error: "No active session" };
  return { success: true, data: session };
}

/**
 * Forces a revalidation of the active session.
 */
export async function refreshSessionAction(): Promise<
  AuthResult<AuthSession>
> {
  const session = await refreshSession();
  if (!session) return { success: false, error: "No active session" };
  return { success: true, data: session };
}

/**
 * Signs out from the server (revokes the token).
 * To sign out from the client, use useClerk().signOut() instead
 * (see client.ts) — this action is for server-side flows.
 */
export async function signOutAction(): Promise<AuthResult> {
  try {
    await signOutServer();
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: "Could not sign out" };
  }
}
