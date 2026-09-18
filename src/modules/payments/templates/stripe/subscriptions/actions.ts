"use server";

// Server Actions for the Stripe Subscriptions module.
// Import these directly into Server Components or form actions.
// All Stripe-specific logic lives in service.ts — this file only
// validates input, calls the service, and returns a serializable result.

import { stripeSubscriptionsService } from "./service";
import type {
  ActionResult,
  CancelSubscriptionParams,
  ChangePlanParams,
  ChangeQuantityParams,
  CreateSubscriptionParams,
  ExpirationInfo,
  RenewalInfo,
  SubscriptionStatus,
  SubscriptionSummary,
} from "./types";
import Stripe from "stripe";

/**
 * Creates a subscription. Pass `trialPeriodDays` for a trial — no separate
 * "start trial" function exists since it's the same creation call.
 * If `clientSecret` comes back non-null, confirm it client-side with
 * `confirmSubscriptionPayment` before treating the subscription as active.
 */
export async function createSubscription(
  params: CreateSubscriptionParams
): Promise<ActionResult<SubscriptionSummary>> {
  if (!params.customerId || !params.priceId) {
    return { success: false, error: "customerId and priceId are required." };
  }
  return stripeSubscriptionsService.createSubscription(params);
}

export async function getSubscription(
  subscriptionId: string
): Promise<ActionResult<SubscriptionSummary>> {
  if (!subscriptionId) {
    return { success: false, error: "subscriptionId is required." };
  }
  return stripeSubscriptionsService.getSubscription(subscriptionId);
}

export async function getSubscriptionStatus(
  subscriptionId: string
): Promise<ActionResult<SubscriptionStatus>> {
  if (!subscriptionId) {
    return { success: false, error: "subscriptionId is required." };
  }
  return stripeSubscriptionsService.getSubscriptionStatus(subscriptionId);
}

/** Cancel immediately, or set `atPeriodEnd: true` to let it run out first. */
export async function cancelSubscription(
  params: CancelSubscriptionParams
): Promise<ActionResult<SubscriptionSummary>> {
  if (!params.subscriptionId) {
    return { success: false, error: "subscriptionId is required." };
  }
  return stripeSubscriptionsService.cancelSubscription(params);
}

export async function pauseSubscription(
  subscriptionId: string
): Promise<ActionResult<SubscriptionSummary>> {
  if (!subscriptionId) {
    return { success: false, error: "subscriptionId is required." };
  }
  return stripeSubscriptionsService.pauseSubscription(subscriptionId);
}

export async function resumeSubscription(
  subscriptionId: string
): Promise<ActionResult<SubscriptionSummary>> {
  if (!subscriptionId) {
    return { success: false, error: "subscriptionId is required." };
  }
  return stripeSubscriptionsService.resumeSubscription(subscriptionId);
}

/**
 * Changes the subscription's price — covers upgrade, downgrade, and
 * generic plan changes, since they're the same Stripe operation. Decide
 * the "upgrade" vs "downgrade" label in your UI before calling this.
 */
export async function changeSubscriptionPlan(
  params: ChangePlanParams
): Promise<ActionResult<SubscriptionSummary>> {
  if (!params.subscriptionId || !params.newPriceId) {
    return {
      success: false,
      error: "subscriptionId and newPriceId are required.",
    };
  }
  return stripeSubscriptionsService.changeSubscriptionPlan(params);
}

export async function changeSubscriptionQuantity(
  params: ChangeQuantityParams
): Promise<ActionResult<SubscriptionSummary>> {
  if (!params.subscriptionId) {
    return { success: false, error: "subscriptionId is required." };
  }
  if (params.quantity < 1) {
    return { success: false, error: "quantity must be at least 1." };
  }
  return stripeSubscriptionsService.changeSubscriptionQuantity(params);
}

/** Whether the subscription will renew, and when the next charge lands. */
export async function getRenewalInfo(
  subscriptionId: string
): Promise<ActionResult<RenewalInfo>> {
  if (!subscriptionId) {
    return { success: false, error: "subscriptionId is required." };
  }
  return stripeSubscriptionsService.getRenewalInfo(subscriptionId);
}

/** Whether/when the subscription will stop being active. */
export async function getExpirationInfo(
  subscriptionId: string
): Promise<ActionResult<ExpirationInfo>> {
  if (!subscriptionId) {
    return { success: false, error: "subscriptionId is required." };
  }
  return stripeSubscriptionsService.getExpirationInfo(subscriptionId);
}

/**
 * Called from app/api/webhooks/stripe-subscriptions/route.ts.
 * Verifies the signature and dispatches the event.
 */
export async function handleStripeSubscriptionsWebhook(
  rawBody: string,
  signature: string
): Promise<ActionResult<{ received: true }>> {
  try {
    const event = stripeSubscriptionsService.constructWebhookEvent(
      rawBody,
      signature
    );
    await stripeSubscriptionsService.handleWebhookEvent(event);
    return { success: true, data: { received: true } };
  } catch (error) {
    if (error instanceof Stripe.errors.StripeSignatureVerificationError) {
      return { success: false, error: "Invalid webhook signature." };
    }
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Webhook handling failed.",
    };
  }
}
