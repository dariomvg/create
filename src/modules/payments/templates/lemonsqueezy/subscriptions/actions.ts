/**
 * actions.ts
 * ---------------------------------------------------------------------------
 * Server-side functions ready to import into Server Components / Server
 * Actions. Every function wraps `service.ts` and returns a typed
 * `SubscriptionResult<T>` instead of throwing.
 * ---------------------------------------------------------------------------
 */
import "server-only";

import {
  cancelSubscriptionRaw,
  changeSubscriptionPlanRaw,
  changeSubscriptionQuantityRaw,
  createSubscriptionCheckoutRaw,
  extendTrialRaw,
  getSubscriptionRaw,
  pauseSubscriptionRaw,
  resumeCancelledSubscriptionRaw,
  unpauseSubscriptionRaw,
} from "./service";
import type {
  ChangeSubscriptionPlanParams,
  ChangeSubscriptionQuantityParams,
  CreateSubscriptionCheckoutParams,
  LemonSqueezySubscription,
  PauseSubscriptionParams,
  SubscriptionCheckoutResult,
  SubscriptionResult,
} from "./types";

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error.";
}

// ---------------------------------------------------------------------------
// Create (a Subscription is created once the checkout is completed — there
// is no separate "create subscription" call).
// ---------------------------------------------------------------------------

export async function createSubscriptionCheckout(
  params: CreateSubscriptionCheckoutParams
): Promise<SubscriptionResult<SubscriptionCheckoutResult>> {
  try {
    const checkout = await createSubscriptionCheckoutRaw(params);
    return { success: true, data: checkout };
  } catch (error) {
    return { success: false, error: toErrorMessage(error) };
  }
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function getSubscription(
  subscriptionId: string
): Promise<SubscriptionResult<LemonSqueezySubscription>> {
  try {
    const subscription = await getSubscriptionRaw(subscriptionId);
    return { success: true, data: subscription };
  } catch (error) {
    return { success: false, error: toErrorMessage(error) };
  }
}

export async function getSubscriptionStatus(
  subscriptionId: string
): Promise<SubscriptionResult<LemonSqueezySubscription["status"]>> {
  const result = await getSubscription(subscriptionId);
  if (!result.success) return result;
  return { success: true, data: result.data.status };
}

/** Read-only: when the subscription will next renew. There is no "renew"
 *  action to call — renewal happens automatically on Lemon Squeezy's side. */
export async function getRenewalInfo(
  subscriptionId: string
): Promise<SubscriptionResult<{ renewsAt: string | null; status: LemonSqueezySubscription["status"] }>> {
  const result = await getSubscription(subscriptionId);
  if (!result.success) return result;
  return {
    success: true,
    data: { renewsAt: result.data.renewsAt, status: result.data.status },
  };
}

/** Read-only: when the subscription ends (if cancelled) or expired. */
export async function getExpirationInfo(
  subscriptionId: string
): Promise<SubscriptionResult<{ endsAt: string | null; status: LemonSqueezySubscription["status"] }>> {
  const result = await getSubscription(subscriptionId);
  if (!result.success) return result;
  return {
    success: true,
    data: { endsAt: result.data.endsAt, status: result.data.status },
  };
}

// ---------------------------------------------------------------------------
// Cancel / Resume-from-cancel
// ---------------------------------------------------------------------------

export async function cancelSubscription(
  subscriptionId: string
): Promise<SubscriptionResult<LemonSqueezySubscription>> {
  try {
    const subscription = await cancelSubscriptionRaw(subscriptionId);
    return { success: true, data: subscription };
  } catch (error) {
    return { success: false, error: toErrorMessage(error) };
  }
}

/**
 * Reverts a cancellation while still inside the grace period (before
 * `endsAt`). For resuming a *paused* subscription, use `unpauseSubscription`
 * instead — these are two different states in Lemon Squeezy.
 */
export async function resumeCancelledSubscription(
  subscriptionId: string
): Promise<SubscriptionResult<LemonSqueezySubscription>> {
  try {
    const subscription = await resumeCancelledSubscriptionRaw(subscriptionId);
    return { success: true, data: subscription };
  } catch (error) {
    return { success: false, error: toErrorMessage(error) };
  }
}

// ---------------------------------------------------------------------------
// Pause / Unpause
// ---------------------------------------------------------------------------

export async function pauseSubscription(
  params: PauseSubscriptionParams
): Promise<SubscriptionResult<LemonSqueezySubscription>> {
  try {
    const subscription = await pauseSubscriptionRaw(params);
    return { success: true, data: subscription };
  } catch (error) {
    return { success: false, error: toErrorMessage(error) };
  }
}

/**
 * Un-pauses a *paused* subscription. For reverting a cancellation, use
 * `resumeCancelledSubscription` instead.
 */
export async function unpauseSubscription(
  subscriptionId: string
): Promise<SubscriptionResult<LemonSqueezySubscription>> {
  try {
    const subscription = await unpauseSubscriptionRaw(subscriptionId);
    return { success: true, data: subscription };
  } catch (error) {
    return { success: false, error: toErrorMessage(error) };
  }
}

// ---------------------------------------------------------------------------
// Plan change — single function covers upgrade, downgrade and any other
// plan change, since Lemon Squeezy has one "update subscription" operation
// for all of them. Your UI decides what to call it.
// ---------------------------------------------------------------------------

export async function changeSubscriptionPlan(
  params: ChangeSubscriptionPlanParams
): Promise<SubscriptionResult<LemonSqueezySubscription>> {
  try {
    const subscription = await changeSubscriptionPlanRaw(params);
    return { success: true, data: subscription };
  } catch (error) {
    return { success: false, error: toErrorMessage(error) };
  }
}

// ---------------------------------------------------------------------------
// Quantity change
// ---------------------------------------------------------------------------

export async function changeSubscriptionQuantity(
  params: ChangeSubscriptionQuantityParams
): Promise<SubscriptionResult<{ subscriptionItemId: number; quantity: number }>> {
  try {
    const result = await changeSubscriptionQuantityRaw(params);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: toErrorMessage(error) };
  }
}

// ---------------------------------------------------------------------------
// Trial extension
// ---------------------------------------------------------------------------

export async function extendTrial(
  subscriptionId: string,
  trialEndsAt: string
): Promise<SubscriptionResult<LemonSqueezySubscription>> {
  try {
    const subscription = await extendTrialRaw(subscriptionId, trialEndsAt);
    return { success: true, data: subscription };
  } catch (error) {
    return { success: false, error: toErrorMessage(error) };
  }
}
