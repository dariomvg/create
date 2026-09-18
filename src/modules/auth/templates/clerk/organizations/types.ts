import type { AuthResult } from "../clerk/types";

export type { AuthResult };

/**
 * Native Clerk system roles for organizations.
 * org:admin is the Owner equivalent — no custom role.
 */
export type OrgRole = "org:admin" | "org:member";

/**
 * Reduced organization shape used across the app.
 */
export interface OrgSummary {
  id: string;
  name: string;
  slug: string | null;
  imageUrl: string;
  membersCount: number;
  createdAt: Date;
}

/**
 * Reduced organization membership shape (a user inside an org).
 */
export interface OrgMember {
  userId: string;
  organizationId: string;
  role: OrgRole;
  identifier: string; // email or username, whatever Clerk resolves
  imageUrl: string;
}

/**
 * Reduced organization invitation shape.
 * status is Clerk's own: pending / accepted / revoked.
 */
export interface OrgInvitation {
  id: string;
  organizationId: string;
  emailAddress: string;
  role: OrgRole;
  status: "pending" | "accepted" | "revoked";
  createdAt: Date;
}
