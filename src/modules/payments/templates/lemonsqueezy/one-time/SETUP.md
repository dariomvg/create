# Lemon Squeezy — One-time Payments

## Description

One-time payments with Lemon Squeezy for Next.js (App Router). Covers: create checkout, get payment (Order), payment status, payment success/failure, refund / partial refund, payment method data, and webhooks.

Architecture:

- `service.ts` — internal logic (SDK calls, mapping, webhook signature verification). Never import it from components or routes, except the webhook route handler.
- `actions.ts` — server-only functions. Import from Server Components / Server Actions / route handlers.
- `client.ts` — browser-only helpers (`"use client"`). They never use the API key.
- `types.ts` — shared types.

All `actions.ts` functions never throw: they return `PaymentResult<T>` = `{ success: true; data: T } | { success: false; error: string }`.

### Lemon Squeezy specifics and limitations

- **Order = payment.** Lemon Squeezy has no "create payment" endpoint and no Payment Intent. A payment is an **Order**, created automatically when the customer completes a **Checkout**. "Create checkout" is the only creation call. Use the Order id (`order_id`) as the payment identifier everywhere.
- **Cancellation is not implemented on purpose.** There is no API to cancel a paid Order. An unfinished Checkout expires on its own (see `expiresAt` in `CheckoutResult`). Do not add a cancel function.
- **Refund / partial refund use one endpoint.** `refundPayment` with `amount` (in cents) = partial refund; without `amount` = full refund.
- **Payment methods:** Lemon Squeezy has no payment-methods API for one-time orders. `getPaymentMethod` only returns the card brand / last4 stored on the Order (both may be `null`).
- **Success/failure are functions, not pages.** They read `order_id` from the query params and check the Order status. Lemon Squeezy does NOT append any id to `redirectUrl` automatically, and there is no endpoint to look up an Order by the `customData` attached to a Checkout. To get an `order_id` into the redirect, persist the mapping (your own reference → Order id) in the `order_created` webhook (marked spot in `route.ts`) and build the redirect from your own storage.
- **There is no `checkout_id` on the Order side.** Do not use it as a lookup key.
- The webhook handler only logs events. Persistence / side effects must be added inside its `switch`.
- The module assumes the `variantId` already exists in the Lemon Squeezy store (it does not manage products/variants).

## Dependencies

- `@lemonsqueezy/lemonsqueezy.js` (official SDK)
- `server-only`
- `next` (App Router)

## Environment variables

| Variable | Required | Where to get it |
|---|---|---|
| `LEMONSQUEEZY_API_KEY` | yes | Dashboard → Settings → API |
| `LEMONSQUEEZY_STORE_ID` | yes | Dashboard → Settings → Stores (numeric id) |
| `LEMONSQUEEZY_WEBHOOK_SECRET` | yes | Dashboard → Settings → Webhooks → signing secret of the webhook pointing to `/api/webhooks/lemonsqueezy` |

## File structure

```
lib/payments/lemon-squeezy/one-time/
  service.ts   Internal. SDK calls, Order/Checkout mapping, verifyWebhookSignature, parseWebhookPayload.
  actions.ts   Server-only public functions (see Public API).
  client.ts    Client-only public functions (see Public API).
  types.ts     CreateCheckoutParams, CheckoutResult, LemonSqueezyOrder, OrderStatus,
               RefundOrderParams, RefundResult, PaymentResult, LemonSqueezyWebhookPayload.

app/api/webhooks/lemonsqueezy/route.ts
               POST handler. Verifies the X-Signature header against the raw body, then handles
               `order_created` and `order_refunded` (log only; add persistence here).
               Register `https://<your-domain>/api/webhooks/lemonsqueezy` in the Lemon Squeezy
               dashboard subscribed to those two events.
