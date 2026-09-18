import "server-only";
import { auth, currentUser, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { AuthUser, AuthSession, ToAuthUser } from "./types";

/**
 * Converts Clerk's full User into the reduced AuthUser shape.
 * Internal use only — nothing outside this file should need
 * Clerk's raw User without going through here.
 */
const toAuthUser: ToAuthUser = (user) => {
  const primaryEmail = user.emailAddresses.find(
    (email) => email.id === user.primaryEmailAddressId
  );

  return {
    id: user.id,
    email: primaryEmail?.emailAddress ?? "",
    firstName: user.firstName,
    lastName: user.lastName,
    imageUrl: user.imageUrl,
    emailVerified: primaryEmail?.verification?.status === "verified",
    createdAt: new Date(user.createdAt),
  };
};

/**
 * Current user, reduced to the AuthUser shape.
 * null if there's no active session.
 */
export async function getUser(): Promise<AuthUser | null> {
  const user = await currentUser();
  if (!user) return null;
  return toAuthUser(user);
}

/**
 * Active session, reduced to the AuthSession shape.
 * null if there's no active session.
 */
export async function getSession(): Promise<AuthSession | null> {
  const { userId, sessionId, sessionClaims } = await auth();
  if (!userId || !sessionId) return null;

  return {
    sessionId,
    userId,
    status: "active",
    expireAt: new Date((sessionClaims?.exp ?? 0) * 1000),
  };
}

/**
 * Forces a revalidation of the active session against Clerk's API
 * (instead of trusting the cached JWT). Useful after an action that
 * may have changed the session's state.
 */
export async function refreshSession(): Promise<AuthSession | null> {
  const { userId, sessionId } = await auth();
  if (!userId || !sessionId) return null;

  const client = await clerkClient();
  const session = await client.sessions.getSession(sessionId);

  return {
    sessionId: session.id,
    userId: session.userId,
    status: session.status as AuthSession["status"],
    expireAt: new Date(session.expireAt),
  };
}

/**
 * Revokes the active session from the server (a "hard" sign out —
 * invalidates the token even if the client never calls signOut()).
 */
export async function signOutServer(): Promise<void> {
  const { sessionId } = await auth();
  if (!sessionId) return;

  const client = await clerkClient();
  await client.sessions.revokeSession(sessionId);
}

/**
 * Returns the current user or redirects to /sign-in if there's none.
 * Use at the top of any Server Component or Server Action that
 * requires an authenticated user — this is the real protection;
 * the proxy only avoids unnecessary renders.
 */
export async function requireUser(): Promise<AuthUser> {
  const user = await getUser();
  if (!user) redirect("/sign-in");
  return user;
}

/**
 * Quick session check without fetching the full user.
 */
export async function isAuthenticated(): Promise<boolean> {
  const { userId } = await auth();
  return Boolean(userId);
}
