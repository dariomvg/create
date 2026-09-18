# Stripe Subscriptions — Setup

Self-contained module for recurring payments: create, read, cancel, pause,
resume, change plan, change quantity, trials, status, renewal, and
expiration.

Separate from `lib/stripe/` (one-time payments) and `lib/stripe-billing/`
(customer portal, invoices, payment methods) — no shared code, no shared
webhook endpoint. All three wrap the same Stripe account but keep their
concerns independent.

**Assumption:** this module operates on an existing `priceId` (created in
the Stripe Dashboard, or by whatever else manages your product catalog).
It does not create Products or Prices.

## Dependencies

- [`stripe`](https://www.npmjs.com/package/stripe) — server-side SDK, used in `lib/stripe-subscriptions/service.ts`
- [`@stripe/stripe-js`](https://www.npmjs.com/package/@stripe/stripe-js) — client-side SDK, used in `lib/stripe-subscriptions/client.ts`

Not installed automatically. If you already installed them for the other
modules, you're covered — same packages.

## File map

```
lib/stripe-subscriptions/
├── service.ts   # Internal logic + Stripe SDK instance. Don't touch/import directly elsewhere.
├── actions.ts   # Server Actions — import into Server Components.
├── types.ts     # Shared types — safe to import anywhere.
└── client.ts    # Client-side helpers — import into Client Components.

app/api/webhooks/stripe-subscriptions/
└── route.ts     # Subscriptions webhook endpoint. Register this URL in your Stripe Dashboard.

.env.local       # Adds STRIPE_SUBSCRIPTIONS_WEBHOOK_SECRET (reuses
                 # STRIPE_SECRET_KEY and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
                 # if already set up for the other modules).
```

## 1. Environment variables

`STRIPE_SECRET_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` are shared
across all three Stripe modules — set them once. Add on top:

| Variable | Where to get it |
|---|---|
| `STRIPE_SUBSCRIPTIONS_WEBHOOK_SECRET` | Dashboard → Developers → Webhooks (create a **third**, separate endpoint) |

## 2. Webhooks

Add a **separate** endpoint in the Stripe Dashboard pointing to:

```
https://yourdomain.com/api/webhooks/stripe-subscriptions
```

Subscribe it to at least:

- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted` — your real "expiration" signal
- `customer.subscription.trial_will_end`
- `customer.subscription.paused`
- `customer.subscription.resumed`
- `invoice.paid` — your real "renewal" signal for recurring charges
- `invoice.payment_failed`

For local testing:

```
stripe listen --forward-to localhost:3000/api/webhooks/stripe-subscriptions
```

Business logic for what happens on each event goes inside
`stripeSubscriptionsService.handleWebhookEvent` in `service.ts` — the one
part of that file meant to be extended as your app grows.

## 3. Usage

### Create a subscription (with or without a trial)

```ts
import { createSubscription } from "@/lib/stripe-subscriptions/actions";

const result = await createSubscription({
  customerId,
  priceId,
  trialPeriodDays: 14, // omit for no trial
});

if (result.success && result.data.clientSecret) {
  // No trial (or a card needing 3D Secure): confirm the first charge client-side.
}
```

Client side, only when `clientSecret` is non-null:

```ts
"use client";
import { confirmSubscriptionPayment } from "@/lib/stripe-subscriptions/client";

await confirmSubscriptionPayment(clientSecret, paymentMethodId);
```

A subscription created with a trial and no `clientSecret` is already
`trialing` — nothing to confirm until the trial ends and Stripe bills it
automatically (handled via the `invoice.paid` / `invoice.payment_failed`
webhook events).

### Read subscription / status

```ts
import { getSubscription, getSubscriptionStatus } from "@/lib/stripe-subscriptions/actions";

const sub = await getSubscription(subscriptionId);
const status = await getSubscriptionStatus(subscriptionId);
```

### Cancel

```ts
import { cancelSubscription } from "@/lib/stripe-subscriptions/actions";

await cancelSubscription({ subscriptionId }); // immediate
await cancelSubscription({ subscriptionId, atPeriodEnd: true }); // at period end
```

### Pause / resume

```ts
import { pauseSubscription, resumeSubscription } from "@/lib/stripe-subscriptions/actions";

await pauseSubscription(subscriptionId);
await resumeSubscription(subscriptionId);
```

### Upgrade / downgrade / change plan

All three are the same operation — swapping the subscription item's price.
Decide the label ("upgrade" vs "downgrade") in your UI based on the price
difference; the function itself doesn't care:

```ts
import { changeSubscriptionPlan } from "@/lib/stripe-subscriptions/actions";

await changeSubscriptionPlan({
  subscriptionId,
  newPriceId,
  prorationBehavior: "create_prorations", // default; see Stripe docs for alternatives
});
```

### Change quantity (e.g. seats)

```ts
import { changeSubscriptionQuantity } from "@/lib/stripe-subscriptions/actions";

await changeSubscriptionQuantity({ subscriptionId, quantity: 5 });
```

### Renewal / expiration info

There's no "renew" action in Stripe's API — renewal happens automatically
via the billing cycle. These two read the current state instead:

```ts
import { getRenewalInfo, getExpirationInfo } from "@/lib/stripe-subscriptions/actions";

const renewal = await getRenewalInfo(subscriptionId);
// { willRenew, currentPeriodEnd, nextPaymentAttempt }

const expiration = await getExpirationInfo(subscriptionId);
// { cancelAtPeriodEnd, expiresAt, status }
```

For the actual renewal/expiration *events* as they happen, listen to
`invoice.paid` (renewed) and `customer.subscription.deleted` (expired) in
the webhook handler.

## Error handling

Every `actions.ts` and `client.ts` function returns:

```ts
{ success: true, data: T } | { success: false, error: string }
```

Always check `result.success` before reading `result.data` — nothing
throws across the module boundary.

## Notes

- `service.ts` is the only file that imports the `stripe` package or reads
  `STRIPE_SECRET_KEY` / `STRIPE_SUBSCRIPTIONS_WEBHOOK_SECRET`.
- This module doesn't create Products/Prices or Customers — both are
  assumed to already exist.
- Pausing uses `pause_collection: { behavior: "void" }` (no invoices are
  generated while paused, nothing is owed for that time). Check Stripe's
  docs if you want `mark_uncollectible` or `keep_as_draft` behavior instead.
