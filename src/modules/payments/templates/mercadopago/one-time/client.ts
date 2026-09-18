/**
 * Client-side helpers for the Mercado Pago One-time Payments module.
 *
 * Since this module only uses Checkout Pro (redirect-based checkout), there
 * is no card tokenization on the client — this file is intentionally small.
 * Import these functions from client components.
 */

/**
 * Redirects the browser to the Mercado Pago checkout page.
 * Pass the `initPoint` (or `sandboxInitPoint` while testing) returned by
 * `createCheckout` from actions.ts.
 */
export function redirectToCheckout(checkoutUrl: string): void {
  if (!checkoutUrl) {
    throw new Error("A valid Mercado Pago checkout URL is required.");
  }
  window.location.href = checkoutUrl;
}
