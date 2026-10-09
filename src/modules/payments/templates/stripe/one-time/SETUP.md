# Stripe — One-time Payments

## Description

One-time payments with Stripe for a Next.js App Router project: hosted Checkout sessions, custom PaymentIntents (embedded card form), payment lookup and status, cancellation, full and partial refunds, saved card listing, and a webhook endpoint.

Every function returns a serializable `ActionResult<T>` and never throws across the module boundary. Amounts are integers in the smallest currency unit (e.g. cents). Timestamps are Unix seconds.

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
| `STRIPE_WEBHOOK_SECRET` | Server | Signing secret of the Stripe webhook endpoint pointing to `/api/webhooks/stripe`. |

## File structure

```
lib/payments/stripe/one-time/
├── actions.ts   # Server Actions — import from Server Components / server code
├── client.ts    # Browser helpers — import from Client Components
├── types.ts     # Shared types — safe to import anywhere
└── service.ts   # Internal Stripe logic — never import it from outside this folder

app/api/webhooks/stripe/
└── route.ts     # Webhook endpoint (POST)
```

Import alias: `@/lib/payments/stripe/one-time/<file>`.

Webhook event handling lives in `service.ts` → `stripeService.handleWebhookEvent` (logs only by default). Order fulfillment logic for each event goes there.

## Public API

### `actions.ts` (server)

| Export | Arguments | Returns |
|---|---|---|
| `createCheckoutSession` | `params: CreateCheckoutSessionParams` | `ActionResult<{ url: string \| null; sessionId: string }>` |
| `createPaymentIntent` | `params: CreatePaymentIntentParams` | `ActionResult<{ clientSecret: string \| null; id: string }>` |
| `getPayment` | `paymentIntentId: string` | `ActionResult<PaymentSummary>` |
| `getPaymentStatus` | `paymentIntentId: string` | `ActionResult<PaymentStatus>` |
| `cancelPayment` | `paymentIntentId: string` | `ActionResult<{ id: string; status: string }>` |
| `refundPayment` | `params: RefundParams` (omit `amount` for a full refund) | `ActionResult<RefundSummary>` |
| `listPaymentMethods` | `customerId: string` | `ActionResult<PaymentMethodSummary[]>` (cards only) |
| `handleStripeWebhook` | `rawBody: string, signature: string` | `ActionResult<{ received: true }>` |

Validation: `amount` must be `> 0` on create functions and on partial refunds; id arguments must be non-empty.

### `client.ts` (browser)

| Export | Arguments | Returns |
|---|---|---|
| `redirectToCheckout` | `sessionId: string` | `Promise<ActionResult<{ redirected: true }>>` |
| `confirmCardPayment` | `clientSecret: string, paymentMethodId: string` | `Promise<ActionResult<{ status: string }>>` |
| `getStripe` | none | `Promise<Stripe \| null>` — shared Stripe.js instance, for Elements |

### `app/api/webhooks/stripe/route.ts`

| Export | Arguments | Returns |
|---|---|---|
| `POST` | `request: Request` (needs the `stripe-signature` header; reads the raw body) | `200 { received: true }` · `400 { error: string }` |

Events handled: `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`, `charge.refunded`, `checkout.session.completed`.

### Key types (`types.ts`)

```ts
type PaymentStatus =
  | "requires_payment_method" | "requires_confirmation" | "requires_action"
  | "processing" | "succeeded" | "canceled"
  | "failed"; // requires_payment_method after a failed attempt

interface CreateCheckoutSessionParams {
  amount: number; currency: string;
  productName: string; productDescription?: string;
  successUrl: string; cancelUrl: string;
  metadata?: Record<string, string>; customerEmail?: string;
}

interface CreatePaymentIntentParams {
  amount: number; currency: string;
  metadata?: Record<string, string>; customerEmail?: string;
  automaticPaymentMethods?: boolean; // default true
}

interface RefundParams {
  paymentIntentId: string;
  amount?: number; // omit = full refund
  reason?: "duplicate" | "fraudulent" | "requested_by_customer";
}

interface PaymentSummary {
  id: string; status: PaymentStatus; amount: number; currency: string;
  created: number; customerEmail?: string | null; metadata: Record<string, string>;
}

interface RefundSummary {
  id: string; amount: number; status: string | null;
  reason: string | null; paymentIntentId: string;
}

interface PaymentMethodSummary {
  id: string; type: string;
  card?: { brand: string; last4: string; expMonth: number; expYear: number };
}
```

## Examples

### Hosted Checkout

```ts
"use server";
import { redirect } from "next/navigation";
import { createCheckoutSession } from "@/lib/payments/stripe/one-time/actions";

export async function buy() {
  const result = await createCheckoutSession({
    amount: 2000, // $20.00
    currency: "usd",
    productName: "Lifetime license",
    successUrl: "https://example.com/success",
    cancelUrl: "https://example.com/cancel",
    metadata: { orderId: "ord_123" },
  });

  if (!result.success || !result.data.url) {
    return { error: result.success ? "No checkout URL." : result.error };
  }
  redirect(result.data.url);
}
```

### Custom payment form (PaymentIntent + Stripe Elements)

```ts
// Server
import { createPaymentIntent } from "@/lib/payments/stripe/one-time/actions";

const result = await createPaymentIntent({ amount: 2000, currency: "usd" });
// result.data.clientSecret → pass it to your Elements form
```

```ts
// Client, after Elements produced a paymentMethodId
"use client";
import { confirmCardPayment } from "@/lib/payments/stripe/one-time/client";

const result = await confirmCardPayment(clientSecret, paymentMethodId);
if (!result.success) showError(result.error);
else if (result.data.status === "succeeded") showSuccess();
```

### Payment status

```ts
import { getPayment, getPaymentStatus } from "@/lib/payments/stripe/one-time/actions";

const status = await getPaymentStatus(paymentIntentId);
if (status.success && status.data === "failed") { /* show failure UI */ }

const payment = await getPayment(paymentIntentId);
```

### Cancel and refund

```ts
import { cancelPayment, refundPayment } from "@/lib/payments/stripe/one-time/actions";

await cancelPayment(paymentIntentId);                         // not yet completed
await refundPayment({ paymentIntentId });                     // full refund
await refundPayment({ paymentIntentId, amount: 500 });        // partial refund, $5.00
```

### Saved cards

```ts
import { listPaymentMethods } from "@/lib/payments/stripe/one-time/actions";

const methods = await listPaymentMethods(stripeCustomerId);
```