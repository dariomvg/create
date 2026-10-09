# Mercado Pago — One-time Payments

## Description

One-time payments with Mercado Pago (Checkout Pro) for Next.js (App Router). Covers: create checkout, get payment, payment status, payment success/failure, cancellation, refund / partial refund, payment methods, and webhooks.

Architecture:

- `service.ts` — internal logic (SDK calls, mapping, webhook signature verification). Never import it from components or routes, except the webhook route handler.
- `actions.ts` — server functions (`"use server"`). Import from Server Components, or call as Server Actions from Client Components.
- `client.ts` — browser-only helpers. They never use the access token.
- `types.ts` — shared types.

All `actions.ts` functions never throw: they return `MPResult<T>` = `{ success: true; data: T } | { success: false; error: string; code?: string }`. Always check `result.success` before reading `result.data`.

### Mercado Pago specifics and limitations

- **Checkout = Preference.** "Create checkout" creates a Checkout Pro **Preference** and returns a redirect URL. There is no "create payment" call: Mercado Pago creates the **Payment** on its side once the user pays. Use the Payment id (`payment_id`) as the payment identifier everywhere.
- **Redirect URLs.** Use `initPoint` with production credentials and `sandboxInitPoint` with test credentials. After checkout, Mercado Pago redirects to the matching `backUrls` entry (`success` / `failure` / `pending`) and appends `payment_id` (plus `status`, `external_reference`, `preference_id`, among others) to the query string.
- **Success/failure are functions, not pages.** `checkPaymentSuccess` / `checkPaymentFailure` take the `payment_id` read from the query params and check the Payment status. A `pending` or `in_process` payment is neither success nor failure (both functions report `false`).
- **Status values** (`PaymentStatus`): `pending`, `approved`, `authorized`, `in_process`, `in_mediation`, `rejected`, `cancelled`, `refunded`, `charged_back`. The field is called `status` (with `statusDetail` for the reason).
- **Cancellation is implemented, with a constraint.** `cancelPayment` only works while the payment is `pending` or `in_process`. An `approved` payment cannot be cancelled: refund it instead. The module does not pre-check; Mercado Pago's error comes back as `{ success: false, error }`.
- **Refund / partial refund use one endpoint.** `refundPayment` = full refund; `partialRefundPayment` with `amount` = partial refund. Amounts are in currency units (decimal, e.g. `500.5`), NOT cents.
- **Payment methods are account-level.** `getPaymentMethods` lists the methods enabled for the account/country. It is not tied to a specific payment.
- The webhook handler only logs events. Persistence / side effects must be added inside the marked block in `route.ts`.
- Webhook processing returns `200` even if fetching the payment fails (logged), to avoid endless retries from Mercado Pago.
- `service.ts` throws at import time if `MERCADOPAGO_ACCESS_TOKEN` is missing.

## Dependencies

- `mercadopago` (official SDK, v2)
- `next` (App Router)

## Environment variables

| Variable | Required | Where to get it |
|---|---|---|
| `MERCADOPAGO_ACCESS_TOKEN` | yes | Developer Dashboard → your application → Credentials (test or production access token) |
| `MERCADOPAGO_WEBHOOK_SECRET` | yes | Developer Dashboard → your application → Webhooks → signature secret of the webhook pointing to `/api/webhooks/mercadopago` |
| `NEXT_PUBLIC_APP_URL` | no | Your app's public base URL. Not read by the module; use it to build the `backUrls` you pass to `createCheckout` |

## File structure

```
lib/payments/mercadopago/one-time/
  service.ts   Internal. SDK calls, Payment/Preference mapping, verifyWebhookSignature.
  actions.ts   Server public functions (see Public API).
  client.ts    Client public function (see Public API).
  types.ts     CreatePreferenceInput, MPPreferenceItem, MPBackUrls, MPPreferenceResult, MPPayment,
               PaymentStatus, PaymentStatusResult, RefundResult, PaymentMethodInfo,
               WebhookNotification, MPResult, MPErrorResult.

app/api/webhooks/mercadopago/route.ts
               POST handler. Verifies x-signature / x-request-id against data.id, then handles
               `payment` notifications (fetches the Payment and logs; add persistence here).
               Register `https://<your-domain>/api/webhooks/mercadopago` in the Mercado Pago
               dashboard subscribed to payment events.
