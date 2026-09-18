/**
 * Reference of client-side components and hooks for organizations
 * (@clerk/nextjs, Core 3 / v7). Not a mandatory layer — copy/paste
 * what you need.
 *
 * Note: `Show` (for role/permission-based conditional rendering)
 * already lives in the auth module's client.ts — import it from
 * there, it's not duplicated here.
 */
export { OrganizationSwitcher, useOrganization, useOrganizationList } from "@clerk/nextjs";

/**
 * Usage examples:
 *
 * // Switcher UI (create, list, switch orgs) — handles most of this
 * // module's UI on its own
 * import { OrganizationSwitcher } from "@/lib/organizations/client";
 * <OrganizationSwitcher hidePersonal />
 *
 * // Switch the active organization programmatically
 * import { useOrganizationList } from "@/lib/organizations/client";
 * const { setActive } = useOrganizationList();
 * await setActive({ organization: orgId });
 *
 * // Read the active organization in a Client Component
 * import { useOrganization } from "@/lib/organizations/client";
 * const { organization, membership, isLoaded } = useOrganization();
 *
 * // List + accept the current user's pending invitations
 * import { useOrganizationList } from "@/lib/organizations/client";
 * const { userInvitations } = useOrganizationList({
 *   userInvitations: { infinite: true },
 * });
 * userInvitations.data?.map((invitation) => (
 *   <button onClick={() => invitation.accept()}>Accept</button>
 * ));
 *
 * // Role/permission-based rendering — import Show from the auth module
 * import { Show } from "@/lib/clerk/client";
 * <Show when={{ role: "org:admin" }}>...</Show>
 * <Show when={{ permission: "org:sys_memberships:manage" }}>...</Show>
 */
