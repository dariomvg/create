/**
 * Client-safe helpers. Import these from Client Components.
 * For anything server-side (CRUD, invitations, roles) use `actions.ts` instead —
 * those are `"use server"` and can be called directly from Client Components too.
 */

/**
 * Navigates to re-authenticate the user scoped to a different organization.
 * Use this for an "org switcher" dropdown. Prefer this over calling the
 * `switchActiveOrganizationAction` server action when you just want a plain
 * navigation with no extra round trip.
 */
export function switchOrganization(organizationId: string, returnTo = "/") {
  const params = new URLSearchParams({ organization: organizationId, returnTo });
  window.location.href = `/auth/login?${params.toString()}`;
}

/**
 * Builds the URL for an "Accept invitation" button/link on a custom
 * confirmation page (e.g. after the user reviews which org they're joining).
 */
export function buildAcceptInvitationUrl(organizationId: string, invitationTicket: string): string {
  const params = new URLSearchParams({ organization: organizationId, invitation: invitationTicket });
  return `/auth/login?${params.toString()}`;
}
