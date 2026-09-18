/**
 * service.ts
 * ---------------------------------------------------------------------------
 * Internal Lemon Squeezy logic. This file talks directly to the Lemon Squeezy
 * API via the official SDK (@lemonsqueezy/lemonsqueezy.js).
 *
 * Do NOT import this file directly from components or routes.
 * Use `actions.ts` (server) or `client.ts` (client) instead — they wrap these
 * functions with the shape your app should actually consume.
 * ---------------------------------------------------------------------------
 */

import crypto from "node:crypto";
import {
  lemonSqueezySetup,
  createCheckout,
  getOrder,
  issueOrderRefund,
} from "@lemonsqueezy/lemonsqueezy.js";
import type {
  CreateCheckoutParams,
  CheckoutResult,
  LemonSqueezyOrder,
  OrderStatus,
  RefundOrderParams,
  RefundResult,
  LemonSqueezyWebhookPayload,
} from "./types";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let isConfigured = false;

/**
 * Configures the Lemon Squeezy SDK with the API key. Safe to call multiple
 * times — only runs the actual setup once per server process.
 */
function ensureConfigured(): void {
  if (isConfigured) return;

  const apiKey = process.env.LEMONSQUEEZY_API_KEY;
  if (!apiKey) {
    throw new Error("LEMONSQUEEZY_API_KEY is not set in the environment.");
  }

  lemonSqueezySetup({
    apiKey,
    onError: (error) => {
      // Centralized SDK-level error logging.
      console.error("[lemonsqueezy] SDK error:", error);
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

function mapOrder(raw: any): LemonSqueezyOrder {
  const attrs = raw.attributes;
  return {
    id: raw.id,
    identifier: attrs.identifier,
    storeId: attrs.store_id,
    customerId: attrs.customer_id,
    status: attrs.status as OrderStatus,
    statusFormatted: attrs.status_formatted,
    currency: attrs.currency,
    subtotal: attrs.subtotal,
    tax: attrs.tax,
    total: attrs.total,
    refundedAmount: attrs.refunded_amount ?? 0,
    refunded: Boolean(attrs.refunded),
    refundedAt: attrs.refunded_at ?? null,
    userEmail: attrs.user_email,
    userName: attrs.user_name,
    createdAt: attrs.created_at,
    cardBrand: attrs.card_brand ?? null,
    cardLastFour: attrs.card_last_four ?? null,
    receiptUrl: attrs.urls?.receipt ?? null,
  };
}

// ---------------------------------------------------------------------------
// Checkout / Order (a "payment" in Lemon Squeezy is an Order created from a
// completed Checkout — there is no separate "create payment" endpoint).
// ---------------------------------------------------------------------------

export async function createCheckoutRaw(
  params: CreateCheckoutParams
): Promise<CheckoutResult> {
  ensureConfigured();
  const storeId = getStoreId();

  const { data, error } = await createCheckout(storeId, params.variantId, {
    checkoutOptions: {
      embed: params.embed ?? false,
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
    throw new Error(error?.message ?? "Failed to create checkout.");
  }

  const attrs = data.data.attributes;
  return {
    id: data.data.id,
    url: attrs.url,
    expiresAt: attrs.expires_at ?? null,
  };
}

export async function getOrderRaw(orderId: string): Promise<LemonSqueezyOrder> {
  ensureConfigured();

  const { data, error } = await getOrder(orderId);

  if (error || !data) {
    throw new Error(error?.message ?? `Order ${orderId} not found.`);
  }

  return mapOrder(data.data);
}

// ---------------------------------------------------------------------------
// Refunds — Lemon Squeezy exposes a single refund endpoint. Passing `amount`
// issues a partial refund; omitting it issues a full refund.
// ---------------------------------------------------------------------------

export async function refundOrderRaw(
  params: RefundOrderParams
): Promise<RefundResult> {
  ensureConfigured();

  const { data, error } = await issueOrderRefund(
    params.orderId,
    params.amount
  );

  if (error || !data) {
    throw new Error(error?.message ?? `Failed to refund order ${params.orderId}.`);
  }

  const attrs = data.data.attributes;
  return {
    orderId: data.data.id,
    refunded: Boolean(attrs.refunded),
    refundedAmount: attrs.refunded_amount ?? 0,
    status: attrs.status as OrderStatus,
  };
}

// ---------------------------------------------------------------------------
// Cancellation — NOT implemented on purpose.
// Lemon Squeezy has no API to cancel a paid order. An *unfinished* checkout
// simply expires on its own (see `expiresAt` above) — there is nothing to
// call to cancel it manually. See SETUP.md for details.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Webhook signature verification
// ---------------------------------------------------------------------------

/**
 * Verifies the `X-Signature` header Lemon Squeezy sends with every webhook
 * request, using the raw request body (must NOT be JSON.parse'd beforehand).
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null
): boolean {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("LEMONSQUEEZY_WEBHOOK_SECRET is not set in the environment.");
  }
  if (!signatureHeader) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  const expectedBuffer = Buffer.from(expected, "utf8");
  const receivedBuffer = Buffer.from(signatureHeader, "utf8");

  if (expectedBuffer.length !== receivedBuffer.length) return false;

  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

export function parseWebhookPayload(rawBody: string): LemonSqueezyWebhookPayload {
  return JSON.parse(rawBody) as LemonSqueezyWebhookPayload;
}
