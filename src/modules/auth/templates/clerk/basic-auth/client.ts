/**
 * Reference of client-side components and hooks from @clerk/nextjs
 * (Core 3 / v7). Not a mandatory layer — this exists so you can
 * copy/paste the right import instead of looking it up every time.
 */
export {
  ClerkProvider,
  SignIn,
  SignUp,
  Show, // replaces SignedIn / SignedOut / Protect (Core 3)
  UserButton,
  useUser,
  useAuth,
  useSession,
  useClerk,
} from "@clerk/nextjs";

/**
 * Usage examples:
 *
 * // app/layout.tsx
 * import { ClerkProvider } from "@/lib/clerk/client";
 * <ClerkProvider>{children}</ClerkProvider>
 *
 * // Show content only when signed in / signed out
 * import { Show } from "@/lib/clerk/client";
 * <Show when="signed-in">...</Show>
 * <Show when="signed-out">...</Show>
 *
 * // User avatar with dropdown (profile, sign out)
 * import { UserButton } from "@/lib/clerk/client";
 * <UserButton />
 *
 * // Sign out from a Client Component
 * import { useClerk } from "@/lib/clerk/client";
 * const { signOut } = useClerk();
 * <button onClick={() => signOut({ redirectUrl: "/" })}>Sign out</button>
 *
 * // Read user/session in a Client Component
 * import { useUser, useAuth, useSession } from "@/lib/clerk/client";
 * const { user, isLoaded } = useUser();
 * const { isSignedIn } = useAuth();
 * const { session } = useSession();
 *
 * // Sign-in page — app/sign-in/[[...sign-in]]/page.tsx
 * import { SignIn } from "@/lib/clerk/client";
 * export default function SignInPage() {
 *   return <SignIn />;
 * }
 *
 * // Sign-up page — app/sign-up/[[...sign-up]]/page.tsx
 * import { SignUp } from "@/lib/clerk/client";
 * export default function SignUpPage() {
 *   return <SignUp />;
 * }
 */
