# Stripe — Subscriptions

## Description

Recurring payments with Stripe for a Next.js App Router project: create subscriptions (with optional trial), read them and their status, cancel, pause, resume, change plan (upgrade/downgrade), change quantity, read renewal and expiration info, and a webhook endpoint for subscription lifecycle events.

It operates on existing Stripe objects: a `customerId` and a recurring `priceId` that you already have.

Every function returns a serializable `ActionResult<T>` and never throws across the module boundary. Timestamps are Unix seconds.

```ts
type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };
```

## Dependencies

| Package | Used by |
|---|---|
| `stripe` | `service.ts` (server SDK) |
| `@stripe/stripe-js` | `client.ts` (browser SDK) |

## Environment variables

| Variable | Scope | Purpose |
|---|---|---|
| `STRIPE_SECRET_KEY` | Server | Stripe API secret key. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Client | Stripe publishable key, used by `client.ts`. |
| `STRIPE_SUBSCRIPTIONS_WEBHOOK_SECRET` | Server | Signing secret of the Stripe webhook endpoint pointing to `/api/webhooks/stripe-subscriptions`. |

## File structure

```
lib/payments/stripe/subscriptions/
├── actions.ts   # Server Actions — import from Server Components / server code
├── client.ts    # Browser helpers — import from Client Components
├── types.ts     # Shared types — safe to import anywhere
└── service.ts   # Internal Stripe logic — never import it from outside this folder

app/api/webhooks/stripe-subscriptions/
└── route.ts     # Webhook endpoint (POST)
```

Import alias: `@/lib/payments/stripe/subscriptions/<file>`.

Webhook event handling lives in `service.ts` → `stripeSubscriptionsService.handleWebhookEvent` (logs only by default). Your app's sync logic for each event goes there.

## Public API

### `actions.ts` (server)

| Export | Arguments | Returns |
|---|---|---|
| `createSubscription` | `params: CreateSubscriptionParams` (`trialPeriodDays` starts a trial) | `ActionResult<SubscriptionSummary>` — if `clientSecret` is non-null, confirm it client-side |
| `getSubscription` | `subscriptionId: string` | `ActionResult<SubscriptionSummary>` |
| `getSubscriptionStatus` | `subscriptionId: string` | `ActionResult<SubscriptionStatus>` |
| `cancelSubscription` | `params: CancelSubscriptionParams` (`atPeriodEnd: true` cancels at period end, otherwise immediately) | `ActionResult<SubscriptionSummary>` |
| `pauseSubscription` | `subscriptionId: string` (stops invoicing, voids what would be billed) | `ActionResult<SubscriptionSummary>` |
| `resumeSubscription` | `subscriptionId: string` | `ActionResult<SubscriptionSummary>` |
| `changeSubscriptionPlan` | `params: ChangePlanParams` (same call for upgrade, downgrade and plan change) | `ActionResult<SubscriptionSummary>` |
| `changeSubscriptionQuantity` | `params: ChangeQuantityParams` (`quantity >= 1`) | `ActionResult<SubscriptionSummary>` |
| `getRenewalInfo` | `subscriptionId: string` | `ActionResult<RenewalInfo>` |
| `getExpirationInfo` | `subscriptionId: string` | `ActionResult<ExpirationInfo>` |
| `handleStripeSubscriptionsWebhook` | `rawBody: string, signature: string` | `ActionResult<{ received: true }>` |

Validation: id arguments must be non-empty; `createSubscription` requires `customerId` and `priceId`; `changeSubscriptionPlan` requires `subscriptionId` and `newPriceId`.

### `client.ts` (browser)

| Export | Arguments | Returns |
|---|---|---|
| `confirmSubscriptionPayment` | `clientSecret: string, paymentMethodId: string` | `Promise<ActionResult<{ status: string }>>` |
| `getStripe` | none | `Promise<Stripe \| null>` — shared Stripe.js instance, for Elements |

### `app/api/webhooks/stripe-subscriptions/route.ts`

| Export | Arguments | Returns |
|---|---|---|
| `POST` | `request: Request` (needs the `stripe-signature` header; reads the raw body) | `200 { received: true }` · `400 { error: string }` |

Events handled: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted` (expiration), `customer.subscription.trial_will_end`, `customer.subscription.paused`, `customer.subscription.resumed`, `invoice.paid` (renewal), `invoice.payment_failed`.

### Key types (`types.ts`)

```ts
type SubscriptionStatus = Stripe.Subscription.Status;
// "incomplete" | "incomplete_expired" | "trialing" | "active"
// | "past_due" | "canceled" | "unpaid" | "paused"

type ProrationBehavior = "create_prorations" | "none" | "always_invoice";

interface CreateSubscriptionParams {
  customerId: string; priceId: string;
  quantity?: number;          // default 1
  trialPeriodDays?: number;   // omit = no trial
  metadata?: Record<string, string>;
}

interface CancelSubscriptionParams { subscriptionId: string; atPeriodEnd?: boolean }

interface ChangePlanParams {
  subscriptionId: string; newPriceId: string;
  prorationBehavior?: ProrationBehavior; // default "create_prorations"
}

interface ChangeQuantityParams {
  subscriptionId: string; quantity: number;
  prorationBehavior?: ProrationBehavior; // default "create_prorations"
}

interface SubscriptionSummary {
  id: string; status: SubscriptionStatus; customerId: string;
  priceId: string; quantity: number;
  currentPeriodStart: number; currentPeriodEnd: number;
  cancelAtPeriodEnd: boolean; trialEnd: number | null;
  clientSecret: string | null; // first-invoice PaymentIntent secret, when confirmation is needed
}

interface RenewalInfo {
  willRenew: boolean; currentPeriodEnd: number; nextPaymentAttempt: number | null;
}

interface ExpirationInfo {
  cancelAtPeriodEnd: boolean; expiresAt: number | null; status: SubscriptionStatus;
}
```

## Examples

### Create a subscription

```ts
// Server
import { createSubscription } from "@/lib/payments/stripe/subscriptions/actions";

const result = await createSubscription({
  customerId: "cus_123",
  priceId: "price_123",
  trialPeriodDays: 14, // optional
});

if (result.success) {
  const { id, status, clientSecret } = result.data;
  // clientSecret !== null → confirm the first payment in the browser
  // clientSecret === null and status === "trialing" → nothing to confirm yet
}
```

```ts
// Client, after Elements produced a paymentMethodId
"use client";
import { confirmSubscriptionPayment } from "@/lib/payments/stripe/subscriptions/client";

const result = await confirmSubscriptionPayment(clientSecret, paymentMethodId);
if (!result.success) showError(result.error);
```

### Read status

```ts
import { getSubscription, getSubscriptionStatus } from "@/lib/payments/stripe/subscriptions/actions";

const sub = await getSubscription(subscriptionId);
const status = await getSubscriptionStatus(subscriptionId);
```

### Cancel, pause, resume

```ts
import {
  cancelSubscription, pauseSubscription, resumeSubscription,
} from "@/lib/payments/stripe/subscriptions/actions";

await cancelSubscription({ subscriptionId });                       // immediately
await cancelSubscription({ subscriptionId, atPeriodEnd: true });    // at period end
await pauseSubscription(subscriptionId);
await resumeSubscription(subscriptionId);
```

### Change plan and quantity

```ts
import {
  changeSubscriptionPlan, changeSubscriptionQuantity,
} from "@/lib/payments/stripe/subscriptions/actions";

// Upgrade, downgrade and plan change are the same call; label it in your UI.
await changeSubscriptionPlan({ subscriptionId, newPriceId: "price_pro" });
await changeSubscriptionPlan({
  subscriptionId, newPriceId: "price_basic", prorationBehavior: "none",
});

await changeSubscriptionQuantity({ subscriptionId, quantity: 5 });
```

### Renewal and expiration

```ts
import { getRenewalInfo, getExpirationInfo } from "@/lib/payments/stripe/subscriptions/actions";

const renewal = await getRenewalInfo(subscriptionId);
// { willRenew, currentPeriodEnd, nextPaymentAttempt }

const expiration = await getExpirationInfo(subscriptionId);
// { cancelAtPeriodEnd, expiresAt, status }
```