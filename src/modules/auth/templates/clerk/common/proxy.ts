import { clerkMiddleware } from "@clerk/nextjs/server";

/**
 * createRouteMatcher() is deprecated — Clerk now recommends against
 * gating routes by path in middleware. This file only attaches
 * Clerk's session context to each request; the actual protection
 * happens at each resource (Server Component/Server Action/Route
 * Handler) via requireUser()/requireOrgRole()/checkPermission()
 * from the relevant module's service.ts. Sign-in/sign-up pages are
 * public simply because nothing on them calls those functions.
 */
export default clerkMiddleware();

export const config = {
  matcher: [
    // Skip Next.js internals and static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};