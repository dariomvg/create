/**
 * Types for the Auth0 authentication module.
 * Consumers should only ever import from here, `client.ts`, or `actions.ts` —
 * never from `service.ts` directly.
 */

/**
 * Normalized Auth0 user shape, derived from the ID token claims.
 * Extend this if you enable custom claims/rules in your Auth0 tenant.
 */
export interface Auth0User {
  sub: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  nickname?: string;
  picture?: string;
  updatedAt?: string;
}

/**
 * Normalized session shape returned by `getSession()`.
 */
export interface AuthSession {
  user: Auth0User;
  accessToken?: string;
  idToken?: string;
  expiresAt: number;
}

/**
 * Social connections enabled for this module.
 * Must match the connection names configured in your Auth0 Dashboard
 * (see SETUP.md → Configuration).
 */
export type OAuthConnection = "google-oauth2" | "github" | "apple" | "facebook";

/**
 * Discriminated result type used across `service.ts` and `actions.ts`.
 * Prevents throwing across the server/client boundary — callers check `success`.
 */
export type AuthResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: AuthError };

export interface AuthError {
  code: AuthErrorCode;
  message: string;
}

export type AuthErrorCode =
  | "NO_SESSION"
  | "INVALID_EMAIL"
  | "USER_NOT_FOUND"
  | "MANAGEMENT_API_ERROR"
  | "AUTH0_API_ERROR"
  | "UNKNOWN_ERROR";

/**
 * Options accepted by the client-side navigation helpers in `client.ts`.
 */
export interface SignInOptions {
  /** Path to return to after a successful login. Defaults to "/". */
  returnTo?: string;
  /** Force a specific social connection instead of showing the Universal Login picker. */
  connection?: OAuthConnection;
}

export interface SignUpOptions {
  returnTo?: string;
  connection?: OAuthConnection;
}

export interface ForgotPasswordParams {
  email: string;
}
