// Types for the Stripe One-time Payments module.
// These are safe to import anywhere (server or client).

import type Stripe from "stripe";

/**
 * Normalized payment status used across the module.
 * Maps from Stripe's PaymentIntent.status.
 */
export type PaymentStatus =
  | "requires_payment_method"
  | "requires_confirmation"
  | "requires_action"
  | "processing"
  | "succeeded"
  | "canceled"
  | "failed"; // normalized from requires_payment_method after a failed attempt

/**
 * Generic result wrapper returned by every service/action function.
 * Keeps error handling consistent across the module.
 */
export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

/** Params to create a Checkout Session (hosted Stripe payment page). */
export interface CreateCheckoutSessionParams {
  /** Amount in the smallest currency unit (e.g. cents for USD). */
  amount: number;
  currency: string;
  /** Short description shown on the Checkout page and receipt. */
  productName: string;
  productDescription?: string;
  /** Where Stripe redirects after a successful payment. */
  successUrl: string;
  /** Where Stripe redirects if the customer cancels. */
  cancelUrl: string;
  /** Optional metadata to attach to the session (e.g. internal order id). */
  metadata?: Record<string, string>;
  customerEmail?: string;
}

/** Params to create a PaymentIntent directly (custom/embedded payment UI). */
export interface CreatePaymentIntentParams {
  amount: number;
  currency: string;
  metadata?: Record<string, string>;
  customerEmail?: string;
  /** Automatic payment methods (cards, wallets, etc.) enabled by default. */
  automaticPaymentMethods?: boolean;
}

export interface RefundParams {
  paymentIntentId: string;
  /** Omit for a full refund. */
  amount?: number;
  reason?: "duplicate" | "fraudulent" | "requested_by_customer";
}

export interface PaymentSummary {
  id: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  created: number;
  customerEmail?: string | null;
  metadata: Record<string, string>;
}

export interface RefundSummary {
  id: string;
  amount: number;
  status: Stripe.Refund.Status | null;
  reason: string | null;
  paymentIntentId: string;
}

export interface PaymentMethodSummary {
  id: string;
  type: string;
  card?: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  };
}

/** Shape of the events this module actually handles from the webhook. */
export type HandledWebhookEvent =
  | "payment_intent.succeeded"
  | "payment_intent.payment_failed"
  | "payment_intent.canceled"
  | "charge.refunded"
  | "checkout.session.completed";
