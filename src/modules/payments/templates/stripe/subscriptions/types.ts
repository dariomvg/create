// Types for the Stripe Subscriptions module.
// Self-contained: does not import from the payments or billing modules,
// even where shapes look similar, to keep the three modules independent.

import type Stripe from "stripe";

/** Generic result wrapper returned by every service/action function. */
export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export type SubscriptionStatus = Stripe.Subscription.Status;

export interface CreateSubscriptionParams {
  customerId: string;
  priceId: string;
  quantity?: number;
  /** Number of free trial days before the first charge. Omit for no trial. */
  trialPeriodDays?: number;
  metadata?: Record<string, string>;
}

export interface SubscriptionSummary {
  id: string;
  status: SubscriptionStatus;
  customerId: string;
  priceId: string;
  quantity: number;
  currentPeriodStart: number;
  currentPeriodEnd: number;
  cancelAtPeriodEnd: boolean;
  trialEnd: number | null;
  /**
   * PaymentIntent client secret for the subscription's first invoice.
   * Present when the subscription was just created and needs client-side
   * confirmation (e.g. no trial, or a card requiring 3D Secure).
   */
  clientSecret: string | null;
}

/** Applies to any operation that changes a subscription's proration. */
export type ProrationBehavior = "create_prorations" | "none" | "always_invoice";

export interface ChangePlanParams {
  subscriptionId: string;
  newPriceId: string;
  prorationBehavior?: ProrationBehavior;
}

export interface ChangeQuantityParams {
  subscriptionId: string;
  quantity: number;
  prorationBehavior?: ProrationBehavior;
}

export interface CancelSubscriptionParams {
  subscriptionId: string;
  /** If true, cancels at the end of the current period instead of immediately. */
  atPeriodEnd?: boolean;
}

export interface RenewalInfo {
  willRenew: boolean;
  currentPeriodEnd: number;
  nextPaymentAttempt: number | null;
}

export interface ExpirationInfo {
  cancelAtPeriodEnd: boolean;
  /** When the subscription will actually stop being active, if it's ending. */
  expiresAt: number | null;
  status: SubscriptionStatus;
}

/** Events this module's webhook actually reacts to. */
export type HandledSubscriptionWebhookEvent =
  | "customer.subscription.created"
  | "customer.subscription.updated"
  | "customer.subscription.deleted"
  | "customer.subscription.trial_will_end"
  | "customer.subscription.paused"
  | "customer.subscription.resumed"
  | "invoice.paid"
  | "invoice.payment_failed";
