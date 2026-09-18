import { auth0 } from "@/lib/auth/auth0/basic-auth/service";

/**
 * Copy this file to the root of your Next.js project (next to package.json).
 * Adjust the import path if your module doesn't live at `lib/auth0`.
 *
 * Next.js 16 replaces `middleware.ts` with `proxy.ts` as the request
 * interception boundary. This intercepts every matched request, attaches
 * the session, and mounts Auth0's auth routes (/auth/login, /auth/logout,
 * /auth/callback, /auth/profile) automatically — no route.ts needed.
 */
export async function proxy(request: Request) {
  return await auth0.middleware(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)"],
};
