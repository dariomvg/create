/**
 * Client-side helpers for the Mercado Pago Subscriptions module.
 *
 * Subscriptions are authorized the same way Checkout Pro payments are:
 * redirect the payer to Mercado Pago's hosted page. No card tokenization
 * happens here.
 */

/**
 * Redirects the browser to the Mercado Pago subscription authorization page.
 * Pass the `initPoint` returned by `createSubscription` from actions.ts.
 */
export function redirectToSubscriptionCheckout(authorizationUrl: string): void {
  if (!authorizationUrl) {
    throw new Error("A valid Mercado Pago authorization URL is required.");
  }
  window.location.href = authorizationUrl;
}