```

Imports use the `@/` alias, e.g. `@/lib/payments/mercadopago/one-time/actions`.

## Public API

Shared shapes:

- `PaymentStatus` = `"pending" | "approved" | "authorized" | "in_process" | "in_mediation" | "rejected" | "cancelled" | "refunded" | "charged_back"`
- `PaymentStatusResult` = `{ id: number; status: PaymentStatus; statusDetail: string }`
- `MPPayment` = `{ id: number; status: PaymentStatus; statusDetail: string; transactionAmount: number; currencyId: string; dateCreated: string; dateApproved: string | null; externalReference: string | null; metadata: Record<string, unknown>; payerEmail: string | null }`
- `RefundResult` = `{ id: number; paymentId: number; amount: number; status: string; dateCreated: string }`
- `PaymentMethodInfo` = `{ id: string; name: string; paymentTypeId: string; status: string; thumbnail: string }`

### `lib/payments/mercadopago/one-time/actions.ts` (server)

| Export | Arguments | Returns |
|---|---|---|
| `createCheckout` | `input: { items: { id?: string; title: string; description?: string; quantity: number; unit_price: number; currency_id?: string }[]; backUrls: { success: string; failure: string; pending: string }; metadata?: Record<string, unknown>; externalReference?: string; autoReturn?: "approved" \| "all" }` | `Promise<MPResult<{ id: string; initPoint: string; sandboxInitPoint: string }>>` — error if `items` is empty |
| `getPayment` | `paymentId: string \| number` | `Promise<MPResult<MPPayment>>` |
| `getPaymentStatus` | `paymentId: string \| number` | `Promise<MPResult<PaymentStatusResult>>` |
| `checkPaymentSuccess` | `paymentId: string \| number` (the `payment_id` query param) | `Promise<MPResult<{ success: boolean; payment: PaymentStatusResult }>>` — `success` is `true` only when status is `"approved"` |
| `checkPaymentFailure` | `paymentId: string \| number` (the `payment_id` query param) | `Promise<MPResult<{ failed: boolean; payment: PaymentStatusResult }>>` — `failed` is `true` when status is `"rejected"` or `"cancelled"` |
| `cancelPayment` | `paymentId: string \| number` | `Promise<MPResult<MPPayment>>` — only valid for `pending` / `in_process` payments |
| `refundPayment` | `paymentId: string \| number` | `Promise<MPResult<RefundResult>>` — full refund |
| `partialRefundPayment` | `paymentId: string \| number`, `amount: number` (> 0, currency units) | `Promise<MPResult<RefundResult>>` |
| `getPaymentMethods` | none | `Promise<MPResult<PaymentMethodInfo[]>>` |

### `lib/payments/mercadopago/one-time/client.ts` (client)

| Export | Arguments | Returns |
|---|---|---|
| `redirectToCheckout` | `checkoutUrl: string` (`initPoint` or `sandboxInitPoint`) | `void` — full-page redirect; throws if `checkoutUrl` is empty |

### `app/api/webhooks/mercadopago/route.ts`

| Export | Arguments | Returns |
|---|---|---|
| `POST` | `request: NextRequest` (JSON body + `x-signature` and `x-request-id` headers) | `NextResponse`: `200 { received: true }`, `400` invalid JSON or missing signature / request id / `data.id`, `401` invalid signature, `500` misconfigured secret |

## Examples

Create a checkout (Server Action) and redirect (Client Component):

```ts
// app/actions/buy.ts
"use server";
import { createCheckout } from "@/lib/payments/mercadopago/one-time/actions";

export async function buy(orderId: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL;
  return createCheckout({
    items: [{ title: "Pro license", quantity: 1, unit_price: 49.9, currency_id: "ARS" }],
    externalReference: orderId,
    backUrls: {
      success: `${base}/payment/success`,
      failure: `${base}/payment/failure`,
      pending: `${base}/payment/pending`,
    },
  });
}
```

```tsx
// components/BuyButton.tsx
"use client";
import { redirectToCheckout } from "@/lib/payments/mercadopago/one-time/client";
import { buy } from "@/app/actions/buy";

export function BuyButton({ orderId }: { orderId: string }) {
  return (
    <button
      onClick={async () => {
        const result = await buy(orderId);
        if (result.success) redirectToCheckout(result.data.initPoint); // sandboxInitPoint with test credentials
        else console.error(result.error);
      }}
    >
      Buy
    </button>
  );
}
```

Success / failure state in a Server Component (`payment_id` must be present in the query params):

```tsx
// app/payment/success/page.tsx
import { checkPaymentSuccess } from "@/lib/payments/mercadopago/one-time/actions";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { payment_id } = await searchParams;
  if (typeof payment_id !== "string") return <p>Missing payment_id</p>;

  const result = await checkPaymentSuccess(payment_id);
  if (!result.success) return <p>{result.error}</p>;
  if (!result.data.success) return <p>Not approved. Status: {result.data.payment.status}</p>;

  return <p>Payment approved</p>;
}
```

Cancel, full refund and partial refund:

```ts
import {
  cancelPayment,
  refundPayment,
  partialRefundPayment,
} from "@/lib/payments/mercadopago/one-time/actions";

await cancelPayment(paymentId);              // only pending / in_process
await refundPayment(paymentId);              // full refund of an approved payment
await partialRefundPayment(paymentId, 10.5); // partial refund of 10.50
```

Handling the result of any action:

```ts
const result = await getPayment(paymentId);
if (!result.success) {
  // result.error is a message string; result.code is Mercado Pago's HTTP status when available
  return;
}
// result.data is MPPayment
```