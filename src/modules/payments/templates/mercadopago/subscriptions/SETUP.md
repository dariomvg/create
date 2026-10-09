# Mercado Pago — Subscriptions

## Description

Recurring payments with Mercado Pago (PreApproval) for Next.js (App Router). Covers: create subscription, get subscription, subscription status, cancel, pause, resume, amount changes (upgrade / downgrade / change plan / change quantity), trial, renewal info, expiration info, and subscription webhooks.

Architecture:

- `service.ts` — internal logic (SDK calls, raw REST calls, mapping, webhook signature verification). Never import it from components or routes, except the webhook route handler.
- `actions.ts` — server functions (`"use server"`). Import from Server Components, or call as Server Actions from Client Components.
- `client.ts` — browser-only helper. It never uses the access token.
- `types.ts` — shared types.

All `actions.ts` functions never throw: they return `MPResult<T>` = `{ success: true; data: T } | { success: false; error: string; code?: string }`. Always check `result.success` before reading `result.data`.

### Mercado Pago specifics and limitations

- **Subscription = PreApproval.** It is Mercado Pago's term for a recurring authorization. The subscription id is the PreApproval `id`.
- **The plan must already exist.** The module assumes a **PreApprovalPlan** (`preapprovalPlanId`) already exists in Mercado Pago. It does not create or manage plans.
- **Creating a subscription returns an authorization URL.** `createSubscription` returns `initPoint`; redirect the payer there to authorize. The subscription is `pending` until the payer authorizes it, then becomes `authorized`. No card tokenization happens in this module.
- **Status values** (`PreapprovalStatus`): `pending`, `authorized`, `paused`, `cancelled`.
- **Cancel / pause / resume are the same endpoint** with a different status (`cancelled` / `paused` / `authorized`). **Cancellation is terminal**: a cancelled subscription cannot be resumed; create a new one.
- **Upgrade / downgrade / change plan / change quantity are ONE function: `changeSubscriptionAmount`.** Mercado Pago does not allow swapping `preapproval_plan_id` on an existing subscription; the only editable term is the recurring `transaction_amount`. Whether a change is an "upgrade" or "downgrade" is decided by the caller. Amounts are in currency units (decimal), NOT cents.
- **Trial can only be set at creation** (`freeTrial` in `createSubscription`). There is no endpoint to add or remove a trial afterward.
- **Renewal is derived, not returned by Mercado Pago.** `getRenewalInfo` takes the last `processed` authorized payment and adds the billing frequency. `estimatedNextPaymentDate` is our calculation, and is `null` if no charge has been processed yet.
- **Expiration only applies if the plan has an `end_date`.** Without it, `getExpirationInfo` always reports `expired: false`. It does not look at `status`: a subscription cancelled before its `endDate` still reports `expired: false`; use `getSubscriptionStatus` for that.
- **Authorized payments** (the individual recurring charges) are read through direct REST calls, because the official SDK does not expose that sub-resource.
- **Two webhook event types.** `subscription_preapproval` (lifecycle; `data.id` is the subscription id) and `subscription_authorized_payment` (a recurring charge; `data.id` is the authorized payment id, NOT the subscription id; the charge exposes its subscription as `preapprovalId`). `preapproval` is also accepted as a legacy alias for the lifecycle event.
- The webhook handler only logs events. Persistence / side effects must be added inside the marked blocks in `route.ts`.
- Webhook processing returns `200` even if fetching the resource fails (logged), to avoid endless retries from Mercado Pago.
- `service.ts` throws at import time if `MERCADOPAGO_ACCESS_TOKEN` is missing.

## Dependencies

- `mercadopago` (official SDK, v2)
- `next` (App Router)

## Environment variables

| Variable | Required | Where to get it |
|---|---|---|
| `MERCADOPAGO_ACCESS_TOKEN` | yes | Developer Dashboard → your application → Credentials (same token as the one-time payments module) |
| `MERCADOPAGO_SUBSCRIPTIONS_WEBHOOK_SECRET` | yes | Developer Dashboard → your application → Webhooks → signature secret of the webhook pointing to `/api/webhooks/mercadopago-subscriptions`. Separate from the one-time payments secret |
| `NEXT_PUBLIC_APP_URL` | no | Your app's public base URL. Not read by the module; use it to build the `backUrl` you pass to `createSubscription` |

## File structure

```
lib/payments/mercadopago/subscriptions/
  service.ts   Internal. PreApproval SDK calls, raw REST calls for authorized payments,
               mapping, verifyWebhookSignature.
  actions.ts   Server public functions (see Public API).
  client.ts    Client public function (see Public API).
  types.ts     CreateSubscriptionInput, FreeTrialInput, MPSubscriptionResult, MPSubscription,
               MPAutoRecurring, PreapprovalStatus, SubscriptionStatusResult, AuthorizedPayment,
               AuthorizedPaymentStatus, RenewalInfo, ExpirationInfo,
               SubscriptionWebhookNotification, MPResult, MPErrorResult.

app/api/webhooks/mercadopago-subscriptions/route.ts
               POST handler. Verifies x-signature / x-request-id against data.id, then handles
               `subscription_preapproval` (fetches the subscription) and
               `subscription_authorized_payment` (fetches the charge). Logs only; add
               persistence here.
               Register `https://<your-domain>/api/webhooks/mercadopago-subscriptions` in the
               Mercado Pago dashboard subscribed to subscription and recurring charge events.
