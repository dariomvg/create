"use server";

// Server Actions for the Stripe One-time Payments module.
// Import these directly into Server Components or form actions.
// All Stripe-specific logic lives in service.ts — this file only
// validates input, calls the service, and returns a serializable result.

import { stripeService } from "./service";
import type {
  ActionResult,
  CreateCheckoutSessionParams,
  CreatePaymentIntentParams,
  PaymentMethodSummary,
  PaymentStatus,
  PaymentSummary,
  RefundParams,
  RefundSummary,
} from "./types";
import Stripe from "stripe";

/** Creates a hosted Checkout Session and returns its URL for redirect. */
export async function createCheckoutSession(
  params: CreateCheckoutSessionParams
): Promise<ActionResult<{ url: string | null; sessionId: string }>> {
  if (params.amount <= 0) {
    return { success: false, error: "Amount must be greater than zero." };
  }

  const result = await stripeService.createCheckoutSession(params);
  if (!result.success) return result;

  return {
    success: true,
    data: { url: result.data.url, sessionId: result.data.id },
  };
}

/** Creates a PaymentIntent for a custom/embedded payment form. */
export async function createPaymentIntent(
  params: CreatePaymentIntentParams
): Promise<ActionResult<{ clientSecret: string | null; id: string }>> {
  if (params.amount <= 0) {
    return { success: false, error: "Amount must be greater than zero." };
  }

  const result = await stripeService.createPaymentIntent(params);
  if (!result.success) return result;

  return {
    success: true,
    data: { clientSecret: result.data.client_secret, id: result.data.id },
  };
}

/** Retrieves the full payment summary by PaymentIntent id. */
export async function getPayment(
  paymentIntentId: string
): Promise<ActionResult<PaymentSummary>> {
  if (!paymentIntentId) {
    return { success: false, error: "paymentIntentId is required." };
  }
  return stripeService.getPayment(paymentIntentId);
}

/** Retrieves just the normalized status — cheaper than getPayment when that's all you need. */
export async function getPaymentStatus(
  paymentIntentId: string
): Promise<ActionResult<PaymentStatus>> {
  if (!paymentIntentId) {
    return { success: false, error: "paymentIntentId is required." };
  }
  return stripeService.getPaymentStatus(paymentIntentId);
}

/** Cancels a payment that hasn't been captured/completed yet. */
export async function cancelPayment(
  paymentIntentId: string
): Promise<ActionResult<{ id: string; status: string }>> {
  if (!paymentIntentId) {
    return { success: false, error: "paymentIntentId is required." };
  }
  const result = await stripeService.cancelPayment(paymentIntentId);
  if (!result.success) return result;
  return {
    success: true,
    data: { id: result.data.id, status: result.data.status },
  };
}

/** Full or partial refund. Pass `amount` for a partial refund; omit for full. */
export async function refundPayment(
  params: RefundParams
): Promise<ActionResult<RefundSummary>> {
  if (!params.paymentIntentId) {
    return { success: false, error: "paymentIntentId is required." };
  }
  if (params.amount !== undefined && params.amount <= 0) {
    return {
      success: false,
      error: "Partial refund amount must be greater than zero.",
    };
  }
  return stripeService.refund(params);
}

/** Lists saved payment methods for a given Stripe customer id. */
export async function listPaymentMethods(
  customerId: string
): Promise<ActionResult<PaymentMethodSummary[]>> {
  if (!customerId) {
    return { success: false, error: "customerId is required." };
  }
  return stripeService.listPaymentMethods(customerId);
}

/**
 * Called from app/api/webhooks/stripe/route.ts.
 * Verifies the signature and dispatches the event — kept here so the
 * route handler stays a thin adapter and all logic stays testable/importable.
 */
export async function handleStripeWebhook(
  rawBody: string,
  signature: string
): Promise<ActionResult<{ received: true }>> {
  try {
    const event = stripeService.constructWebhookEvent(rawBody, signature);
    await stripeService.handleWebhookEvent(event);
    return { success: true, data: { received: true } };
  } catch (error) {
    if (error instanceof Stripe.errors.StripeSignatureVerificationError) {
      return { success: false, error: "Invalid webhook signature." };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Webhook handling failed.",
    };
  }
}
