/**
 * Types for the Lemon Squeezy Subscriptions module.
 * These mirror the relevant subset of the Lemon Squeezy API
 * (Subscriptions, Subscription Items, Checkouts, Webhooks).
 */

// ---------------------------------------------------------------------------
// Generic result wrapper used by every action/client function in this module
// ---------------------------------------------------------------------------

export type SubscriptionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// ---------------------------------------------------------------------------
// Checkout (creating a subscription always starts as a Checkout, same as
// one-time payments — the Subscription itself is created once it's paid).
// ---------------------------------------------------------------------------

export interface CreateSubscriptionCheckoutParams {
  /** Lemon Squeezy variant ID for the plan being subscribed to. */
  variantId: number;
  email?: string;
  customData?: Record<string, string | number | boolean>;
  redirectUrl?: string;
  embed?: boolean;
  /** Skip the variant's default trial period for this checkout, if it has one. */
  skipTrial?: boolean;
}

export interface SubscriptionCheckoutResult {
  id: string;
  url: string;
  expiresAt: string | null;
}

// ---------------------------------------------------------------------------
// Subscription
// ---------------------------------------------------------------------------

export type SubscriptionStatus =
  | "on_trial"
  | "active"
  | "paused"
  | "past_due"
  | "unpaid"
  | "cancelled"
  | "expired"
  | "incomplete"
  | "incomplete_expired";

export interface SubscriptionPause {
  mode: "void" | "free";
  resumesAt: string | null;
}

export interface LemonSqueezySubscription {
  id: string;
  storeId: number;
  customerId: number;
  orderId: number;
  productId: number;
  variantId: number;
  productName: string;
  variantName: string;
  userEmail: string;
  userName: string;
  status: SubscriptionStatus;
  statusFormatted: string;
  /** Whether the subscription is scheduled to cancel at the end of the
   *  current grace period (still active until `endsAt`). */
  cancelled: boolean;
  pause: SubscriptionPause | null;
  trialEndsAt: string | null;
  renewsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  /** The first (and, for single-item subscriptions, only) subscription item id.
   *  Needed for `changeSubscriptionQuantity`. */
  firstSubscriptionItemId: number | null;
  cardBrand: string | null;
  cardLastFour: string | null;
  customerPortalUrl: string | null;
  updatePaymentMethodUrl: string | null;
}

// ---------------------------------------------------------------------------
// Plan / quantity changes
// ---------------------------------------------------------------------------

export interface ChangeSubscriptionPlanParams {
  subscriptionId: string;
  /** New variant id — covers upgrade, downgrade and any other plan change,
   *  since Lemon Squeezy has a single "update subscription" operation for
   *  all of them. */
  variantId: number;
  /** If true, charges the price difference immediately instead of waiting
   *  for the next renewal. */
  invoiceImmediately?: boolean;
  /** If true, no proration is charged; the customer pays the new price
   *  starting at the next renewal. */
  disableProrations?: boolean;
}

export interface ChangeSubscriptionQuantityParams {
  subscriptionItemId: number;
  quantity: number;
}

export interface PauseSubscriptionParams {
  subscriptionId: string;
  /** "void": no payments during the pause. "free": customer keeps access
   *  for free during the pause. */
  mode?: "void" | "free";
  /** ISO date to automatically resume the subscription. Omit to pause indefinitely. */
  resumesAt?: string;
}

// ---------------------------------------------------------------------------
// Webhooks — lifecycle events only (no payment/invoice events; those belong
// to a future billing module, same split as the Stripe modules).
// ---------------------------------------------------------------------------

export type LemonSqueezySubscriptionWebhookEventName =
  | "subscription_created"
  | "subscription_updated"
  | "subscription_cancelled"
  | "subscription_resumed"
  | "subscription_paused"
  | "subscription_unpaused"
  | "subscription_expired"
  | "subscription_plan_changed";

export interface LemonSqueezySubscriptionWebhookPayload {
  meta: {
    event_name: LemonSqueezySubscriptionWebhookEventName;
    custom_data?: Record<string, unknown>;
  };
  data: {
    type: "subscriptions";
    id: string;
    attributes: Record<string, unknown>;
  };
}