```

Imports use the `@/` alias, e.g. `@/lib/payments/mercadopago/subscriptions/actions`.

## Public API

Shared shapes:

- `PreapprovalStatus` = `"pending" | "authorized" | "paused" | "cancelled"`
- `MPSubscription` = `{ id: string; status: PreapprovalStatus; payerEmail: string; preapprovalPlanId: string | null; reason: string | null; externalReference: string | null; autoRecurring: { frequency: number; frequencyType: "days" | "months"; transactionAmount: number; currencyId: string; startDate: string | null; endDate: string | null; freeTrial: { frequency: number; frequencyType: "days" | "months" } | null }; dateCreated: string; lastModified: string }`
- `RenewalInfo` = `{ lastPaymentDate: string | null; estimatedNextPaymentDate: string | null; frequency: number; frequencyType: "days" | "months" }`
- `ExpirationInfo` = `{ endDate: string | null; expired: boolean }`

### `lib/payments/mercadopago/subscriptions/actions.ts` (server)

| Export | Arguments | Returns |
|---|---|---|
| `createSubscription` | `input: { preapprovalPlanId: string; payerEmail: string; backUrl: string; reason?: string; externalReference?: string; freeTrial?: { frequency: number; frequencyType: "days" \| "months" } }` | `Promise<MPResult<{ id: string; status: PreapprovalStatus; initPoint: string }>>` — error if `preapprovalPlanId` or `payerEmail` is missing |
| `getSubscription` | `id: string` | `Promise<MPResult<MPSubscription>>` |
| `getSubscriptionStatus` | `id: string` | `Promise<MPResult<{ id: string; status: PreapprovalStatus }>>` |
| `cancelSubscription` | `id: string` | `Promise<MPResult<MPSubscription>>` — terminal, cannot be resumed |
| `pauseSubscription` | `id: string` | `Promise<MPResult<MPSubscription>>` |
| `resumeSubscription` | `id: string` | `Promise<MPResult<MPSubscription>>` — for paused subscriptions |
| `changeSubscriptionAmount` | `id: string`, `newAmount: number` (> 0, currency units) | `Promise<MPResult<MPSubscription>>` — covers upgrade, downgrade, change plan and change quantity |
| `getRenewalInfo` | `id: string` | `Promise<MPResult<RenewalInfo>>` |
| `getExpirationInfo` | `id: string` | `Promise<MPResult<ExpirationInfo>>` |

### `lib/payments/mercadopago/subscriptions/client.ts` (client)

| Export | Arguments | Returns |
|---|---|---|
| `redirectToSubscriptionCheckout` | `authorizationUrl: string` (`initPoint` from `createSubscription`) | `void` — full-page redirect; throws if `authorizationUrl` is empty |

### `app/api/webhooks/mercadopago-subscriptions/route.ts`

| Export | Arguments | Returns |
|---|---|---|
| `POST` | `request: NextRequest` (JSON body + `x-signature` and `x-request-id` headers) | `NextResponse`: `200 { received: true }`, `400` invalid JSON or missing signature / request id / `data.id`, `401` invalid signature, `500` misconfigured secret |

## Examples

Create a subscription (Server Action) and redirect (Client Component):

```ts
// app/actions/subscribe.ts
"use server";
import { createSubscription } from "@/lib/payments/mercadopago/subscriptions/actions";

export async function subscribe(planId: string, email: string, userId: string) {
  return createSubscription({
    preapprovalPlanId: planId,
    payerEmail: email,
    externalReference: userId,
    backUrl: `${process.env.NEXT_PUBLIC_APP_URL}/billing/return`,
    freeTrial: { frequency: 7, frequencyType: "days" }, // optional, creation-time only
  });
}
```

```tsx
// components/SubscribeButton.tsx
"use client";
import { redirectToSubscriptionCheckout } from "@/lib/payments/mercadopago/subscriptions/client";
import { subscribe } from "@/app/actions/subscribe";

export function SubscribeButton({ planId, email, userId }: { planId: string; email: string; userId: string }) {
  return (
    <button
      onClick={async () => {
        const result = await subscribe(planId, email, userId);
        if (result.success) redirectToSubscriptionCheckout(result.data.initPoint);
        else console.error(result.error);
      }}
    >
      Subscribe
    </button>
  );
}
```

Pause, resume, cancel and change the amount:

```ts
import {
  pauseSubscription,
  resumeSubscription,
  cancelSubscription,
  changeSubscriptionAmount,
} from "@/lib/payments/mercadopago/subscriptions/actions";

await pauseSubscription(id);
await resumeSubscription(id);
await changeSubscriptionAmount(id, 4999.9); // upgrade, downgrade, plan or quantity change: same call
await cancelSubscription(id);               // terminal
```

Read state, renewal and expiration:

```ts
import {
  getSubscriptionStatus,
  getRenewalInfo,
  getExpirationInfo,
} from "@/lib/payments/mercadopago/subscriptions/actions";

const status = await getSubscriptionStatus(id);
if (status.success && status.data.status === "authorized") {
  const renewal = await getRenewalInfo(id);       // estimatedNextPaymentDate is calculated, may be null
  const expiration = await getExpirationInfo(id); // expired is false when the plan has no endDate
}
```

Handling the result of any action:

```ts
const result = await getSubscription(id);
if (!result.success) {
  // result.error is a message string; result.code is Mercado Pago's HTTP status when available
  return;
}
// result.data is MPSubscription
```