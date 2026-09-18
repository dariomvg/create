# Stripe Billing — Setup

Self-contained module for SaaS-style billing: Customer Portal, invoices,
payment history, payment methods, upcoming invoice, and billing cycle.

This is separate from the one-time payments module (`lib/stripe/`) — no
shared code, no shared webhook endpoint. Both wrap the same Stripe account,
but keep their concerns independent.

**Assumption:** this module operates on an existing Stripe `customerId` /
`subscriptionId` that you already have on hand. It does not create
customers or subscriptions — that's outside its scope.

## Dependencies

- [`stripe`](https://www.npmjs.com/package/stripe) — server-side SDK, used in `lib/stripe-billing/service.ts`
- [`@stripe/stripe-js`](https://www.npmjs.com/package/@stripe/stripe-js) — client-side SDK, used in `lib/stripe-billing/client.ts`

Not installed automatically — add them with your package manager before
using the module. If you already installed them for the payments module,
you're covered — same packages.

## File map

```
lib/stripe-billing/
├── service.ts   # Internal logic + Stripe SDK instance. Don't touch/import directly elsewhere.
├── actions.ts   # Server Actions — import into Server Components.
├── types.ts     # Shared types — safe to import anywhere.
└── client.ts    # Client-side helpers — import into Client Components.

app/api/webhooks/stripe-billing/
└── route.ts     # Billing webhook endpoint. Register this URL in your Stripe Dashboard.

.env.local       # Adds STRIPE_BILLING_WEBHOOK_SECRET (reuses STRIPE_SECRET_KEY
                 # and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY if you already set
                 # those up for the payments module).
```

## 1. Environment variables

`STRIPE_SECRET_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` are shared with
the payments module — set them once. Add on top:

| Variable | Where to get it |
|---|---|
| `STRIPE_BILLING_WEBHOOK_SECRET` | Dashboard → Developers → Webhooks (create a **second**, separate endpoint) |

## 2. Customer Portal

Enable and configure the portal in the Dashboard first:
**Settings → Billing → Customer portal**. Choose what customers can do
there (cancel plans, update payment methods, view invoices, etc.) —
`createCustomerPortalSession` just opens a session against whatever you
configure there.

## 3. Webhooks

Add a **second, separate** endpoint in the Stripe Dashboard pointing to:

```
https://yourdomain.com/api/webhooks/stripe-billing
```

Subscribe it to at least:

- `invoice.paid`
- `invoice.payment_failed`
- `invoice.upcoming`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `payment_method.attached`
- `payment_method.detached`

For local testing:

```
stripe listen --forward-to localhost:3000/api/webhooks/stripe-billing
```

Business logic for what happens on each event goes inside
`stripeBillingService.handleWebhookEvent` in `service.ts` — the one part
of that file meant to be extended as your billing needs grow.

## 4. Usage

### Customer Portal (billing history, invoices, cancel — all Stripe-hosted)

```ts
import { createCustomerPortalSession } from "@/lib/stripe-billing/actions";

const result = await createCustomerPortalSession({
  customerId,
  returnUrl: "https://yourdomain.com/account/billing",
});

if (result.success) {
  // redirect the user to result.data.url
}
```

Or from a Client Component, once you have the URL:

```ts
"use client";
import { redirectToCustomerPortal } from "@/lib/stripe-billing/client";

redirectToCustomerPortal(url);
```

### Invoices

```ts
import { listInvoices, getInvoice, getInvoiceStatus } from "@/lib/stripe-billing/actions";

const invoices = await listInvoices({ customerId });
const invoice = await getInvoice(invoiceId);
const status = await getInvoiceStatus(invoiceId);
```

### Payment history

```ts
import { listPaymentHistory } from "@/lib/stripe-billing/actions";

const history = await listPaymentHistory(customerId);
```

### Payment methods

```ts
import { listPaymentMethods } from "@/lib/stripe-billing/actions";

const methods = await listPaymentMethods(customerId);
// each entry includes isDefault
```

### Update payment method (SetupIntent + Stripe Elements)

Server side:

```ts
import { createSetupIntent } from "@/lib/stripe-billing/actions";

const result = await createSetupIntent(customerId);
// result.data.clientSecret — pass to your Elements form
```

Client side, after collecting card details with Stripe Elements:

```ts
"use client";
import { confirmCardSetup } from "@/lib/stripe-billing/client";

const result = await confirmCardSetup(clientSecret, paymentMethodId);
```

Then finish by setting it as the default:

```ts
import { setDefaultPaymentMethod } from "@/lib/stripe-billing/actions";

await setDefaultPaymentMethod(customerId, result.data.paymentMethodId);
```

### Upcoming invoice & billing cycle

```ts
import { getUpcomingInvoice, getBillingCycle } from "@/lib/stripe-billing/actions";

const upcoming = await getUpcomingInvoice(customerId);
const cycle = await getBillingCycle(subscriptionId);
```

## Error handling

Every `actions.ts` and `client.ts` function returns:

```ts
{ success: true, data: T } | { success: false, error: string }
```

Always check `result.success` before reading `result.data` — nothing
throws across the module boundary.

## Notes

- `service.ts` is the only file that imports the `stripe` package or reads
  `STRIPE_SECRET_KEY` / `STRIPE_BILLING_WEBHOOK_SECRET`.
- This module doesn't create or manage subscriptions — `getBillingCycle`
  reads an existing subscription's dates/status, it doesn't create one.
- If you need to look up a customer's `subscriptionId` from your own DB,
  that lookup happens outside this module — it's app-specific, not a
  Stripe billing concern.
