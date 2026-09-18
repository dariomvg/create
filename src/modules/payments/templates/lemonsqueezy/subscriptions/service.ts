/**
 * service.ts
 * ---------------------------------------------------------------------------
 * Internal Lemon Squeezy Subscriptions logic. Talks directly to the Lemon
 * Squeezy API via the official SDK (@lemonsqueezy/lemonsqueezy.js).
 *
 * Do NOT import this file directly from components or routes.
 * Use `actions.ts` (server) or `client.ts` (client) instead.
 * ---------------------------------------------------------------------------
 */

import crypto from "node:crypto";
import {
  lemonSqueezySetup,
  createCheckout,
  getSubscription,
  updateSubscription,
  updateSubscriptionItem,
  cancelSubscription,
  resumeSubscription,
  pauseSubscription,
  unpauseSubscription,
} from "@lemonsqueezy/lemonsqueezy.js";
import type {
  ChangeSubscriptionPlanParams,
  ChangeSubscriptionQuantityParams,
  CreateSubscriptionCheckoutParams,
  LemonSqueezySubscription,
  LemonSqueezySubscriptionWebhookPayload,
  PauseSubscriptionParams,
  SubscriptionCheckoutResult,
  SubscriptionStatus,
} from "./types";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let isConfigured = false;

/** Configures the Lemon Squeezy SDK. Safe to call multiple times. */
function ensureConfigured(): void {
  if (isConfigured) return;

  const apiKey = process.env.LEMONSQUEEZY_API_KEY;
  if (!apiKey) {
    throw new Error("LEMONSQUEEZY_API_KEY is not set in the environment.");
  }

  lemonSqueezySetup({
    apiKey,
    onError: (error) => {
      console.error("[lemonsqueezy-subscriptions] SDK error:", error);
    },
  });

  isConfigured = true;
}

function getStoreId(): string {
  const storeId = process.env.LEMONSQUEEZY_STORE_ID;
  if (!storeId) {
    throw new Error("LEMONSQUEEZY_STORE_ID is not set in the environment.");
  }
  return storeId;
}

// ---------------------------------------------------------------------------
// Mapping helpers (Lemon Squeezy's raw JSON:API attributes -> our types)
// ---------------------------------------------------------------------------

function mapSubscription(raw: any): LemonSqueezySubscription {
  const attrs = raw.attributes;
  return {
    id: raw.id,
    storeId: attrs.store_id,
    customerId: attrs.customer_id,
    orderId: attrs.order_id,
    productId: attrs.product_id,
    variantId: attrs.variant_id,
    productName: attrs.product_name,
    variantName: attrs.variant_name,
    userEmail: attrs.user_email,
    userName: attrs.user_name,
    status: attrs.status as SubscriptionStatus,
    statusFormatted: attrs.status_formatted,
    cancelled: Boolean(attrs.cancelled),
    pause: attrs.pause
      ? { mode: attrs.pause.mode, resumesAt: attrs.pause.resumes_at ?? null }
      : null,
    trialEndsAt: attrs.trial_ends_at ?? null,
    renewsAt: attrs.renews_at ?? null,
    endsAt: attrs.ends_at ?? null,
    createdAt: attrs.created_at,
    firstSubscriptionItemId: attrs.first_subscription_item?.id ?? null,
    cardBrand: attrs.card_brand ?? null,
    cardLastFour: attrs.card_last_four ?? null,
    customerPortalUrl: attrs.urls?.customer_portal ?? null,
    updatePaymentMethodUrl: attrs.urls?.update_payment_method ?? null,
  };
}

// ---------------------------------------------------------------------------
// Checkout (a Subscription is created once this checkout is completed —
// there is no separate "create subscription" endpoint).
// ---------------------------------------------------------------------------

export async function createSubscriptionCheckoutRaw(
  params: CreateSubscriptionCheckoutParams
): Promise<SubscriptionCheckoutResult> {
  ensureConfigured();
  const storeId = getStoreId();

  const { data, error } = await createCheckout(storeId, params.variantId, {
    checkoutOptions: {
      embed: params.embed ?? false,
      skipTrial: params.skipTrial ?? false,
    },
    checkoutData: {
      email: params.email,
      custom: params.customData,
    },
    productOptions: {
      redirectUrl: params.redirectUrl,
      enabledVariants: [params.variantId],
    },
  });

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create subscription checkout.");
  }

  const attrs = data.data.attributes;
  return {
    id: data.data.id,
    url: attrs.url,
    expiresAt: attrs.expires_at ?? null,
  };
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function getSubscriptionRaw(
  subscriptionId: string
): Promise<LemonSqueezySubscription> {
  ensureConfigured();

  const { data, error } = await getSubscription(subscriptionId);

  if (error || !data) {
    throw new Error(error?.message ?? `Subscription ${subscriptionId} not found.`);
  }

  return mapSubscription(data.data);
}

// ---------------------------------------------------------------------------
// Cancel / Resume (cancelled -> grace period -> expired)
// ---------------------------------------------------------------------------

