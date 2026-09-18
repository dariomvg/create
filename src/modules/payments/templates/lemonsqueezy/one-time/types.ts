/**
 * Types for the Lemon Squeezy One-time Payments module.
 * These mirror the relevant subset of the Lemon Squeezy API (Orders, Checkouts, Webhooks).
 */

// ---------------------------------------------------------------------------
// Generic result wrapper used by every action/client function in this module
// ---------------------------------------------------------------------------

export type PaymentResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// ---------------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------------

export interface CreateCheckoutParams {
  /** Lemon Squeezy variant ID being purchased (this is the "product" the customer pays for). */
  variantId: number;
  /** Prefill the customer's email in the checkout. */
  email?: string;
  /** Custom data forwarded to the order and to every webhook event tied to it. */
  customData?: Record<string, string | number | boolean>;
  /** Where Lemon Squeezy redirects the customer after checkout. */
  redirectUrl?: string;
  /** Whether to render the checkout as an overlay (embed) instead of a full page. */
  embed?: boolean;
}

export interface CheckoutResult {
  id: string;
  url: string;
  expiresAt: string | null;
}

// ---------------------------------------------------------------------------
// Order (this is Lemon Squeezy's equivalent of a "payment")
// ---------------------------------------------------------------------------

export type OrderStatus =
  | "pending"
  | "failed"
  | "paid"
  | "refunded"
  | "partial_refund"
  | "fraudulent";

export interface LemonSqueezyOrder {
  id: string;
  identifier: string;
  storeId: number;
  customerId: number;
  status: OrderStatus;
  statusFormatted: string;
  currency: string;
  subtotal: number;
  tax: number;
  total: number;
  refundedAmount: number;
  refunded: boolean;
  refundedAt: string | null;
  userEmail: string;
  userName: string;
  createdAt: string;
  /** Card brand / last4 as returned by Lemon Squeezy, when available. This is the closest
   *  thing to a "payment method" for a one-time order — Lemon Squeezy does not expose a
   *  separate payment-methods API for one-off purchases. */
  cardBrand: string | null;
  cardLastFour: string | null;
  receiptUrl: string | null;
}

// ---------------------------------------------------------------------------
// Refunds
// ---------------------------------------------------------------------------

export interface RefundOrderParams {
  orderId: string;
  /**
   * Amount in cents. Omit for a full refund.
   * Providing a value smaller than the order total issues a partial refund.
   * This is the single Lemon Squeezy refund endpoint — there is no separate
   * "partial refund" endpoint.
   */
  amount?: number;
}

export interface RefundResult {
  orderId: string;
  refunded: boolean;
  refundedAmount: number;
  status: OrderStatus;
}

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------

export type LemonSqueezyWebhookEventName =
  | "order_created"
  | "order_refunded";

export interface LemonSqueezyWebhookPayload {
  meta: {
    event_name: LemonSqueezyWebhookEventName;
    custom_data?: Record<string, unknown>;
  };
  data: {
    type: "orders";
    id: string;
    attributes: Record<string, unknown>;
  };
}
