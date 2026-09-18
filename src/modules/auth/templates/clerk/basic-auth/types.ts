import type { User } from "@clerk/nextjs/server";

/**
 * Reduced user shape used across the rest of the app.
 * Avoids passing Clerk's full User object around everywhere.
 */
export interface AuthUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string;
  emailVerified: boolean;
  createdAt: Date;
}

/**
 * Reduced shape of the active session.
 */
export interface AuthSession {
  sessionId: string;
  userId: string;
  status: "active" | "expired" | "revoked";
  expireAt: Date;
}

/**
 * Generic result type for Server Actions.
 * Avoids throwing exceptions up into Server Components; everything
 * comes back as an object so the caller decides what to render.
 */
export type AuthResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Function type for converting Clerk's User into the reduced
 * AuthUser shape. The actual implementation lives in service.ts —
 * this is just the type, so it stays typed without duplicating the
 * shape here.
 */
export type ToAuthUser = (user: User) => AuthUser;