export async function cancelSubscriptionRaw(
  subscriptionId: string
): Promise<LemonSqueezySubscription> {
  ensureConfigured();

  const { data, error } = await cancelSubscription(subscriptionId);

  if (error || !data) {
    throw new Error(error?.message ?? `Failed to cancel subscription ${subscriptionId}.`);
  }

  return mapSubscription(data.data);
}

/**
 * Reverts a cancellation while the subscription is still within its grace
 * period (before `endsAt`). Not to be confused with `unpauseSubscription`,
 * which resumes a *paused* subscription instead.
 */
export async function resumeCancelledSubscriptionRaw(
  subscriptionId: string
): Promise<LemonSqueezySubscription> {
  ensureConfigured();

  const { data, error } = await resumeSubscription(subscriptionId);

  if (error || !data) {
    throw new Error(error?.message ?? `Failed to resume subscription ${subscriptionId}.`);
  }

  return mapSubscription(data.data);
}

// ---------------------------------------------------------------------------
// Pause / Unpause
// ---------------------------------------------------------------------------

export async function pauseSubscriptionRaw(
  params: PauseSubscriptionParams
): Promise<LemonSqueezySubscription> {
  ensureConfigured();

  const { data, error } = await pauseSubscription(params.subscriptionId, {
    mode: params.mode ?? "void",
    resumesAt: params.resumesAt,
  });

  if (error || !data) {
    throw new Error(error?.message ?? `Failed to pause subscription ${params.subscriptionId}.`);
  }

  return mapSubscription(data.data);
}

/** Un-pauses a *paused* subscription. Not to be confused with
 *  `resumeCancelledSubscriptionRaw`, which reverts a cancellation instead. */
export async function unpauseSubscriptionRaw(
  subscriptionId: string
): Promise<LemonSqueezySubscription> {
  ensureConfigured();

  const { data, error } = await unpauseSubscription(subscriptionId);

  if (error || !data) {
    throw new Error(error?.message ?? `Failed to unpause subscription ${subscriptionId}.`);
  }

  return mapSubscription(data.data);
}

// ---------------------------------------------------------------------------
// Plan change (covers upgrade, downgrade and any other plan change — Lemon
// Squeezy has a single "update subscription" operation for all of them).
// ---------------------------------------------------------------------------

export async function changeSubscriptionPlanRaw(
  params: ChangeSubscriptionPlanParams
): Promise<LemonSqueezySubscription> {
  ensureConfigured();

  const { data, error } = await updateSubscription(params.subscriptionId, {
    variantId: params.variantId,
    invoiceImmediately: params.invoiceImmediately,
    disableProrations: params.disableProrations,
  });

  if (error || !data) {
    throw new Error(
      error?.message ?? `Failed to change plan for subscription ${params.subscriptionId}.`
    );
  }

  return mapSubscription(data.data);
}

// ---------------------------------------------------------------------------
// Quantity change
// ---------------------------------------------------------------------------

export async function changeSubscriptionQuantityRaw(
  params: ChangeSubscriptionQuantityParams
): Promise<{ subscriptionItemId: number; quantity: number }> {
  ensureConfigured();

  const { data, error } = await updateSubscriptionItem(
    params.subscriptionItemId,
    params.quantity
  );

  if (error || !data) {
    throw new Error(
      error?.message ?? `Failed to update quantity for subscription item ${params.subscriptionItemId}.`
    );
  }

  return {
    subscriptionItemId: Number(data.data.id),
    quantity: data.data.attributes.quantity,
  };
}

// ---------------------------------------------------------------------------
// Trial extension
// ---------------------------------------------------------------------------

export async function extendTrialRaw(
  subscriptionId: string,
  trialEndsAt: string
): Promise<LemonSqueezySubscription> {
  ensureConfigured();

  const { data, error } = await updateSubscription(subscriptionId, {
    trialEndsAt,
  });

  if (error || !data) {
    throw new Error(
      error?.message ?? `Failed to extend trial for subscription ${subscriptionId}.`
    );
  }

  return mapSubscription(data.data);
}

// ---------------------------------------------------------------------------
// Webhook signature verification (same scheme as the payments module, but
// this module registers its own webhook + secret in the Lemon Squeezy
// dashboard, scoped to subscription lifecycle events only).
// ---------------------------------------------------------------------------

export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null
): boolean {
  const secret = process.env.LEMONSQUEEZY_SUBSCRIPTIONS_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error(
      "LEMONSQUEEZY_SUBSCRIPTIONS_WEBHOOK_SECRET is not set in the environment."
    );
  }
  if (!signatureHeader) return false;

  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

  const expectedBuffer = Buffer.from(expected, "utf8");
  const receivedBuffer = Buffer.from(signatureHeader, "utf8");

  if (expectedBuffer.length !== receivedBuffer.length) return false;

  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

export function parseWebhookPayload(
  rawBody: string
): LemonSqueezySubscriptionWebhookPayload {
  return JSON.parse(rawBody) as LemonSqueezySubscriptionWebhookPayload;
}
