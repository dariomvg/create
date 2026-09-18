"use client";

// Client-side helpers for the Stripe Billing module.
// Import these into Client Components. Anything that needs the secret
// key stays server-side in service.ts/actions.ts — this file only ever
// talks to Stripe.js with the publishable key.

import { loadStripe, type Stripe as StripeJs } from "@stripe/stripe-js";
import type { ActionResult } from "./types";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

if (!publishableKey) {
  console.warn(
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set. Add it to your .env.local file."
  );
}

let stripePromise: Promise<StripeJs | null> | null = null;

function getStripe() {
  if (!stripePromise) {
    stripePromise = loadStripe(publishableKey ?? "");
  }
  return stripePromise;
}

/**
 * Redirects the browser to the Stripe-hosted Customer Portal session
 * created by `createCustomerPortalSession` (actions.ts).
 */
export function redirectToCustomerPortal(url: string): void {
  window.location.href = url;
}

/**
 * Confirms a SetupIntent to save a new payment method — used together
 * with `createSetupIntent` (actions.ts) and Stripe Elements mounted in
 * your component for the "update payment method" flow.
 */
export async function confirmCardSetup(
  clientSecret: string,
  paymentMethodId: string
): Promise<ActionResult<{ paymentMethodId: string }>> {
  const stripe = await getStripe();
  if (!stripe) {
    return { success: false, error: "Stripe.js failed to load." };
  }

  const { setupIntent, error } = await stripe.confirmCardSetup(clientSecret, {
    payment_method: paymentMethodId,
  });

  if (error) {
    return {
      success: false,
      error: error.message ?? "Payment method setup failed.",
    };
  }

  const confirmedId = setupIntent?.payment_method;
  if (typeof confirmedId !== "string") {
    return { success: false, error: "Setup did not return a payment method." };
  }

  return { success: true, data: { paymentMethodId: confirmedId } };
}

/** Gives components direct access to the Stripe.js instance for advanced use (e.g. Elements). */
export { getStripe };
