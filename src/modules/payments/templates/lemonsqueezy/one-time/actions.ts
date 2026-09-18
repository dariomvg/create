/**
 * actions.ts
 * ---------------------------------------------------------------------------
 * Server-side functions ready to import into Server Components / Server
 * Actions. Every function here wraps `service.ts` and returns a typed
 * `PaymentResult<T>` instead of throwing, so callers don't need try/catch.
 *
 * "server-only" prevents this file from ever being bundled into client code.
 * ---------------------------------------------------------------------------
 */
import "server-only";

import {
  createCheckoutRaw,
  getOrderRaw,
  refundOrderRaw,
} from "./service";
import type {
  CreateCheckoutParams,
  CheckoutResult,
  LemonSqueezyOrder,
  PaymentResult,
  RefundOrderParams,
  RefundResult,
} from "./types";

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error.";
}

// ---------------------------------------------------------------------------
// Checkout ("create payment" in Lemon Squeezy IS creating a checkout — the
// Order is only created once the customer completes it).
// ---------------------------------------------------------------------------

export async function createCheckout(
  params: CreateCheckoutParams
): Promise<PaymentResult<CheckoutResult>> {
  try {
    const checkout = await createCheckoutRaw(params);
    return { success: true, data: checkout };
  } catch (error) {
    return { success: false, error: toErrorMessage(error) };
  }
}

// ---------------------------------------------------------------------------
// Payment (Order) retrieval
// ---------------------------------------------------------------------------

export async function getPayment(
  orderId: string
): Promise<PaymentResult<LemonSqueezyOrder>> {
  try {
    const order = await getOrderRaw(orderId);
    return { success: true, data: order };
  } catch (error) {
    return { success: false, error: toErrorMessage(error) };
  }
}

export async function getPaymentStatus(
  orderId: string
): Promise<PaymentResult<LemonSqueezyOrder["status"]>> {
  const result = await getPayment(orderId);
  if (!result.success) return result;
  return { success: true, data: result.data.status };
}

/**
 * Reads the order id from the redirect query params and returns the order
 * only if it actually succeeded (status === "paid").
 *
 * NOTE on identifiers: Lemon Squeezy does not auto-append any id to your
 * redirect URL, and it has no endpoint to look up an Order by the
 * `custom_data` you attach to a Checkout. The reliable identifier here is
 * the Lemon Squeezy Order id. If you need to correlate this back to your
 * own "checkout reference" (e.g. a value you generated before calling
 * `createCheckout` and stored in `customData`), persist the mapping
 * yourself in the webhook route handler when `order_created` fires — see
 * SETUP.md for details.
 */
export async function getPaymentSuccess(
  searchParams: URLSearchParams | Record<string, string | string[] | undefined>
): Promise<PaymentResult<LemonSqueezyOrder>> {
  const orderId = readParam(searchParams, "order_id");
  if (!orderId) {
    return { success: false, error: "Missing order_id in query params." };
  }

  const result = await getPayment(orderId);
  if (!result.success) return result;

  if (result.data.status !== "paid") {
    return { success: false, error: `Order status is "${result.data.status}", not paid.` };
  }

  return result;
}

export async function getPaymentFailure(
  searchParams: URLSearchParams | Record<string, string | string[] | undefined>
): Promise<PaymentResult<{ orderId: string; status: LemonSqueezyOrder["status"] }>> {
  const orderId = readParam(searchParams, "order_id");
  if (!orderId) {
    return { success: false, error: "Missing order_id in query params." };
  }

  const result = await getPayment(orderId);
  if (!result.success) return result;

  if (result.data.status === "paid") {
    return { success: false, error: "Order was actually paid successfully." };
  }

  return { success: true, data: { orderId: result.data.id, status: result.data.status } };
}

function readParam(
  searchParams: URLSearchParams | Record<string, string | string[] | undefined>,
  key: string
): string | null {
  if (searchParams instanceof URLSearchParams) {
    return searchParams.get(key);
  }
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

// ---------------------------------------------------------------------------
// Refunds (single endpoint: pass `amount` for partial, omit for full)
// ---------------------------------------------------------------------------

export async function refundPayment(
  params: RefundOrderParams
): Promise<PaymentResult<RefundResult>> {
  try {
    const refund = await refundOrderRaw(params);
    return { success: true, data: refund };
  } catch (error) {
    return { success: false, error: toErrorMessage(error) };
  }
}

// ---------------------------------------------------------------------------
// Payment method — Lemon Squeezy does not expose a payment-methods API for
// one-time orders. This returns whatever card metadata Lemon Squeezy stored
// on the Order itself (brand/last4), when available.
// ---------------------------------------------------------------------------

export async function getPaymentMethod(
  orderId: string
): Promise<PaymentResult<{ cardBrand: string | null; cardLastFour: string | null }>> {
  const result = await getPayment(orderId);
  if (!result.success) return result;

  return {
    success: true,
    data: {
      cardBrand: result.data.cardBrand,
      cardLastFour: result.data.cardLastFour,
    },
  };
}

// ---------------------------------------------------------------------------
// Cancellation — intentionally not implemented.
// Lemon Squeezy has no API to cancel a paid Order. An unfinished Checkout
// simply expires on its own (see `expiresAt` on CheckoutResult) — there is
// nothing to call. See SETUP.md.
// ---------------------------------------------------------------------------
