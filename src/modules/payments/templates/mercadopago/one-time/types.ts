/**
 * Type definitions for the Mercado Pago One-time Payments module.
 * These types mirror Mercado Pago's Preference and Payment API resources,
 * narrowed down to the fields this module actually uses.
 */

// ---------------------------------------------------------------------------
// Preference (Checkout Pro) types
// ---------------------------------------------------------------------------

/** A single item included in a checkout preference. */
export interface MPPreferenceItem {
  id?: string;
  title: string;
  description?: string;
  quantity: number;
  unit_price: number;
  /** e.g. "ARS", "BRL", "MXN" — defaults to the account's country currency if omitted. */
  currency_id?: string;
}

/** Redirect URLs Mercado Pago uses after the user finishes the checkout. */
export interface MPBackUrls {
  success: string;
  failure: string;
  pending: string;
}

/** Input required to create a checkout preference. */
export interface CreatePreferenceInput {
  items: MPPreferenceItem[];
  backUrls: MPBackUrls;
  /** Arbitrary metadata you want attached to the preference/payment (e.g. internal order id). */
  metadata?: Record<string, unknown>;
  /** Optional external reference, useful to reconcile with your own order records. */
  externalReference?: string;
  /** Whether to auto-redirect back after approval only, or after any final status. Defaults to "approved". */
  autoReturn?: "approved" | "all";
}

/** Result returned after successfully creating a preference. */
export interface MPPreferenceResult {
  id: string;
  /** URL to redirect the user to (production). */
  initPoint: string;
  /** URL to redirect the user to (sandbox/test credentials). */
  sandboxInitPoint: string;
}

// ---------------------------------------------------------------------------
// Payment types
// ---------------------------------------------------------------------------

/**
 * Mercado Pago payment status values.
 * Docs: https://www.mercadopago.com/developers/en/docs/checkout-api/response-handling/collection-status
 */
export type PaymentStatus =
  | "pending"
  | "approved"
  | "authorized"
  | "in_process"
  | "in_mediation"
  | "rejected"
  | "cancelled"
  | "refunded"
  | "charged_back";

/** Narrowed-down shape of a Mercado Pago Payment resource. */
export interface MPPayment {
  id: number;
  status: PaymentStatus;
  statusDetail: string;
  transactionAmount: number;
  currencyId: string;
  dateCreated: string;
  dateApproved: string | null;
  externalReference: string | null;
  metadata: Record<string, unknown>;
  payerEmail: string | null;
}

/** Simplified status snapshot used by getPaymentStatus / success / failure checks. */
export interface PaymentStatusResult {
  id: number;
  status: PaymentStatus;
  statusDetail: string;
}

// ---------------------------------------------------------------------------
// Refunds
// ---------------------------------------------------------------------------

export interface RefundResult {
  id: number;
  paymentId: number;
  amount: number;
  status: string;
  dateCreated: string;
}

// ---------------------------------------------------------------------------
// Payment methods
// ---------------------------------------------------------------------------

export interface PaymentMethodInfo {
  id: string;
  name: string;
  paymentTypeId: string;
  status: string;
  thumbnail: string;
}

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------

/** Shape of the notification body Mercado Pago sends to the webhook route. */
export interface WebhookNotification {
  id?: number;
  /** Resource type, e.g. "payment". */
  type: string;
  /** e.g. "payment.created", "payment.updated". */
  action?: string;
  data: {
    id: string;
  };
}

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

/** Standard error shape returned by every service/action function on failure. */
export interface MPErrorResult {
  success: false;
  error: string;
  code?: string;
}

/** Standard result wrapper used across all service/action functions. */
export type MPResult<T> = { success: true; data: T } | MPErrorResult;
