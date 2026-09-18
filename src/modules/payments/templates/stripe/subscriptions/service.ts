// Internal Stripe Subscriptions service.
// Owns all direct communication with the Stripe API for recurring
// payments. Do not import the Stripe SDK anywhere else in this module —
// always go through actions.ts or client.ts.
// Independent from lib/stripe/service.ts and lib/stripe-billing/service.ts —
// intentionally not shared, even though all three wrap the same Stripe account.

import "server-only";
import Stripe from "stripe";
import type {
  ActionResult,
  CancelSubscriptionParams,
  ChangePlanParams,
  ChangeQuantityParams,
  CreateSubscriptionParams,
  ExpirationInfo,
  RenewalInfo,
  SubscriptionStatus,
  SubscriptionSummary,
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

function extractClientSecret(sub: Stripe.Subscription): string | null {
  const invoice = sub.latest_invoice;
  if (!invoice || typeof invoice === "string") return null;
  const paymentIntent = invoice.payment_intent;
  if (!paymentIntent || typeof paymentIntent === "string") return null;
  return paymentIntent.client_secret;
}

function toSubscriptionSummary(sub: Stripe.Subscription): SubscriptionSummary {
  const item = sub.items.data[0];
  return {
    id: sub.id,
    status: sub.status,
    customerId:
      typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    priceId: item?.price.id ?? "",
    quantity: item?.quantity ?? 1,
    currentPeriodStart: sub.current_period_start,
    currentPeriodEnd: sub.current_period_end,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    trialEnd: sub.trial_end,
    clientSecret: extractClientSecret(sub),
  };
}

export const stripeSubscriptionsService = {
  createSubscription(params: CreateSubscriptionParams) {
    return safeCall(async (): Promise<SubscriptionSummary> => {
      const sub = await stripe.subscriptions.create({
        customer: params.customerId,
        items: [{ price: params.priceId, quantity: params.quantity ?? 1 }],
        trial_period_days: params.trialPeriodDays,
        metadata: params.metadata,
        payment_behavior: "default_incomplete",
        payment_settings: { save_default_payment_method: "on_subscription" },
        expand: ["latest_invoice.payment_intent"],
      });
      return toSubscriptionSummary(sub);
    });
  },

  async getSubscription(subscriptionId: string) {
    return safeCall(async (): Promise<SubscriptionSummary> => {
      const sub = await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ["latest_invoice.payment_intent"],
      });
      return toSubscriptionSummary(sub);
    });
  },

  async getSubscriptionStatus(subscriptionId: string) {
    return safeCall(async (): Promise<SubscriptionStatus> => {
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      return sub.status;
    });
  },

  cancelSubscription(params: CancelSubscriptionParams) {
    return safeCall(async (): Promise<SubscriptionSummary> => {
      const sub = params.atPeriodEnd
        ? await stripe.subscriptions.update(params.subscriptionId, {
            cancel_at_period_end: true,
          })
        : await stripe.subscriptions.cancel(params.subscriptionId);
      return toSubscriptionSummary(sub);
    });
  },

  /** Pauses billing — the subscription stays active but stops generating invoices. */
  pauseSubscription(subscriptionId: string) {
    return safeCall(async (): Promise<SubscriptionSummary> => {
      const sub = await stripe.subscriptions.update(subscriptionId, {
        pause_collection: { behavior: "void" },
      });
      return toSubscriptionSummary(sub);
    });
  },

  resumeSubscription(subscriptionId: string) {
    return safeCall(async (): Promise<SubscriptionSummary> => {
      const sub = await stripe.subscriptions.update(subscriptionId, {
        pause_collection: null,
      });
      return toSubscriptionSummary(sub);
    });
  },

  /**
   * Covers upgrade, downgrade, and generic "change plan" — all three are
   * the same Stripe operation (swap the item's price). The caller/UI
   * decides which label applies based on the price difference.
   */
  changeSubscriptionPlan(params: ChangePlanParams) {
    return safeCall(async (): Promise<SubscriptionSummary> => {
      const current = await stripe.subscriptions.retrieve(
        params.subscriptionId
      );
      const itemId = current.items.data[0]?.id;
      if (!itemId) {
        throw new Error("Subscription has no items to update.");
      }

      const sub = await stripe.subscriptions.update(params.subscriptionId, {
        items: [{ id: itemId, price: params.newPriceId }],
        proration_behavior: params.prorationBehavior ?? "create_prorations",
      });
      return toSubscriptionSummary(sub);
    });
  },

  changeSubscriptionQuantity(params: ChangeQuantityParams) {
    return safeCall(async (): Promise<SubscriptionSummary> => {
      const current = await stripe.subscriptions.retrieve(
        params.subscriptionId
      );
      const itemId = current.items.data[0]?.id;
      if (!itemId) {
        throw new Error("Subscription has no items to update.");
      }

      const sub = await stripe.subscriptions.update(params.subscriptionId, {
        items: [{ id: itemId, quantity: params.quantity }],
        proration_behavior: params.prorationBehavior ?? "create_prorations",
      });
      return toSubscriptionSummary(sub);
    });
  },

  async getRenewalInfo(subscriptionId: string) {
    return safeCall(async (): Promise<RenewalInfo> => {
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      const willRenew =
        !sub.cancel_at_period_end &&
        (sub.status === "active" || sub.status === "trialing");

      let nextPaymentAttempt: number | null = null;
      if (willRenew) {
        const upcoming = await stripe.invoices.retrieveUpcoming({
          subscription: subscriptionId,
        });
        nextPaymentAttempt = upcoming.next_payment_attempt;
      }

      return {
        willRenew,
        currentPeriodEnd: sub.current_period_end,
        nextPaymentAttempt,
      };
    });
  },

  async getExpirationInfo(subscriptionId: string) {
    return safeCall(async (): Promise<ExpirationInfo> => {
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      const isEnding =
        sub.cancel_at_period_end ||
        sub.status === "canceled" ||
        sub.status === "unpaid";

      return {
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        expiresAt: isEnding
          ? sub.cancel_at ?? sub.current_period_end
          : null,
        status: sub.status,
      };
    });
  },

  /** Verifies the subscriptions webhook signature. Throws on invalid signature. */
  constructWebhookEvent(payload: string | Buffer, signature: string) {
    const webhookSecret = process.env.STRIPE_SUBSCRIPTIONS_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error(
        "STRIPE_SUBSCRIPTIONS_WEBHOOK_SECRET is not set. Add it to your .env.local file."
      );
    }
    return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  },

  /**
   * Handles a verified subscriptions webhook event.
   * Extend the switch cases here as your app's needs grow.
   */
  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case "customer.subscription.created": {
        const sub = event.data.object as Stripe.Subscription;
        console.log(`Subscription created: ${sub.id}`);
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        console.log(`Subscription updated: ${sub.id}`);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        // This is your real "expiration" signal.
        console.log(`Subscription expired/deleted: ${sub.id}`);
        break;
      }
      case "customer.subscription.trial_will_end": {
        const sub = event.data.object as Stripe.Subscription;
        console.log(`Trial ending soon for: ${sub.id}`);
        break;
      }
      case "customer.subscription.paused": {
        const sub = event.data.object as Stripe.Subscription;
        console.log(`Subscription paused: ${sub.id}`);
        break;
      }
      case "customer.subscription.resumed": {
        const sub = event.data.object as Stripe.Subscription;
        console.log(`Subscription resumed: ${sub.id}`);
        break;
      }
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        // This is your real "renewal" signal for recurring invoices.
        console.log(`Subscription invoice paid: ${invoice.id}`);
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        console.log(`Subscription invoice payment failed: ${invoice.id}`);
        break;
      }
      default:
        // Unhandled event types are ignored by design.
        break;
    }
  },
};
