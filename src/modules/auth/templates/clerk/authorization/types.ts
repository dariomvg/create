/**
 * Self-contained module — nothing imported from lib/clerk or
 * lib/organizations on purpose, even where it overlaps.
 */

/**
 * org:admin / org:member are Clerk's native roles. The type stays
 * open (string & {}) so custom role keys (e.g. "org:billing")
 * still type-check while keeping autocomplete for the native ones.
 */
export type OrgRole = "org:admin" | "org:member" | (string & {});

export interface Permission {
  id: string;
  key: string; // e.g. "org:invoices:create"
  name: string;
  description: string | null;
}

export interface Role {
  id: string;
  key: OrgRole; // e.g. "org:admin" or a custom "org:billing"
  name: string;
  description: string | null;
  /**
   * Present when fetched through getRole()/getRolePermissions() —
   * assumes the Backend API returns permissions embedded on the
   * role. Verify against the current API reference (see SETUP.md,
   * this endpoint is fairly new).
   */
  permissions?: Permission[];
}

/**
 * Generic result type for Server Actions. Redefined here on
 * purpose — this module doesn't import AuthResult from lib/clerk.
 */
export type AuthResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };
