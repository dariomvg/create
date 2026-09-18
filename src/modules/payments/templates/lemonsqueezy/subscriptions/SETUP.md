# Lemon Squeezy — Subscriptions module

A self-contained module for recurring payments via Lemon Squeezy in a
Next.js app. Separate from the [one-time payments module](./SETUP.md) —
share the same `LEMONSQUEEZY_API_KEY` / `LEMONSQUEEZY_STORE_ID`, but this
module has its own webhook and its own file tree.

## Dependency

Same SDK as the payments module — no extra install needed if you already
added it:

```
@lemonsqueezy/lemonsqueezy.js
```

## File map

```
lib/lemonsqueezy-subscriptions/
  service.ts   Internal logic (SDK calls, mapping, signature verification).
  actions.ts   Server-side functions, ready to import in Server Components
               or Server Actions. Every function returns
               { success: true, data } | { success: false, error }.
  types.ts     Shared types (Subscription, ChangePlanParams, Webhook payload).
  client.ts    Client-side helpers ("use client"): redirect/open checkout,
               redirect to the customer portal.

app/api/webhooks/lemonsqueezy-subscriptions/route.ts
               Dedicated webhook receiver for subscription lifecycle events.
```

## Environment variables

Reuses `LEMONSQUEEZY_API_KEY` and `LEMONSQUEEZY_STORE_ID` from the payments
module. Adds one of its own:

| Variable | Where to find it |
|---|---|
| `LEMONSQUEEZY_SUBSCRIPTIONS_WEBHOOK_SECRET` | Dashboard → Settings → Webhooks → create a **separate** webhook for this module → its signing secret |

Registering a separate webhook (rather than reusing the payments one) keeps
the two modules fully independent and lets you subscribe each one only to
the events it actually handles.

## Terminology notes (Lemon Squeezy vs. the feature list)

- **Upgrade / Downgrade / Change plan** are the *same* API call
  (`updateSubscription` with a new `variantId`). This module exposes a
  single `changeSubscriptionPlan()` — your UI decides what to call the
  action, the API doesn't distinguish them.
- **Resume** is two different things in Lemon Squeezy:
  - `resumeCancelledSubscription()` — reverts a cancellation while still
    inside the grace period (before `endsAt`).
  - `unpauseSubscription()` — resumes a subscription that was paused.
  Calling the wrong one will fail against a subscription that isn't in the
  matching state.
- **Renewal** and **Expiration** are not actions — there's no "renew"
  endpoint. `getRenewalInfo()` / `getExpirationInfo()` just read the
  `renewsAt` / `endsAt` fields Lemon Squeezy already maintains.
- **Trial** is a field (`trialEndsAt`), not a separate flow. Set it via
  `createSubscriptionCheckout({ skipTrial })` at signup, or extend an
  existing subscription's trial with `extendTrial()`.
- **Change quantity** operates on the subscription's line item
  (`firstSubscriptionItemId` from `getSubscription()`), not the
  subscription itself — that's why `changeSubscriptionQuantity()` takes a
  `subscriptionItemId`.
- This module assumes `variantId` (the plan) already exists in your Lemon
  Squeezy store — it does not manage products/variants.

## How the pieces fit together

### 1. Starting a subscription (checkout)

Same pattern as one-time payments: there's no "create subscription"
endpoint — a Subscription is created once the checkout is completed.

```ts
import { createSubscriptionCheckout } from "@/lib/lemonsqueezy-subscriptions/actions";

const result = await createSubscriptionCheckout({
  variantId: 123456,
  email: "customer@example.com",
  redirectUrl: "https://yourapp.com/subscription/result",
});

if (result.success) {
  // result.data.url
}
```

```ts
import { redirectToSubscriptionCheckout } from "@/lib/lemonsqueezy-subscriptions/client";
redirectToSubscriptionCheckout(checkoutUrl);
```

### 2. Reading a subscription

```ts
import {
  getSubscription,
  getSubscriptionStatus,
  getRenewalInfo,
  getExpirationInfo,
} from "@/lib/lemonsqueezy-subscriptions/actions";

const subscription = await getSubscription(subscriptionId);
const status = await getSubscriptionStatus(subscriptionId);
const renewal = await getRenewalInfo(subscriptionId);     // { renewsAt, status }
const expiration = await getExpirationInfo(subscriptionId); // { endsAt, status }
```

### 3. Cancel / resume

```ts
import {
  cancelSubscription,
  resumeCancelledSubscription,
} from "@/lib/lemonsqueezy-subscriptions/actions";

await cancelSubscription(subscriptionId);           // enters grace period until endsAt
await resumeCancelledSubscription(subscriptionId);  // only works during that grace period
```

### 4. Pause / unpause

```ts
import {
  pauseSubscription,
  unpauseSubscription,
} from "@/lib/lemonsqueezy-subscriptions/actions";

await pauseSubscription({ subscriptionId, mode: "void" }); // or mode: "free", resumesAt: isoDate
await unpauseSubscription(subscriptionId);
```

### 5. Change plan (upgrade / downgrade / change plan)

```ts
import { changeSubscriptionPlan } from "@/lib/lemonsqueezy-subscriptions/actions";

await changeSubscriptionPlan({
  subscriptionId,
  variantId: newVariantId,
  invoiceImmediately: true, // charge the difference now instead of at renewal
});
```

### 6. Change quantity

```ts
import { changeSubscriptionQuantity } from "@/lib/lemonsqueezy-subscriptions/actions";

await changeSubscriptionQuantity({ subscriptionItemId, quantity: 5 });
```

### 7. Trial

```ts
import { extendTrial } from "@/lib/lemonsqueezy-subscriptions/actions";

await extendTrial(subscriptionId, "2026-12-01T00:00:00Z");
```

### 8. Customer portal (payment method management)

Lemon Squeezy doesn't expose an API to update a subscription's payment
method directly — it's handled through their hosted customer portal, whose
URL comes back on the Subscription object itself:

```ts
import { redirectToCustomerPortal } from "@/lib/lemonsqueezy-subscriptions/client";

const subscription = await getSubscription(subscriptionId);
if (subscription.success && subscription.data.customerPortalUrl) {
  redirectToCustomerPortal(subscription.data.customerPortalUrl);
}
```

### 9. Webhooks

Register `https://yourapp.com/api/webhooks/lemonsqueezy-subscriptions` as
its **own** webhook in Dashboard → Settings → Webhooks, subscribed to:

- `subscription_created`
- `subscription_updated`
- `subscription_cancelled`
- `subscription_resumed`
- `subscription_paused`
- `subscription_unpaused`
- `subscription_expired`
- `subscription_plan_changed`

Payment/invoice events (`subscription_payment_success`,
`subscription_payment_failed`, `subscription_payment_recovered`) are
intentionally not subscribed to or handled here — they belong to a future
billing module, kept separate the same way the Stripe billing module is
separate from Stripe subscriptions.

## Error handling

Same convention as the payments module: `service.ts` throws, `actions.ts`
catches and returns `{ success: false, error }`, and the webhook route
returns `401` / `400` / `500` appropriately so Lemon Squeezy's retry logic
kicks in on real failures.
