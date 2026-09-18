"use server";

// Server Actions for the Stripe Billing module.
// Import these directly into Server Components or form actions.
// All Stripe-specific logic lives in service.ts — this file only
// validates input, calls the service, and returns a serializable result.

import { stripeBillingService } from "./service";
import type {
  ActionResult,
  BillingCycleSummary,
  CreatePortalSessionParams,
  InvoiceStatus,
  InvoiceSummary,
  ListInvoicesParams,
  PaymentHistoryEntry,
  PaymentMethodSummary,
  UpcomingInvoiceSummary,
} from "./types";
import Stripe from "stripe";

/** Creates a Customer Portal session and returns its URL for redirect. */
export async function createCustomerPortalSession(
  params: CreatePortalSessionParams
): Promise<ActionResult<{ url: string }>> {
  if (!params.customerId) {
    return { success: false, error: "customerId is required." };
  }
  const result = await stripeBillingService.createPortalSession(params);
  if (!result.success) return result;
  return { success: true, data: { url: result.data.url } };
}

/** Lists invoices for a customer (billing history). */
export async function listInvoices(
  params: ListInvoicesParams
): Promise<ActionResult<InvoiceSummary[]>> {
  if (!params.customerId) {
    return { success: false, error: "customerId is required." };
  }
  return stripeBillingService.listInvoices(params);
}

/** Retrieves a single invoice by id. */
export async function getInvoice(
  invoiceId: string
): Promise<ActionResult<InvoiceSummary>> {
  if (!invoiceId) {
    return { success: false, error: "invoiceId is required." };
  }
  return stripeBillingService.getInvoice(invoiceId);
}

/** Retrieves just the invoice status — cheaper than getInvoice when that's all you need. */
export async function getInvoiceStatus(
  invoiceId: string
): Promise<ActionResult<InvoiceStatus>> {
  if (!invoiceId) {
    return { success: false, error: "invoiceId is required." };
  }
  return stripeBillingService.getInvoiceStatus(invoiceId);
}

/** Raw payment/charge history for a customer, separate from invoice documents. */
export async function listPaymentHistory(
  customerId: string,
  limit?: number
): Promise<ActionResult<PaymentHistoryEntry[]>> {
  if (!customerId) {
    return { success: false, error: "customerId is required." };
  }
  return stripeBillingService.listPaymentHistory(customerId, limit);
}

/** Lists saved payment methods for a customer, flagging which one is the default. */
export async function listPaymentMethods(
  customerId: string
): Promise<ActionResult<PaymentMethodSummary[]>> {
  if (!customerId) {
    return { success: false, error: "customerId is required." };
  }
  return stripeBillingService.listPaymentMethods(customerId);
}

/**
 * Starts the "update payment method" flow: creates a SetupIntent whose
 * clientSecret you pass to a Stripe Elements form on the client.
 */
export async function createSetupIntent(
  customerId: string
): Promise<ActionResult<{ clientSecret: string | null }>> {
  if (!customerId) {
    return { success: false, error: "customerId is required." };
  }
  const result = await stripeBillingService.createSetupIntent(customerId);
  if (!result.success) return result;
  return { success: true, data: { clientSecret: result.data.client_secret } };
}

/** Finishes the "update payment method" flow by setting the new default. */
export async function setDefaultPaymentMethod(
  customerId: string,
  paymentMethodId: string
): Promise<ActionResult<{ id: string }>> {
  if (!customerId || !paymentMethodId) {
    return {
      success: false,
      error: "customerId and paymentMethodId are required.",
    };
  }
  const result = await stripeBillingService.setDefaultPaymentMethod(
    customerId,
    paymentMethodId
  );
  if (!result.success) return result;
  return { success: true, data: { id: result.data.id } };
}

/** Preview of the customer's next invoice before it's finalized. */
export async function getUpcomingInvoice(
  customerId: string
): Promise<ActionResult<UpcomingInvoiceSummary>> {
  if (!customerId) {
    return { success: false, error: "customerId is required." };
  }
  return stripeBillingService.getUpcomingInvoice(customerId);
}

/** Current billing cycle dates and status for a subscription. */
export async function getBillingCycle(
  subscriptionId: string
): Promise<ActionResult<BillingCycleSummary>> {
  if (!subscriptionId) {
    return { success: false, error: "subscriptionId is required." };
  }
  return stripeBillingService.getBillingCycle(subscriptionId);
}

/**
 * Called from app/api/webhooks/stripe-billing/route.ts.
 * Verifies the signature and dispatches the event.
 */
export async function handleStripeBillingWebhook(
  rawBody: string,
  signature: string
): Promise<ActionResult<{ received: true }>> {
  try {
    const event = stripeBillingService.constructWebhookEvent(
      rawBody,
      signature
    );
    await stripeBillingService.handleWebhookEvent(event);
    return { success: true, data: { received: true } };
  } catch (error) {
    if (error instanceof Stripe.errors.StripeSignatureVerificationError) {
      return { success: false, error: "Invalid webhook signature." };
    }
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Webhook handling failed.",
    };
  }
}
