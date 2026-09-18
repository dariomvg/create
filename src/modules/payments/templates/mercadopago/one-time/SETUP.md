# Mercado Pago — One-time Payments Module

Complete module for handling one-time payments through Mercado Pago
(Checkout Pro) in a Next.js App Router project. No subscriptions, no
billing — just: checkout, payment lookup, cancellation, refunds, payment
methods, and webhooks.

## Dependency

This module uses Mercado Pago's official Node SDK:

- `mercadopago` (v2)

## File structure

```
lib/mercadopago/
  service.ts   Direct Mercado Pago SDK calls. Internal only — don't import
               this from components, go through actions.ts or client.ts.
  actions.ts   Server-side functions ready to import into server components
               (or call as Server Actions from client components).
  types.ts     Shared TypeScript types for preferences, payments, refunds,
               payment methods, and webhook payloads.
  client.ts    The one client-side helper this module needs: redirecting
               the browser to the Mercado Pago checkout page.

app/api/webhooks/mercadopago/route.ts
  Receives and validates Mercado Pago's payment notifications.

.env.local
  Environment variables (see below).
```

## Environment variables

| Variable | Where to find it |
|---|---|
| `MERCADOPAGO_ACCESS_TOKEN` | Mercado Pago Developer Dashboard → Your application → Production/Test credentials → Access Token |
| `MERCADOPAGO_WEBHOOK_SECRET` | Developer Dashboard → Your application → Webhooks → Signature secret |
| `NEXT_PUBLIC_APP_URL` | Your app's own public base URL (e.g. `https://yourapp.com`, or an ngrok/tunnel URL while testing webhooks locally) |

Use **test credentials** while developing — Mercado Pago's sandbox lets you
simulate approved/rejected/pending payments with test cards, without
touching the production API.

## How the flow works

1. **Create a checkout** — call `createCheckout` from `actions.ts` with your
   items and `back_urls`. It returns `initPoint` (production) and
   `sandboxInitPoint` (test credentials).
2. **Redirect the user** — from a client component, pass that URL to
   `redirectToCheckout` in `client.ts`.
3. **User pays** on Mercado Pago's hosted checkout page.
4. **Mercado Pago redirects back** to whichever `back_urls` entry matches
   the outcome (`success`, `failure`, or `pending`), appending a
   `payment_id` query param.
5. **You resolve the outcome** by reading `payment_id` from the URL on that
   page and calling `checkPaymentSuccess` / `checkPaymentFailure` /
   `getPaymentStatus` from `actions.ts`. These are plain functions, not
   generated pages — wire them into whatever success/failure UI you already
   have.
6. **Mercado Pago also calls your webhook** (`app/api/webhooks/mercadopago/route.ts`)
   independently of the redirect — treat the webhook as your source of
   truth for order fulfillment, and the redirect as just the user-facing UX.
   The redirect can be skipped by the user (closing the tab, etc.), the
   webhook can't.

## Naming notes (Mercado Pago-specific)

- "Checkout" maps to Mercado Pago's **Preference** resource (Checkout Pro).
  There's no separate "create payment" step on our side — Mercado Pago
  creates the actual **Payment** resource on their end once the user pays;
  we only ever read it (`getPayment`, `getPaymentStatus`).
- **Cancellation** isn't a dedicated endpoint — it's updating a payment's
  `status` to `cancelled`, and only works while the payment is `pending` or
  `in_process`. An `approved` payment can't be cancelled, only refunded.
- **Refund** and **partial refund** use the same underlying endpoint —
  omitting `amount` does a full refund, passing it does a partial one.
  `actions.ts` exposes them as two separate functions (`refundPayment`,
  `partialRefundPayment`) for clarity.
- **Payment methods** (`getPaymentMethods`) lists the methods enabled for
  your Mercado Pago account/country — it's not tied to a specific payment.

## Webhook setup

1. In the Developer Dashboard, go to your application → **Webhooks**.
2. Set the notification URL to `https://yourdomain.com/api/webhooks/mercadopago`.
3. Subscribe to the `payments` topic.
4. Copy the **signature secret** shown there into `MERCADOPAGO_WEBHOOK_SECRET`.

The route handler verifies the `x-signature` header on every request and
rejects anything that doesn't match before touching the payment — see the
comment in `service.ts`'s `verifyWebhookSignature` for how the signature is
computed.

To fill in your own business logic (marking an order as paid, sending a
confirmation email, etc.), edit the commented block inside
`app/api/webhooks/mercadopago/route.ts`.

## Optional: an "orders" table

This module only talks to Mercado Pago — it doesn't persist anything. If
you want to track purchases in your own database, a minimal generic table
looks like this:

```sql
CREATE TABLE orders (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_reference  TEXT UNIQUE NOT NULL,   -- pass this as externalReference to createCheckout
  mp_payment_id       TEXT,                   -- filled in once the webhook resolves the payment
  status              TEXT NOT NULL DEFAULT 'pending', -- pending | approved | cancelled | refunded
  amount              NUMERIC NOT NULL,
  currency            TEXT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Typical flow: create a row with `status = 'pending'` right before calling
`createCheckout`, then update `status` and `mp_payment_id` inside the
webhook handler once you read the payment's real status.

## Error handling

Every function in `service.ts` and `actions.ts` returns a result object
instead of throwing:

```ts
{ success: true, data: T } | { success: false, error: string, code?: string }
```

Always check `result.success` before using `result.data`.
