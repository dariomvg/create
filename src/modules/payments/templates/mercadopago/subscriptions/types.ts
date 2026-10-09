/**
 * Type definitions for the Mercado Pago Subscriptions module.
 * These types mirror Mercado Pago's PreApproval (subscription instance) and
 * authorized payment (individual recurring charge) resources, narrowed down
 * to the fields this module actually uses.
 *
 * This module assumes a PreApprovalPlan already exists (created in the
 * Mercado Pago dashboard or elsewhere) — it does not manage plan catalogs.
 */

// ---------------------------------------------------------------------------
// Subscription (PreApproval) status
// ---------------------------------------------------------------------------

/**
 * Mercado Pago subscription (PreApproval) status values.
 * "cancelled" is terminal — a cancelled subscription cannot be resumed.
 */
export type PreapprovalStatus = "pending" | "authorized" | "paused" | "cancelled";

// ---------------------------------------------------------------------------
// Creation
// ---------------------------------------------------------------------------

/** Optional free trial period, only settable when creating the subscription. */
export interface FreeTrialInput {
  frequency: number;
  frequencyType: "days" | "months";
}

/** Input required to create a subscription against an existing plan. */
export interface CreateSubscriptionInput {
  preapprovalPlanId: string;
  payerEmail: string;
  /** Shown to the payer during authorization. */
  reason?: string;
  /** Your own identifier to reconcile with internal records. */
  externalReference?: string;
  /** Where Mercado Pago redirects the payer after authorizing/declining. */
  backUrl: string;
  /** Only needed if you want to override the plan's default trial. */
  freeTrial?: FreeTrialInput;
}

/** Result returned after successfully creating a subscription. */
export interface MPSubscriptionResult {
  id: string;
  status: PreapprovalStatus;
  /** URL to redirect the payer to, to authorize the subscription. */
  initPoint: string;
}

// ---------------------------------------------------------------------------
// Subscription record
// ---------------------------------------------------------------------------

export interface MPAutoRecurring {
  frequency: number;
  frequencyType: "days" | "months";
  transactionAmount: number;
  currencyId: string;
  startDate: string | null;
  /** If set, the subscription stops renewing after this date. */
  endDate: string | null;
  freeTrial: FreeTrialInput | null;
}

/** Narrowed-down shape of a Mercado Pago PreApproval (subscription) resource. */
export interface MPSubscription {
  id: string;
  status: PreapprovalStatus;
  payerEmail: string;
  preapprovalPlanId: string | null;
  reason: string | null;
  externalReference: string | null;
  autoRecurring: MPAutoRecurring;
  dateCreated: string;
  lastModified: string;
}

/** Simplified status snapshot used by getSubscriptionStatus. */
export interface SubscriptionStatusResult {
  id: string;
  status: PreapprovalStatus;
}

// ---------------------------------------------------------------------------
// Authorized payments (recurring charges)
// ---------------------------------------------------------------------------

export type AuthorizedPaymentStatus = "scheduled" | "processed" | "recycled" | "cancelled";

/** A single recurring charge tied to a subscription. */
export interface AuthorizedPayment {
  id: number;
  preapprovalId: string;
  transactionAmount: number;
  status: AuthorizedPaymentStatus;
  dateCreated: string;
}

// ---------------------------------------------------------------------------
// Renewal / expiration (derived, read-only — there's no "renew" endpoint)
// ---------------------------------------------------------------------------

export interface RenewalInfo {
  lastPaymentDate: string | null;
  /** Estimated from lastPaymentDate + frequency; Mercado Pago doesn't expose this directly. */
  estimatedNextPaymentDate: string | null;
  frequency: number;
  frequencyType: "days" | "months";
}

export interface ExpirationInfo {
  endDate: string | null;
  expired: boolean;
}

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------

/** Shape of the notification body Mercado Pago sends to the webhook route. */
export interface SubscriptionWebhookNotification {
  id?: number;
  /** "subscription_preapproval" (lifecycle; "preapproval" kept as legacy alias) or "subscription_authorized_payment" (a recurring charge). */
  type: "subscription_preapproval" | "preapproval" | "subscription_authorized_payment";
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