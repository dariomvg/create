# Stripe — Billing Management

## Description

SaaS billing management with Stripe for a Next.js App Router project: Customer Portal sessions, invoices (list, detail, status), payment history, saved payment methods, updating the default payment method, upcoming invoice, billing cycle, and a webhook endpoint for billing events.

It operates on existing Stripe objects: a `customerId` (and a `subscriptionId` for billing cycle) that you already have.

Every `actions.ts` function returns a serializable `ActionResult<T>` and never throws across the module boundary. Amounts are integers in the smallest currency unit (e.g. cents). Timestamps are Unix seconds.

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
| `STRIPE_BILLING_WEBHOOK_SECRET` | Server | Signing secret of the Stripe webhook endpoint pointing to `/api/webhooks/stripe-billing`. |

## File structure

```
lib/payments/stripe/billing-management/
├── actions.ts   # Server Actions — import from Server Components / server code
├── client.ts    # Browser helpers — import from Client Components
├── types.ts     # Shared types — safe to import anywhere
└── service.ts   # Internal Stripe logic — never import it from outside this folder

app/api/webhooks/stripe-billing/
└── route.ts     # Webhook endpoint (POST)
```

Import alias: `@/lib/payments/stripe/billing-management/<file>`.

Webhook event handling lives in `service.ts` → `stripeBillingService.handleWebhookEvent` (logs only by default). Your app's sync logic for each event goes there.

The Customer Portal must be configured in the Stripe Dashboard (Settings → Billing → Customer portal); `createCustomerPortalSession` opens a session against that configuration.

## Public API

### `actions.ts` (server)

| Export | Arguments | Returns |
|---|---|---|
| `createCustomerPortalSession` | `params: CreatePortalSessionParams` | `ActionResult<{ url: string }>` |
| `listInvoices` | `params: ListInvoicesParams` | `ActionResult<InvoiceSummary[]>` |
| `getInvoice` | `invoiceId: string` | `ActionResult<InvoiceSummary>` |
| `getInvoiceStatus` | `invoiceId: string` | `ActionResult<InvoiceStatus>` |
| `listPaymentHistory` | `customerId: string, limit?: number` (default 10; based on charges) | `ActionResult<PaymentHistoryEntry[]>` |
| `listPaymentMethods` | `customerId: string` (cards only) | `ActionResult<PaymentMethodSummary[]>` — each entry has `isDefault` |
| `createSetupIntent` | `customerId: string` | `ActionResult<{ clientSecret: string \| null }>` |
| `setDefaultPaymentMethod` | `customerId: string, paymentMethodId: string` | `ActionResult<{ id: string }>` |
| `getUpcomingInvoice` | `customerId: string` | `ActionResult<UpcomingInvoiceSummary>` |
| `getBillingCycle` | `subscriptionId: string` | `ActionResult<BillingCycleSummary>` |
| `handleStripeBillingWebhook` | `rawBody: string, signature: string` | `ActionResult<{ received: true }>` |

Validation: id arguments must be non-empty.

### `client.ts` (browser)

| Export | Arguments | Returns |
|---|---|---|
| `redirectToCustomerPortal` | `url: string` (the `url` from `createCustomerPortalSession`) | `void` — navigates via `window.location.href` |
| `confirmCardSetup` | `clientSecret: string, paymentMethodId: string` | `Promise<ActionResult<{ paymentMethodId: string }>>` |
| `getStripe` | none | `Promise<Stripe \| null>` — shared Stripe.js instance, for Elements |

### `app/api/webhooks/stripe-billing/route.ts`

| Export | Arguments | Returns |
|---|---|---|
| `POST` | `request: Request` (needs the `stripe-signature` header; reads the raw body) | `200 { received: true }` · `400 { error: string }` |

Events handled: `invoice.paid`, `invoice.payment_failed`, `invoice.upcoming`, `customer.subscription.updated`, `customer.subscription.deleted`, `payment_method.attached`, `payment_method.detached`.

### Key types (`types.ts`)

```ts
type InvoiceStatus = "draft" | "open" | "paid" | "uncollectible" | "void";

interface CreatePortalSessionParams { customerId: string; returnUrl: string }

interface ListInvoicesParams {
  customerId: string;
  limit?: number;         // default 10
  startingAfter?: string; // last invoice id of the previous page
}

interface InvoiceSummary {
  id: string; status: InvoiceStatus;
  amountDue: number; amountPaid: number; currency: string; created: number;
  hostedInvoiceUrl: string | null; invoicePdf: string | null;
  periodStart: number; periodEnd: number;
}

interface PaymentHistoryEntry {
  id: string; amount: number; currency: string;
  status: string; created: number; description: string | null;
}

interface PaymentMethodSummary {
  id: string; type: string; isDefault: boolean;
  card?: { brand: string; last4: string; expMonth: number; expYear: number };
}

interface UpcomingInvoiceSummary {
  amountDue: number; currency: string;
  periodStart: number; periodEnd: number; nextPaymentAttempt: number | null;
}

interface BillingCycleSummary {
  currentPeriodStart: number; currentPeriodEnd: number;
  status: Stripe.Subscription.Status; cancelAtPeriodEnd: boolean;
}
```

## Examples

### Customer Portal

```ts
"use server";
import { redirect } from "next/navigation";
import { createCustomerPortalSession } from "@/lib/payments/stripe/billing-management/actions";

export async function openPortal(customerId: string) {
  const result = await createCustomerPortalSession({
    customerId,
    returnUrl: "https://example.com/account/billing",
  });
  if (!result.success) return { error: result.error };
  redirect(result.data.url);
}
```

From a Client Component that already has the URL:

```ts
"use client";
import { redirectToCustomerPortal } from "@/lib/payments/stripe/billing-management/client";

redirectToCustomerPortal(url);
```

### Invoices and payment history

```ts
import {
  listInvoices, getInvoice, getInvoiceStatus, listPaymentHistory,
} from "@/lib/payments/stripe/billing-management/actions";

const invoices = await listInvoices({ customerId, limit: 20 });
const next = await listInvoices({ customerId, startingAfter: lastInvoiceId });

const invoice = await getInvoice(invoiceId);          // hostedInvoiceUrl, invoicePdf
const status = await getInvoiceStatus(invoiceId);
const history = await listPaymentHistory(customerId);
```

### Payment methods and update flow

```ts
// Server: list and start the update
import {
  listPaymentMethods, createSetupIntent, setDefaultPaymentMethod,
} from "@/lib/payments/stripe/billing-management/actions";

const methods = await listPaymentMethods(customerId);
const setup = await createSetupIntent(customerId);
// setup.data.clientSecret → pass it to your Elements form
```

```ts
// Client, after Elements produced a paymentMethodId
"use client";
import { confirmCardSetup } from "@/lib/payments/stripe/billing-management/client";

const confirmed = await confirmCardSetup(clientSecret, paymentMethodId);
```

```ts
// Server: make it the default
if (confirmed.success) {
  await setDefaultPaymentMethod(customerId, confirmed.data.paymentMethodId);
}
```

### Upcoming invoice and billing cycle

```ts
import { getUpcomingInvoice, getBillingCycle } from "@/lib/payments/stripe/billing-management/actions";

const upcoming = await getUpcomingInvoice(customerId);
const cycle = await getBillingCycle(subscriptionId);
```