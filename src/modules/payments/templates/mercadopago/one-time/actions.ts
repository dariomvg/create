"use server";

/**
 * Server actions for the Mercado Pago One-time Payments module.
 *
 * These are the functions meant to be imported directly into server
 * components (or invoked as Server Actions from client components). They
 * are thin wrappers around `service.ts` — no Mercado Pago SDK logic lives
 * here, only orchestration and input shaping.
 */

import {
  createPreference,
  getPayment as getPaymentService,
  getPaymentStatus as getPaymentStatusService,
  cancelPayment as cancelPaymentService,
  refundPayment as refundPaymentService,
  getPaymentMethods as getPaymentMethodsService,
} from "./service";
import type {
  CreatePreferenceInput,
  MPPreferenceResult,
  MPPayment,
  PaymentStatusResult,
  RefundResult,
  PaymentMethodInfo,
  MPResult,
} from "./types";

// ---------------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------------

/**
 * Creates a checkout preference for a one-time payment and returns the URL
 * to redirect the user to.
 */
export async function createCheckout(
  input: CreatePreferenceInput
): Promise<MPResult<MPPreferenceResult>> {
  if (!input.items?.length) {
    return { success: false, error: "At least one item is required to create a checkout." };
  }
  return createPreference(input);
}

// ---------------------------------------------------------------------------
// Payment lookup
// ---------------------------------------------------------------------------

/** Fetches the full payment record by id. */
export async function getPayment(paymentId: string | number): Promise<MPResult<MPPayment>> {
  if (!paymentId) {
    return { success: false, error: "A paymentId is required." };
  }
  return getPaymentService(paymentId);
}

/** Fetches a simplified status snapshot (status + status_detail) for a payment. */
export async function getPaymentStatus(
  paymentId: string | number
): Promise<MPResult<PaymentStatusResult>> {
  if (!paymentId) {
    return { success: false, error: "A paymentId is required." };
  }
  return getPaymentStatusService(paymentId);
}

// ---------------------------------------------------------------------------
// Success / failure checks
// ---------------------------------------------------------------------------

/**
 * Checks whether a payment succeeded. Intended to be called from the
 * success redirect state with the `payment_id` query param Mercado Pago
 * appends to your `back_urls.success` URL.
 */
export async function checkPaymentSuccess(
  paymentId: string | number
): Promise<MPResult<{ success: boolean; payment: PaymentStatusResult }>> {
  const result = await getPaymentStatusService(paymentId);
  if (!result.success) return result;

  return {
    success: true,
    data: { success: result.data.status === "approved", payment: result.data },
  };
}

/**
 * Checks whether a payment failed. Intended to be called from the failure
 * redirect state with the `payment_id` query param Mercado Pago appends to
 * your `back_urls.failure` URL.
 */
export async function checkPaymentFailure(
  paymentId: string | number
): Promise<MPResult<{ failed: boolean; payment: PaymentStatusResult }>> {
  const result = await getPaymentStatusService(paymentId);
  if (!result.success) return result;

  const failed = result.data.status === "rejected" || result.data.status === "cancelled";
  return { success: true, data: { failed, payment: result.data } };
}

// ---------------------------------------------------------------------------
// Cancellation
// ---------------------------------------------------------------------------

/**
 * Cancels a payment. Only works while the payment is "pending" or
 * "in_process" — Mercado Pago rejects cancellation of an "approved" payment,
 * use refundPayment instead in that case.
 */
export async function cancelPayment(paymentId: string | number): Promise<MPResult<MPPayment>> {
  if (!paymentId) {
    return { success: false, error: "A paymentId is required." };
  }
  return cancelPaymentService(paymentId);
}

// ---------------------------------------------------------------------------
// Refunds
// ---------------------------------------------------------------------------

/** Issues a full refund for a payment. */
export async function refundPayment(paymentId: string | number): Promise<MPResult<RefundResult>> {
  if (!paymentId) {
    return { success: false, error: "A paymentId is required." };
  }
  return refundPaymentService(paymentId);
}

/** Issues a partial refund for a payment for the given amount. */
export async function partialRefundPayment(
  paymentId: string | number,
  amount: number
): Promise<MPResult<RefundResult>> {
  if (!paymentId) {
    return { success: false, error: "A paymentId is required." };
  }
  if (!amount || amount <= 0) {
    return { success: false, error: "A positive amount is required for a partial refund." };
  }
  return refundPaymentService(paymentId, amount);
}

// ---------------------------------------------------------------------------
// Payment methods
// ---------------------------------------------------------------------------

/** Lists the payment methods available/enabled for this Mercado Pago account. */
export async function getPaymentMethods(): Promise<MPResult<PaymentMethodInfo[]>> {
  return getPaymentMethodsService();
}
