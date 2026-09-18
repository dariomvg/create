"use client";

/**
 * client.ts
 * ---------------------------------------------------------------------------
 * Client-side helpers. These never touch the Lemon Squeezy API key — they
 * only work with a checkout URL already produced server-side by
 * `actions.ts#createSubscriptionCheckout`.
 * ---------------------------------------------------------------------------
 */

/** Redirects the browser to a Lemon Squeezy subscription checkout URL. */
export function redirectToSubscriptionCheckout(checkoutUrl: string): void {
  if (!checkoutUrl) {
    throw new Error("redirectToSubscriptionCheckout: checkoutUrl is required.");
  }
  window.location.href = checkoutUrl;
}

/**
 * Opens a Lemon Squeezy subscription checkout as an overlay instead of a
 * full redirect. Requires Lemon.js to be loaded on the page:
 *   <script src="https://assets.lemonsqueezy.com/lemon.js" defer></script>
 * and the checkout to have been created with `embed: true`.
 */
export function openSubscriptionCheckoutOverlay(checkoutUrl: string): void {
  if (!checkoutUrl) {
    throw new Error("openSubscriptionCheckoutOverlay: checkoutUrl is required.");
  }

  const lemonSqueezy = (window as any).LemonSqueezy;
  if (!lemonSqueezy) {
    console.warn(
      "[lemonsqueezy-subscriptions] Lemon.js is not loaded. Falling back to a full-page redirect."
    );
    redirectToSubscriptionCheckout(checkoutUrl);
    return;
  }

  lemonSqueezy.Url.Open(checkoutUrl);
}

/**
 * Redirects the customer to Lemon Squeezy's hosted customer portal, where
 * they can manage payment methods and billing themselves.
 * Get `customerPortalUrl` from `getSubscription()` in actions.ts
 * (`data.customerPortalUrl`).
 */
export function redirectToCustomerPortal(customerPortalUrl: string): void {
  if (!customerPortalUrl) {
    throw new Error("redirectToCustomerPortal: customerPortalUrl is required.");
  }
  window.location.href = customerPortalUrl;
}
