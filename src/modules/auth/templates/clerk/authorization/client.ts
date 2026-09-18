/**
 * Self-contained module — Show is re-exported here on purpose,
 * even though it's the same component already re-exported by the
 * auth module's client.ts. No cross-imports between modules.
 */
export { Show } from "@clerk/nextjs";

/**
 * Usage examples:
 *
 * // Gate a section by role
 * import { Show } from "@/lib/rbac/client";
 * <Show when={{ role: "org:admin" }}>
 *   <AdminPanel />
 * </Show>
 *
 * // Gate by a custom permission (works reliably server-side too —
 * // see SETUP.md for why org:sys_* permissions don't)
 * <Show when={{ permission: "org:invoices:create" }}>
 *   <CreateInvoiceButton />
 * </Show>
 *
 * // Route/Server Component authorization
 * import { requireOrgRole } from "@/lib/rbac/service";
 * export default async function AdminSettingsPage() {
 *   await requireOrgRole("org:admin", "/dashboard");
 *   return <p>Admin settings</p>;
 * }
 *
 * // API Route authorization
 * import { checkPermission } from "@/lib/rbac/service";
 * export async function POST(request: Request) {
 *   if (!(await checkPermission("org:invoices:create"))) {
 *     return new Response("Forbidden", { status: 403 });
 *   }
 *   // ...
 * }
 */
