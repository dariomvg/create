"use client";

// Client-side helpers for the Stripe Subscriptions module.
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
 * Confirms the PaymentIntent behind a subscription's first invoice.
 * Required after `createSubscription` (actions.ts) whenever it returns a
 * non-null `clientSecret` — e.g. no trial period, or a card that needs
 * 3D Secure. Not needed for subscriptions that start on a trial with no
 * immediate charge.
 */
export async function confirmSubscriptionPayment(
  clientSecret: string,
  paymentMethodId: string
): Promise<ActionResult<{ status: string }>> {
  const stripe = await getStripe();
  if (!stripe) {
    return { success: false, error: "Stripe.js failed to load." };
  }

  const { paymentIntent, error } = await stripe.confirmCardPayment(
    clientSecret,
    { payment_method: paymentMethodId }
  );

  if (error) {
    return {
      success: false,
      error: error.message ?? "Subscription payment confirmation failed.",
    };
  }

  return { success: true, data: { status: paymentIntent?.status ?? "unknown" } };
}

/** Gives components direct access to the Stripe.js instance for advanced use (e.g. Elements). */
export { getStripe };
