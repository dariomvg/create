// Types for the Stripe Billing module.
// Self-contained: does not import from the stripe-payments module,
// even where shapes look similar, to keep the two modules independent.

import type Stripe from "stripe";

/** Generic result wrapper returned by every service/action function. */
export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface CreatePortalSessionParams {
  customerId: string;
  /** Where Stripe redirects the customer when they leave the portal. */
  returnUrl: string;
}

export type InvoiceStatus =
  | "draft"
  | "open"
  | "paid"
  | "uncollectible"
  | "void";

export interface InvoiceSummary {
  id: string;
  status: InvoiceStatus;
  amountDue: number;
  amountPaid: number;
  currency: string;
  created: number;
  /** Hosted URL of the invoice, safe to share with the customer. */
  hostedInvoiceUrl: string | null;
  /** Direct link to the PDF. */
  invoicePdf: string | null;
  periodStart: number;
  periodEnd: number;
}

export interface ListInvoicesParams {
  customerId: string;
  limit?: number;
  /** For pagination — pass the last invoice id from the previous page. */
  startingAfter?: string;
}

export interface PaymentHistoryEntry {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created: number;
  description: string | null;
}

export interface PaymentMethodSummary {
  id: string;
  type: string;
  isDefault: boolean;
  card?: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  };
}

export interface UpcomingInvoiceSummary {
  amountDue: number;
  currency: string;
  periodStart: number;
  periodEnd: number;
  nextPaymentAttempt: number | null;
}

export interface BillingCycleSummary {
  currentPeriodStart: number;
  currentPeriodEnd: number;
  status: Stripe.Subscription.Status;
  cancelAtPeriodEnd: boolean;
}

/** Events this module's webhook actually reacts to. */
export type HandledBillingWebhookEvent =
  | "invoice.paid"
  | "invoice.payment_failed"
  | "invoice.upcoming"
  | "customer.subscription.updated"
  | "customer.subscription.deleted"
  | "payment_method.attached"
  | "payment_method.detached";
