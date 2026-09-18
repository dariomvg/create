# Stripe One-time Payments — Setup

Self-contained module for one-time payments with Stripe in a Next.js App
Router project. No subscriptions, no billing — just: create a payment,
track its status, refund it if needed.

## Dependencies

This module uses:

- [`stripe`](https://www.npmjs.com/package/stripe) — server-side SDK, used in `lib/stripe/service.ts`
- [`@stripe/stripe-js`](https://www.npmjs.com/package/@stripe/stripe-js) — client-side SDK, used in `lib/stripe/client.ts`

Not installed automatically — add them with your package manager of choice
before using the module.

## File map

```
lib/stripe/
├── service.ts   # Internal logic + Stripe SDK instance. Don't touch/import directly elsewhere.
├── actions.ts   # Server Actions — import into Server Components.
├── types.ts     # Shared types — safe to import anywhere.
└── client.ts    # Client-side helpers — import into Client Components.

app/api/webhooks/stripe/
└── route.ts     # Webhook endpoint. Register this URL in your Stripe Dashboard.

.env.local       # Stripe keys (see below).
```

## 1. Environment variables

Fill in `.env.local`:

| Variable | Where to get it |
|---|---|
| `STRIPE_SECRET_KEY` | Dashboard → Developers → API keys |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Dashboard → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | Dashboard → Developers → Webhooks (or `stripe listen` output locally) |

## 2. Webhooks

In the Stripe Dashboard, add an endpoint pointing to:

```
https://yourdomain.com/api/webhooks/stripe
```

Subscribe it to at least:

- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `payment_intent.canceled`
- `charge.refunded`
- `checkout.session.completed`

For local testing, use the Stripe CLI:

```
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Business logic for what happens on each event (fulfill an order, send an
email, etc.) goes inside `stripeService.handleWebhookEvent` in `service.ts`
— that's the one part of `service.ts` meant to be extended as your app grows.

## 3. Usage

### Hosted Checkout (simplest — redirect to a Stripe-hosted page)

Server side, in a Server Component or a form action:

```ts
import { createCheckoutSession } from "@/lib/stripe/actions";

const result = await createCheckoutSession({
  amount: 2000, // $20.00, in cents
  currency: "usd",
  productName: "Pro plan — one time",
  successUrl: "https://yourdomain.com/success",
  cancelUrl: "https://yourdomain.com/cancel",
});

if (result.success) {
  // result.data.url — redirect the user here, or:
  // result.data.sessionId — pass to redirectToCheckout() client-side
}
```

Client side, if you'd rather redirect from the browser with the session id:

```ts
"use client";
import { redirectToCheckout } from "@/lib/stripe/client";

await redirectToCheckout(sessionId);
```

### Custom payment form (embedded, using Stripe Elements)

Server side:

```ts
import { createPaymentIntent } from "@/lib/stripe/actions";

const result = await createPaymentIntent({ amount: 2000, currency: "usd" });
// result.data.clientSecret — pass to your Elements form
```

Client side, after collecting card details with Stripe Elements:

```ts
"use client";
import { confirmCardPayment } from "@/lib/stripe/client";

await confirmCardPayment(clientSecret, paymentMethodId);
```

### Checking status

```ts
import { getPayment, getPaymentStatus } from "@/lib/stripe/actions";

const status = await getPaymentStatus(paymentIntentId);
const full = await getPayment(paymentIntentId);
```

### Cancel / refund

```ts
import { cancelPayment, refundPayment } from "@/lib/stripe/actions";

await cancelPayment(paymentIntentId);

await refundPayment({ paymentIntentId }); // full refund
await refundPayment({ paymentIntentId, amount: 500 }); // partial, $5.00
```

### Payment methods

```ts
import { listPaymentMethods } from "@/lib/stripe/actions";

const methods = await listPaymentMethods(stripeCustomerId);
```

## Error handling

Every `actions.ts` and `client.ts` function returns:

```ts
{ success: true, data: T } | { success: false, error: string }
```

Always check `result.success` before reading `result.data` — nothing throws
across the module boundary, so you never need a try/catch around these calls.

## Notes

- `service.ts` is the only file that imports the `stripe` package or reads
  `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`. Keep it that way — it's what
  makes the secret key impossible to leak into a Client Component by accident.
- Success/cancel pages (`successUrl`/`cancelUrl`) aren't included here — this
  module only produces the data and URLs; point them at your existing
  checkout success/cancel pages.
