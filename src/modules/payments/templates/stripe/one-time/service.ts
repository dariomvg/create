// Internal Stripe service.
// This file owns all direct communication with the Stripe API.
// Do not import Stripe SDK anywhere else — always go through actions.ts or client.ts.
// You should not need to edit this file; it's meant to stay stable while
// actions.ts/client.ts are what the rest of the app touches.

import "server-only";
import Stripe from "stripe";
import type {
  ActionResult,
  CreateCheckoutSessionParams,
  CreatePaymentIntentParams,
  PaymentMethodSummary,
  PaymentStatus,
  PaymentSummary,
  RefundParams,
  RefundSummary,
} from "./types";

const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
  // Fails fast at import time instead of failing obscurely on first call.
  throw new Error(
    "STRIPE_SECRET_KEY is not set. Add it to your .env.local file."
  );
}

// Single shared Stripe client instance for the whole app.
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

function toPaymentStatus(
  status: Stripe.PaymentIntent.Status,
  lastPaymentError: Stripe.PaymentIntent["last_payment_error"]
): PaymentStatus {
  if (status === "requires_payment_method" && lastPaymentError) {
    return "failed";
  }
  return status as PaymentStatus;
}

function toPaymentSummary(intent: Stripe.PaymentIntent): PaymentSummary {
  return {
    id: intent.id,
    status: toPaymentStatus(intent.status, intent.last_payment_error),
    amount: intent.amount,
    currency: intent.currency,
    created: intent.created,
    customerEmail: intent.receipt_email,
    metadata: intent.metadata,
  };
}

export const stripeService = {
  createCheckoutSession(params: CreateCheckoutSessionParams) {
    return safeCall(() =>
      stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: params.currency,
              product_data: {
                name: params.productName,
                description: params.productDescription,
              },
              unit_amount: params.amount,
            },
            quantity: 1,
          },
        ],
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        customer_email: params.customerEmail,
        metadata: params.metadata,
      })
    );
  },

  createPaymentIntent(params: CreatePaymentIntentParams) {
    return safeCall(async () => {
      const intent = await stripe.paymentIntents.create({
        amount: params.amount,
        currency: params.currency,
        receipt_email: params.customerEmail,
        metadata: params.metadata,
        automatic_payment_methods: {
          enabled: params.automaticPaymentMethods ?? true,
        },
      });
      return intent;
    });
  },

  async getPayment(paymentIntentId: string) {
    return safeCall(async () => {
      const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
      return toPaymentSummary(intent);
    });
  },

  async getPaymentStatus(paymentIntentId: string) {
    return safeCall(async () => {
      const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
      return toPaymentStatus(intent.status, intent.last_payment_error);
    });
  },

  cancelPayment(paymentIntentId: string) {
    return safeCall(() => stripe.paymentIntents.cancel(paymentIntentId));
  },

  refund(params: RefundParams) {
    return safeCall(async (): Promise<RefundSummary> => {
      const refund = await stripe.refunds.create({
        payment_intent: params.paymentIntentId,
        amount: params.amount, // omit for full refund
        reason: params.reason,
      });
      return {
        id: refund.id,
        amount: refund.amount,
        status: refund.status,
        reason: refund.reason,
        paymentIntentId: params.paymentIntentId,
      };
    });
  },

  async listPaymentMethods(customerId: string) {
    return safeCall(async (): Promise<PaymentMethodSummary[]> => {
      const methods = await stripe.paymentMethods.list({
        customer: customerId,
        type: "card",
      });
      return methods.data.map((pm) => ({
        id: pm.id,
        type: pm.type,
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

  /** Verifies the webhook signature and parses the raw event. Throws on invalid signature. */
  constructWebhookEvent(payload: string | Buffer, signature: string) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error(
        "STRIPE_WEBHOOK_SECRET is not set. Add it to your .env.local file."
      );
    }
    return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  },

  /**
   * Handles a verified webhook event.
   * Extend the switch cases here if you need to react to more event types —
   * this is the one place in the module meant to grow with your app's needs.
   */
  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const intent = event.data.object as Stripe.PaymentIntent;
        // TODO: fulfill the order / grant access using intent.metadata.
        console.log(`Payment succeeded: ${intent.id}`);
        break;
      }
      case "payment_intent.payment_failed": {
        const intent = event.data.object as Stripe.PaymentIntent;
        console.log(`Payment failed: ${intent.id}`);
        break;
      }
      case "payment_intent.canceled": {
        const intent = event.data.object as Stripe.PaymentIntent;
        console.log(`Payment canceled: ${intent.id}`);
        break;
      }
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        console.log(`Charge refunded: ${charge.id}`);
        break;
      }
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log(`Checkout session completed: ${session.id}`);
        break;
      }
      default:
        // Unhandled event types are ignored by design — Stripe sends many
        // more than this module cares about.
        break;
    }
  },
};
