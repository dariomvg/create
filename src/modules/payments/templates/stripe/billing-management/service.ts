// Internal Stripe Billing service.
// Owns all direct communication with the Stripe API for billing/SaaS
// concerns. Do not import the Stripe SDK anywhere else in this module —
// always go through actions.ts or client.ts.
// Independent from lib/stripe/service.ts (the one-time payments module) —
// intentionally not shared, even though both wrap the same Stripe account.

import "server-only";
import Stripe from "stripe";
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

const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
  throw new Error(
    "STRIPE_SECRET_KEY is not set. Add it to your .env.local file."
  );
}

export const stripe = new Stripe(secretKey, {
  apiVersion: "2025-08-27.basil",
  typescript: true,
});

/** Wraps a Stripe call and normalizes errors into ActionResult. */
async function safeCall<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (error) {
    if (error instanceof Stripe.errors.StripeError) {
      return { success: false, error: error.message };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown Stripe error",
    };
  }
}

function toInvoiceSummary(invoice: Stripe.Invoice): InvoiceSummary {
  return {
    id: invoice.id!,
    status: (invoice.status ?? "draft") as InvoiceStatus,
    amountDue: invoice.amount_due,
    amountPaid: invoice.amount_paid,
    currency: invoice.currency,
    created: invoice.created,
    hostedInvoiceUrl: invoice.hosted_invoice_url,
    invoicePdf: invoice.invoice_pdf,
    periodStart: invoice.period_start,
    periodEnd: invoice.period_end,
  };
}

export const stripeBillingService = {
  createPortalSession(params: CreatePortalSessionParams) {
    return safeCall(() =>
      stripe.billingPortal.sessions.create({
        customer: params.customerId,
        return_url: params.returnUrl,
      })
    );
  },

  async listInvoices(params: ListInvoicesParams) {
    return safeCall(async (): Promise<InvoiceSummary[]> => {
      const invoices = await stripe.invoices.list({
        customer: params.customerId,
        limit: params.limit ?? 10,
        starting_after: params.startingAfter,
      });
      return invoices.data.map(toInvoiceSummary);
    });
  },

  async getInvoice(invoiceId: string) {
    return safeCall(async (): Promise<InvoiceSummary> => {
      const invoice = await stripe.invoices.retrieve(invoiceId);
      return toInvoiceSummary(invoice);
    });
  },

  async getInvoiceStatus(invoiceId: string) {
    return safeCall(async (): Promise<InvoiceStatus> => {
      const invoice = await stripe.invoices.retrieve(invoiceId);
      return (invoice.status ?? "draft") as InvoiceStatus;
    });
  },

  /**
   * Payment history is derived from Charges, distinct from Invoices —
   * useful when you want a raw log of money movement rather than
   * invoice documents.
   */
  async listPaymentHistory(customerId: string, limit = 10) {
    return safeCall(async (): Promise<PaymentHistoryEntry[]> => {
      const charges = await stripe.charges.list({
        customer: customerId,
        limit,
      });
      return charges.data.map((charge) => ({
        id: charge.id,
        amount: charge.amount,
        currency: charge.currency,
        status: charge.status,
        created: charge.created,
        description: charge.description,
      }));
    });
  },

  async listPaymentMethods(customerId: string) {
    return safeCall(async (): Promise<PaymentMethodSummary[]> => {
      const [methods, customer] = await Promise.all([
        stripe.paymentMethods.list({ customer: customerId, type: "card" }),
        stripe.customers.retrieve(customerId),
      ]);

      const defaultId =
        !customer.deleted &&
        typeof customer.invoice_settings?.default_payment_method === "string"
          ? customer.invoice_settings.default_payment_method
          : null;

      return methods.data.map((pm) => ({
        id: pm.id,
        type: pm.type,
        isDefault: pm.id === defaultId,
        card: pm.card
          ? {
              brand: pm.card.brand,
              last4: pm.card.last4,
              expMonth: pm.card.exp_month,
              expYear: pm.card.exp_year,
            }
          : undefined,
      }));
    });
  },

  /**
   * Creates a SetupIntent so the client can collect a new card via Stripe
   * Elements without charging it — the recommended, SCA-compliant way to
   * update a saved payment method.
   */
  createSetupIntent(customerId: string) {
    return safeCall(() =>
      stripe.setupIntents.create({
        customer: customerId,
        automatic_payment_methods: { enabled: true },
      })
    );
  },

  /** Sets a payment method as the customer's default for future invoices. */
  setDefaultPaymentMethod(customerId: string, paymentMethodId: string) {
    return safeCall(() =>
      stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: paymentMethodId },
      })
    );
  },

  async getUpcomingInvoice(customerId: string) {
    return safeCall(async (): Promise<UpcomingInvoiceSummary> => {
      const invoice = await stripe.invoices.retrieveUpcoming({
        customer: customerId,
      });
      return {
        amountDue: invoice.amount_due,
        currency: invoice.currency,
        periodStart: invoice.period_start,
        periodEnd: invoice.period_end,
        nextPaymentAttempt: invoice.next_payment_attempt,
      };
    });
  },

  /** Reads the current billing cycle off the customer's subscription. */
  async getBillingCycle(subscriptionId: string) {
    return safeCall(async (): Promise<BillingCycleSummary> => {
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      return {
        currentPeriodStart: sub.current_period_start,
        currentPeriodEnd: sub.current_period_end,
        status: sub.status,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      };
    });
  },

  /** Verifies the billing webhook signature. Throws on invalid signature. */
  constructWebhookEvent(payload: string | Buffer, signature: string) {
    const webhookSecret = process.env.STRIPE_BILLING_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error(
        "STRIPE_BILLING_WEBHOOK_SECRET is not set. Add it to your .env.local file."
      );
    }
    return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  },

  /**
   * Handles a verified billing webhook event.
   * Extend the switch cases here as your app's billing needs grow.
   */
  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        console.log(`Invoice paid: ${invoice.id}`);
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        console.log(`Invoice payment failed: ${invoice.id}`);
        break;
      }
      case "invoice.upcoming": {
        const invoice = event.data.object as Stripe.Invoice;
        console.log(`Upcoming invoice for customer: ${invoice.customer}`);
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        console.log(`Subscription updated: ${sub.id}`);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        console.log(`Subscription deleted: ${sub.id}`);
        break;
      }
      case "payment_method.attached": {
        const pm = event.data.object as Stripe.PaymentMethod;
        console.log(`Payment method attached: ${pm.id}`);
        break;
      }
      case "payment_method.detached": {
        const pm = event.data.object as Stripe.PaymentMethod;
        console.log(`Payment method detached: ${pm.id}`);
        break;
      }
      default:
        // Unhandled event types are ignored by design.
        break;
    }
  },
};
