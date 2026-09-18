"use client";

/**
 * client.ts
 * ---------------------------------------------------------------------------
 * Client-side helpers. These never touch the Lemon Squeezy API key — they
 * only work with a checkout URL already produced server-side by
 * `actions.ts#createCheckout`.
 * ---------------------------------------------------------------------------
 */

/**
 * Redirects the browser to a Lemon Squeezy checkout URL (full-page redirect).
 * Get `checkoutUrl` from the server via `createCheckout()` in actions.ts.
 */
export function redirectToCheckout(checkoutUrl: string): void {
  if (!checkoutUrl) {
    throw new Error("redirectToCheckout: checkoutUrl is required.");
  }
  window.location.href = checkoutUrl;
}

/**
 * Opens a Lemon Squeezy checkout as an overlay instead of a full redirect.
 * Requires the Lemon.js script to be loaded on the page:
 *   <script src="https://assets.lemonsqueezy.com/lemon.js" defer></script>
 * and the checkout to have been created with `embed: true`.
 */
export function openCheckoutOverlay(checkoutUrl: string): void {
  if (!checkoutUrl) {
    throw new Error("openCheckoutOverlay: checkoutUrl is required.");
  }

  const lemonSqueezy = (window as any).LemonSqueezy;
  if (!lemonSqueezy) {
    console.warn(
      "[lemonsqueezy] Lemon.js is not loaded. Falling back to a full-page redirect."
    );
    redirectToCheckout(checkoutUrl);
    return;
  }

  lemonSqueezy.Url.Open(checkoutUrl);
}

/**
 * Polls a "payment status" endpoint in your own app until the order reaches
 * a final state, or the timeout is hit. Point `statusEndpoint` at a route of
 * yours that internally calls `getPaymentStatus()` from actions.ts (this
 * function never calls Lemon Squeezy directly from the browser).
 */
export async function pollPaymentStatus(
  statusEndpoint: string,
  options?: { intervalMs?: number; timeoutMs?: number }
): Promise<"paid" | "failed" | "refunded" | "partial_refund" | "fraudulent" | "timeout"> {
  const intervalMs = options?.intervalMs ?? 2000;
  const timeoutMs = options?.timeoutMs ?? 60000;
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const res = await fetch(statusEndpoint, { cache: "no-store" });
    if (res.ok) {
      const { status } = (await res.json()) as { status: string };
      if (status !== "pending") {
        return status as "paid" | "failed" | "refunded" | "partial_refund" | "fraudulent";
      }
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return "timeout";
}
