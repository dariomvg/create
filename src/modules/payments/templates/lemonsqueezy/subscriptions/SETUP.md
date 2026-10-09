# Lemon Squeezy — Subscriptions

## Description

Recurring payments with Lemon Squeezy for Next.js (App Router). Covers: subscription checkout, get subscription, status, cancel, resume (after cancel), pause, unpause, plan change (upgrade / downgrade / change plan), quantity change, trial, renewal and expiration info, and subscription lifecycle webhooks.

Architecture:

- `service.ts` — internal logic (SDK calls, mapping, webhook signature verification). Never import it from components or routes, except the webhook route handler.
- `actions.ts` — server-only functions. Import from Server Components / Server Actions / route handlers.
- `client.ts` — browser-only helpers (`"use client"`). They never use the API key.
- `types.ts` — shared types.

All `actions.ts` functions never throw: they return `SubscriptionResult<T>` = `{ success: true; data: T } | { success: false; error: string }`.

### Lemon Squeezy specifics and limitations

- **No "create subscription" endpoint.** A Subscription is created automatically when a Checkout for a subscription variant is completed. `createSubscriptionCheckout` is the only creation call.
- **No list / lookup function.** `subscriptionId` must come from your own storage, populated in the webhook handler (`subscription_created` → `payload.data.id`, marked spot in `route.ts`).
- **Upgrade, downgrade and change plan are the same operation** (`updateSubscription` with a new `variantId`). The module exposes one function: `changeSubscriptionPlan`. Do not add separate upgrade/downgrade functions.
- **"Resume" means two different things:**
  - `resumeCancelledSubscription` — reverts a cancellation, only valid during the grace period (before `endsAt`).
  - `unpauseSubscription` — resumes a paused subscription.
  Calling the wrong one fails if the subscription is not in the matching state.
- **Renewal and expiration are read-only.** There is no "renew" endpoint. `getRenewalInfo` / `getExpirationInfo` read `renewsAt` / `endsAt`.
- **Trial is a field (`trialEndsAt`), not a flow.** Skip the variant's default trial with `skipTrial` at checkout, or change it on an existing subscription with `extendTrial`.
- **Quantity belongs to the subscription item, not the subscription.** `changeSubscriptionQuantity` takes a `subscriptionItemId` (`firstSubscriptionItemId` from `getSubscription`).
- **Payment method updates have no API.** Use the hosted customer portal: `customerPortalUrl` (or `updatePaymentMethodUrl`) on the Subscription object.
- The module assumes the `variantId` already exists in the Lemon Squeezy store (it does not manage products/variants).
- The webhook handler only logs events. Persistence / side effects must be added inside its `switch`.

## Dependencies

- `@lemonsqueezy/lemonsqueezy.js` (official SDK)
- `server-only`
- `next` (App Router)

## Environment variables

| Variable | Required | Where to get it |
|---|---|---|
| `LEMONSQUEEZY_API_KEY` | yes | Dashboard → Settings → API (shared with the one-time payments module) |
| `LEMONSQUEEZY_STORE_ID` | yes | Dashboard → Settings → Stores (shared with the one-time payments module) |
| `LEMONSQUEEZY_SUBSCRIPTIONS_WEBHOOK_SECRET` | yes | Signing secret of a **separate** webhook pointing to `/api/webhooks/lemonsqueezy-subscriptions` |

## File structure

```
lib/payments/lemon-squeezy/subscriptions/
  service.ts   Internal. SDK calls, Subscription mapping, verifyWebhookSignature, parseWebhookPayload.
  actions.ts   Server-only public functions (see Public API).
  client.ts    Client-only public functions (see Public API).
  types.ts     CreateSubscriptionCheckoutParams, SubscriptionCheckoutResult, LemonSqueezySubscription,
               SubscriptionStatus, ChangeSubscriptionPlanParams, ChangeSubscriptionQuantityParams,
               PauseSubscriptionParams, SubscriptionResult, LemonSqueezySubscriptionWebhookPayload.

app/api/webhooks/lemonsqueezy-subscriptions/route.ts
               POST handler. Verifies the X-Signature header against the raw body, then handles
               lifecycle events (log only; add persistence here).
               Register `https://<your-domain>/api/webhooks/lemonsqueezy-subscriptions` in the
               Lemon Squeezy dashboard subscribed to: subscription_created, subscription_updated,
               subscription_cancelled, subscription_resumed, subscription_paused,
               subscription_unpaused, subscription_expired, subscription_plan_changed.
