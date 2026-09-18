"use client";

// Client-side helpers for the Stripe One-time Payments module.
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

// Stripe.js recommends loading the instance once and reusing it.
let stripePromise: Promise<StripeJs | null> | null = null;

function getStripe() {
  if (!stripePromise) {
    stripePromise = loadStripe(publishableKey ?? "");
  }
  return stripePromise;
}

/**
 * Redirects the browser to a Checkout Session created by
 * `createCheckoutSession` (actions.ts). Pass the `sessionId` it returns.
 */
export async function redirectToCheckout(
  sessionId: string
): Promise<ActionResult<{ redirected: true }>> {
  const stripe = await getStripe();
  if (!stripe) {
    return { success: false, error: "Stripe.js failed to load." };
  }

  const { error } = await stripe.redirectToCheckout({ sessionId });
  if (error) {
    return { success: false, error: error.message ?? "Redirect failed." };
  }

  // Note: on success, the browser navigates away before this resolves.
  return { success: true, data: { redirected: true } };
}

/**
 * Confirms a PaymentIntent from a custom/embedded payment form
 * (used together with `createPaymentIntent` from actions.ts and Stripe
 * Elements mounted in your component).
 */
export async function confirmCardPayment(
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
    return { success: false, error: error.message ?? "Payment confirmation failed." };
  }

  return { success: true, data: { status: paymentIntent?.status ?? "unknown" } };
}

/** Gives components direct access to the Stripe.js instance for advanced use (e.g. Elements). */
export { getStripe };
