# Lemon Squeezy — One-time Payments module

A self-contained module for one-time payments via Lemon Squeezy in a Next.js
app. No subscriptions, no billing — just: checkout → order → refund →
webhooks.

## Dependency

This module uses the official SDK:

```
@lemonsqueezy/lemonsqueezy.js
```

(It will resolve automatically once you install your project's
dependencies — nothing else to install manually.)

## File map

```
lib/lemonsqueezy/
  service.ts   Internal logic (SDK calls, mapping, signature verification).
               Not meant to be imported outside this folder.
  actions.ts   Server-side functions, ready to import in Server Components
               or Server Actions. Every function returns
               { success: true, data } | { success: false, error }.
  types.ts     Shared types (Order, Checkout, Refund, Webhook payload).
  client.ts    Client-side helpers ("use client"): redirect/open checkout,
               poll a status endpoint.

app/api/webhooks/lemonsqueezy/route.ts
               Webhook receiver. Verifies the signature and handles events.

.env.local     Environment variables (see below).
```

## Environment variables

| Variable | Where to find it |
|---|---|
| `LEMONSQUEEZY_API_KEY` | Dashboard → Settings → API → create an API key |
| `LEMONSQUEEZY_STORE_ID` | Dashboard → Settings → Stores |
| `LEMONSQUEEZY_WEBHOOK_SECRET` | Dashboard → Settings → Webhooks → your webhook's signing secret |

Use test-mode keys while developing; Lemon Squeezy test mode has its own
isolated store data.

## How the pieces fit together

### 1. Creating a payment (checkout)

Lemon Squeezy has no separate "create payment" endpoint. A payment (an
**Order**) is created automatically once the customer completes a
**Checkout**. So "create checkout" and "create payment" are the same call:

```ts
import { createCheckout } from "@/lib/lemonsqueezy/actions";

const result = await createCheckout({
  variantId: 123456,
  email: "customer@example.com",
  redirectUrl: "https://yourapp.com/payment/result",
  customData: { internal_reference: "abc-123" }, // optional, see note below
});

if (result.success) {
  // result.data.url -> send the customer here (or use client.ts helpers)
}
```

On the client:

```ts
import { redirectToCheckout } from "@/lib/lemonsqueezy/client";
redirectToCheckout(checkoutUrl);
```

### 2. Reading a payment

```ts
import { getPayment, getPaymentStatus } from "@/lib/lemonsqueezy/actions";

const order = await getPayment(orderId);
const status = await getPaymentStatus(orderId); // "pending" | "paid" | "refunded" | ...
```

### 3. Success / failure

These are **not pages** — they're functions that read the order id from
query params and check its status:

```ts
import { getPaymentSuccess, getPaymentFailure } from "@/lib/lemonsqueezy/actions";

const success = await getPaymentSuccess(searchParams); // succeeds only if status === "paid"
const failure = await getPaymentFailure(searchParams); // succeeds if status !== "paid"
```

**Important limitation to know before wiring this up:** Lemon Squeezy does
not append any id to your `redirectUrl` automatically, and there is no API
endpoint to look up an Order by the `customData` you attached to a
Checkout. The functions above expect a real Lemon Squeezy **`order_id`**
as the query param — that's the identifier Lemon Squeezy actually works
with (there is no "checkout_id" on the Order side). If you want to
correlate the redirect back to your own reference, generated before
creating the checkout, you need to:

1. Pass that reference as `customData` when creating the checkout.
2. Persist the mapping (`reference -> order id`) yourself when the
   `order_created` webhook fires — there's a marked spot for this in
   `app/api/webhooks/lemonsqueezy/route.ts`.
3. Look up the order id from your own storage before calling
   `getPaymentSuccess` / `getPaymentFailure`.

This module intentionally doesn't include a database, so that lookup step
is left for you to plug in wherever you persist data.

### 4. Refunds (full and partial)

Lemon Squeezy has a single refund endpoint. Passing `amount` (in cents)
issues a partial refund; omitting it refunds the full order:

```ts
import { refundPayment } from "@/lib/lemonsqueezy/actions";

await refundPayment({ orderId }); // full refund
await refundPayment({ orderId, amount: 500 }); // partial refund, $5.00
```

### 5. Payment method

Lemon Squeezy doesn't expose a payment-methods API for one-time orders.
`getPaymentMethod` just returns whatever card brand/last4 Lemon Squeezy
recorded on the Order itself (may be `null` depending on the payment
method used):

```ts
import { getPaymentMethod } from "@/lib/lemonsqueezy/actions";
const method = await getPaymentMethod(orderId);
```

### 6. Cancellation — not implemented, on purpose

There is no API to cancel a paid Order. An **unfinished** Checkout simply
expires on its own (`CheckoutResult.expiresAt`) — there's nothing to call
to cancel it manually. No function was added for this to avoid faking
behavior Lemon Squeezy doesn't support.

### 7. Webhooks

Register `https://yourapp.com/api/webhooks/lemonsqueezy` in
Dashboard → Settings → Webhooks, subscribed to:

- `order_created`
- `order_refunded`

The route handler verifies the `X-Signature` header against
`LEMONSQUEEZY_WEBHOOK_SECRET` using the raw request body, then dispatches
on `event_name`. Add your own persistence/side effects inside the
`switch` in `route.ts`.

## Error handling

- `service.ts` throws plain `Error`s with the Lemon Squeezy API's error
  message when available.
- `actions.ts` catches those and returns `{ success: false, error }` —
  callers never need try/catch, just check `result.success`.
- The webhook route returns `401` on bad signatures, `400` on malformed
  payloads, and `500` if a handler throws, so Lemon Squeezy's retry logic
  (exponential backoff, up to 3 retries) kicks in correctly.