```

Imports use the `@/` alias, e.g. `@/lib/payments/lemon-squeezy/subscriptions/actions`.

## Public API

Shared shapes:

- `SubscriptionStatus` = `"on_trial" | "active" | "paused" | "past_due" | "unpaid" | "cancelled" | "expired" | "incomplete" | "incomplete_expired"`
- `LemonSqueezySubscription` = `{ id, storeId, customerId, orderId, productId, variantId, productName, variantName, userEmail, userName, status: SubscriptionStatus, statusFormatted, cancelled: boolean, pause: { mode: "void" | "free"; resumesAt: string | null } | null, trialEndsAt, renewsAt, endsAt, createdAt, firstSubscriptionItemId: number | null, cardBrand, cardLastFour, customerPortalUrl, updatePaymentMethodUrl }` (dates are ISO strings or `null`)

### `lib/payments/lemon-squeezy/subscriptions/actions.ts` (server only)

| Export | Arguments | Returns |
|---|---|---|
| `createSubscriptionCheckout` | `params: { variantId: number; email?: string; customData?: Record<string, string \| number \| boolean>; redirectUrl?: string; embed?: boolean; skipTrial?: boolean }` | `Promise<SubscriptionResult<{ id: string; url: string; expiresAt: string \| null }>>` |
| `getSubscription` | `subscriptionId: string` | `Promise<SubscriptionResult<LemonSqueezySubscription>>` |
| `getSubscriptionStatus` | `subscriptionId: string` | `Promise<SubscriptionResult<SubscriptionStatus>>` |
| `getRenewalInfo` | `subscriptionId: string` | `Promise<SubscriptionResult<{ renewsAt: string \| null; status: SubscriptionStatus }>>` |
| `getExpirationInfo` | `subscriptionId: string` | `Promise<SubscriptionResult<{ endsAt: string \| null; status: SubscriptionStatus }>>` |
| `cancelSubscription` | `subscriptionId: string` | `Promise<SubscriptionResult<LemonSqueezySubscription>>` — enters grace period until `endsAt` |
| `resumeCancelledSubscription` | `subscriptionId: string` | `Promise<SubscriptionResult<LemonSqueezySubscription>>` — only during the grace period |
| `pauseSubscription` | `params: { subscriptionId: string; mode?: "void" \| "free"; resumesAt?: string }` (`mode` defaults to `"void"`; omit `resumesAt` = pause indefinitely) | `Promise<SubscriptionResult<LemonSqueezySubscription>>` |
| `unpauseSubscription` | `subscriptionId: string` | `Promise<SubscriptionResult<LemonSqueezySubscription>>` — only for paused subscriptions |
| `changeSubscriptionPlan` | `params: { subscriptionId: string; variantId: number; invoiceImmediately?: boolean; disableProrations?: boolean }` | `Promise<SubscriptionResult<LemonSqueezySubscription>>` — upgrade, downgrade and change plan |
| `changeSubscriptionQuantity` | `params: { subscriptionItemId: number; quantity: number }` | `Promise<SubscriptionResult<{ subscriptionItemId: number; quantity: number }>>` |
| `extendTrial` | `subscriptionId: string`, `trialEndsAt: string` (ISO date) | `Promise<SubscriptionResult<LemonSqueezySubscription>>` |

### `lib/payments/lemon-squeezy/subscriptions/client.ts` (client only)

| Export | Arguments | Returns |
|---|---|---|
| `redirectToSubscriptionCheckout` | `checkoutUrl: string` | `void` — full-page redirect; throws if empty |
| `openSubscriptionCheckoutOverlay` | `checkoutUrl: string` (checkout created with `embed: true`; needs Lemon.js loaded) | `void` — falls back to `redirectToSubscriptionCheckout` if Lemon.js is not loaded; throws if empty |
| `redirectToCustomerPortal` | `customerPortalUrl: string` (from `getSubscription` → `data.customerPortalUrl`) | `void` — full-page redirect; throws if empty |

### `app/api/webhooks/lemonsqueezy-subscriptions/route.ts`

| Export | Arguments | Returns |
|---|---|---|
| `POST` | `request: NextRequest` (raw body + `x-signature` header) | `NextResponse`: `200 { received: true }`, `400` unreadable body / invalid JSON, `401` invalid signature, `500` misconfigured secret or handler error |

## Examples

Start a subscription (Server Action) and redirect (Client Component):

```ts
// app/actions/subscribe.ts
"use server";
import { createSubscriptionCheckout } from "@/lib/payments/lemon-squeezy/subscriptions/actions";

export async function subscribe(variantId: number, email: string) {
  return createSubscriptionCheckout({
    variantId,
    email,
    redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL}/subscription/result`,
  });
}
```

```tsx
// components/SubscribeButton.tsx
"use client";
import { redirectToSubscriptionCheckout } from "@/lib/payments/lemon-squeezy/subscriptions/client";
import { subscribe } from "@/app/actions/subscribe";

export function SubscribeButton({ variantId, email }: { variantId: number; email: string }) {
  return (
    <button
      onClick={async () => {
        const result = await subscribe(variantId, email);
        if (result.success) redirectToSubscriptionCheckout(result.data.url);
        else console.error(result.error);
      }}
    >
      Subscribe
    </button>
  );
}
```

Read state, then change plan and quantity:

```ts
import {
  getSubscription,
  changeSubscriptionPlan,
  changeSubscriptionQuantity,
} from "@/lib/payments/lemon-squeezy/subscriptions/actions";

const sub = await getSubscription(subscriptionId);
if (!sub.success) return sub.error;

// upgrade / downgrade / change plan: same call
await changeSubscriptionPlan({
  subscriptionId,
  variantId: newVariantId,
  invoiceImmediately: true,
});

// quantity uses the subscription item id
if (sub.data.firstSubscriptionItemId) {
  await changeSubscriptionQuantity({
    subscriptionItemId: sub.data.firstSubscriptionItemId,
    quantity: 5,
  });
}
```

Cancel vs pause (and their matching "resume"):

```ts
import {
  cancelSubscription,
  resumeCancelledSubscription,
  pauseSubscription,
  unpauseSubscription,
} from "@/lib/payments/lemon-squeezy/subscriptions/actions";

await cancelSubscription(subscriptionId);
await resumeCancelledSubscription(subscriptionId); // only before endsAt

await pauseSubscription({ subscriptionId, mode: "void", resumesAt: "2026-12-01T00:00:00Z" });
await unpauseSubscription(subscriptionId);
```

Renewal / expiration info and customer portal:

```ts
import { getRenewalInfo, getExpirationInfo, getSubscription } from "@/lib/payments/lemon-squeezy/subscriptions/actions";

const renewal = await getRenewalInfo(subscriptionId);     // { renewsAt, status }
const expiration = await getExpirationInfo(subscriptionId); // { endsAt, status }

const sub = await getSubscription(subscriptionId);
// sub.data.customerPortalUrl -> pass to redirectToCustomerPortal() on the client
```