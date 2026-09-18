# Mercado Pago — Subscriptions Module

Complete module for handling recurring payments through Mercado Pago
(PreApproval) in a Next.js App Router project. Separate from the
one-time payments module — no shared code, no shared webhook.

This module assumes a **PreApprovalPlan** already exists (created in the
Mercado Pago dashboard or elsewhere). It only creates and manages individual
subscription instances against that plan — it does not manage a plan
catalog.

## Dependency

- `mercadopago` (v2) — same official SDK used by the one-time payments
  module. One exception: fetching authorized payments hits the REST API
  directly, since the SDK doesn't expose that sub-resource yet.

## File structure

```
lib/mercadopago-subscriptions/
  service.ts   Direct Mercado Pago API calls (PreApproval SDK + two raw REST
               calls for authorized payments). Internal only — don't import
               this from components.
  actions.ts   Server-side functions ready to import into server components
               (or call as Server Actions from client components).
  types.ts     Shared TypeScript types for subscriptions, recurring charges,
               and webhook payloads.
  client.ts    The one client-side helper this module needs: redirecting
               the browser to the subscription authorization page.

app/api/webhooks/mercadopago-subscriptions/route.ts
  Receives and validates subscription lifecycle and recurring-charge
  notifications.

.env.local
  Environment variables (see below).
```

## Environment variables

| Variable | Where to find it |
|---|---|
| `MERCADOPAGO_ACCESS_TOKEN` | Developer Dashboard → Your application → Production/Test credentials → Access Token (same one used by the payments module) |
| `MERCADOPAGO_SUBSCRIPTIONS_WEBHOOK_SECRET` | Developer Dashboard → Your application → Webhooks → Signature secret — configure a **separate** webhook URL for this module and use the secret shown there |
| `NEXT_PUBLIC_APP_URL` | Your app's own public base URL |

## How the flow works

1. **Create a subscription** — call `createSubscription` from `actions.ts`
   with the `preapprovalPlanId`, the payer's email, and a `backUrl`. It
   returns `initPoint`.
2. **Redirect the payer** — from a client component, pass that URL to
   `redirectToSubscriptionCheckout` in `client.ts`.
3. **Payer authorizes** the subscription on Mercado Pago's hosted page and
   is redirected back to your `backUrl`.
4. **Mercado Pago charges automatically** on each billing cycle, and notifies
   your webhook for both lifecycle changes and each individual charge.
5. **You read status on demand** via `getSubscription` / `getSubscriptionStatus`,
   or derive `getRenewalInfo` / `getExpirationInfo` when you need to display
   that to a user.

## Naming and behavior notes (Mercado Pago-specific)

- The resource is called **PreApproval**, not "Subscription" — that's
  Mercado Pago's own term for a recurring authorization.
- **Cancel / Pause / Resume** are the same endpoint under the hood, just a
  different `status` value (`cancelled` / `paused` / `authorized`).
  Cancellation is terminal — a cancelled subscription cannot be resumed.
- **Upgrade, downgrade, change plan, and change quantity** are all exposed
  as a single function, `changeSubscriptionAmount`. Mercado Pago doesn't let
  you swap a subscription's `preapproval_plan_id` after creation — the only
  thing you can update on an active subscription is its recurring
  `transaction_amount`. Whether a given amount change counts as an upgrade
  or downgrade is entirely up to your own UI/logic.
- **Trial** (`freeTrial`) can only be set when creating the subscription —
  there's no endpoint to add or remove a trial afterward.
- **Renewal** isn't a field Mercado Pago exposes directly. `getRenewalInfo`
  derives it from the subscription's last processed authorized payment plus
  its billing frequency — `estimatedNextPaymentDate` is a calculation we
  make, not something Mercado Pago guarantees.
- **Expiration** only applies if the plan has an `auto_recurring.end_date`
  set. If it doesn't, a subscription only stops via cancellation —
  `getExpirationInfo` will always report `expired: false` in that case.

## Webhook setup

1. In the Developer Dashboard, go to your application → **Webhooks**.
2. Add a notification URL: `https://yourdomain.com/api/webhooks/mercadopago-subscriptions`
   (a different URL than the one used by the payments module).
3. Subscribe to both the `subscription_preapproval` and
   `subscription_authorized_payment` topics.
4. Copy the **signature secret** shown there into
   `MERCADOPAGO_SUBSCRIPTIONS_WEBHOOK_SECRET`.

The route handler validates `x-signature` on every request, then branches
on `type`:

- `preapproval` → fetches the subscription and is where you'd sync your own
  records to its lifecycle status.
- `subscription_authorized_payment` → fetches that specific charge (its
  `data.id` is the payment id, not the subscription id) and is where you'd
  record a renewal or react to a failed/retried charge.

Fill in your own logic inside the commented blocks in
`app/api/webhooks/mercadopago-subscriptions/route.ts`.

## Error handling

Every function in `service.ts` and `actions.ts` returns a result object
instead of throwing:

```ts
{ success: true, data: T } | { success: false, error: string, code?: string }
```

Always check `result.success` before using `result.data`.