```

Imports use the `@/` alias, e.g. `@/lib/payments/lemon-squeezy/one-time/actions`.

## Public API

Shared shapes:

- `OrderStatus` = `"pending" | "failed" | "paid" | "refunded" | "partial_refund" | "fraudulent"`
- `LemonSqueezyOrder` = `{ id, identifier, storeId, customerId, status: OrderStatus, statusFormatted, currency, subtotal, tax, total, refundedAmount, refunded, refundedAt, userEmail, userName, createdAt, cardBrand, cardLastFour, receiptUrl }` (amounts in cents)

### `lib/payments/lemon-squeezy/one-time/actions.ts` (server only)

| Export | Arguments | Returns |
|---|---|---|
| `createCheckout` | `params: { variantId: number; email?: string; customData?: Record<string, string \| number \| boolean>; redirectUrl?: string; embed?: boolean }` | `Promise<PaymentResult<{ id: string; url: string; expiresAt: string \| null }>>` |
| `getPayment` | `orderId: string` | `Promise<PaymentResult<LemonSqueezyOrder>>` |
| `getPaymentStatus` | `orderId: string` | `Promise<PaymentResult<OrderStatus>>` |
| `getPaymentSuccess` | `searchParams: URLSearchParams \| Record<string, string \| string[] \| undefined>` (reads `order_id`) | `Promise<PaymentResult<LemonSqueezyOrder>>` — error if `order_id` is missing or status is not `"paid"` |
| `getPaymentFailure` | `searchParams` (same as above, reads `order_id`) | `Promise<PaymentResult<{ orderId: string; status: OrderStatus }>>` — error if `order_id` is missing or the order is `"paid"` |
| `refundPayment` | `params: { orderId: string; amount?: number }` (`amount` in cents; omit = full refund) | `Promise<PaymentResult<{ orderId: string; refunded: boolean; refundedAmount: number; status: OrderStatus }>>` |
| `getPaymentMethod` | `orderId: string` | `Promise<PaymentResult<{ cardBrand: string \| null; cardLastFour: string \| null }>>` |

### `lib/payments/lemon-squeezy/one-time/client.ts` (client only)

| Export | Arguments | Returns |
|---|---|---|
| `redirectToCheckout` | `checkoutUrl: string` | `void` — full-page redirect; throws if `checkoutUrl` is empty |
| `openCheckoutOverlay` | `checkoutUrl: string` (checkout created with `embed: true`; needs Lemon.js loaded) | `void` — falls back to `redirectToCheckout` if Lemon.js is not loaded; throws if empty |
| `pollPaymentStatus` | `statusEndpoint: string` (a route of yours that calls `getPaymentStatus`, responding `{ status }`), `options?: { intervalMs?: number; timeoutMs?: number }` (defaults 2000 / 60000) | `Promise<"paid" \| "failed" \| "refunded" \| "partial_refund" \| "fraudulent" \| "timeout">` |

### `app/api/webhooks/lemonsqueezy/route.ts`

| Export | Arguments | Returns |
|---|---|---|
| `POST` | `request: NextRequest` (raw body + `x-signature` header) | `NextResponse`: `200 { received: true }`, `400` unreadable body / invalid JSON, `401` invalid signature, `500` misconfigured secret or handler error |

## Examples

Create a checkout (Server Action) and redirect (Client Component):

```ts
// app/actions/buy.ts
"use server";
import { createCheckout } from "@/lib/payments/lemon-squeezy/one-time/actions";

export async function buy(variantId: number, email: string) {
  return createCheckout({
    variantId,
    email,
    redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL}/payment/result`,
  });
}
```

```tsx
// components/BuyButton.tsx
"use client";
import { redirectToCheckout } from "@/lib/payments/lemon-squeezy/one-time/client";
import { buy } from "@/app/actions/buy";

export function BuyButton({ variantId, email }: { variantId: number; email: string }) {
  return (
    <button
      onClick={async () => {
        const result = await buy(variantId, email);
        if (result.success) redirectToCheckout(result.data.url);
        else console.error(result.error);
      }}
    >
      Buy
    </button>
  );
}
```

Success / failure state in a Server Component (`order_id` must be present in the query params):

```tsx
// app/payment/result/page.tsx
import { getPaymentSuccess, getPaymentFailure } from "@/lib/payments/lemon-squeezy/one-time/actions";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const success = await getPaymentSuccess(params);
  if (success.success) return <p>Paid: {success.data.total / 100} {success.data.currency}</p>;

  const failure = await getPaymentFailure(params);
  if (failure.success) return <p>Not paid. Status: {failure.data.status}</p>;

  return <p>{failure.error}</p>;
}
```

Full and partial refund:

```ts
import { refundPayment } from "@/lib/payments/lemon-squeezy/one-time/actions";

await refundPayment({ orderId });               // full refund
await refundPayment({ orderId, amount: 500 });  // partial refund of 5.00
```

Handling the result of any action:

```ts
const result = await getPayment(orderId);
if (!result.success) {
  // result.error is a safe string message
  return;
}
// result.data is LemonSqueezyOrder
```