# Email — Resend — Webhooks

Receives Resend delivery events at a single route handler, verifies the signature, and dispatches each event to its own handler function where you add your logic. Handled events: `email.sent`, `email.delivered`, `email.bounced`, `email.failed`, `email.opened`, `email.clicked`.

## Dependencies

- `svix`

## Environment variables

| Variable | Description |
|---|---|
| `RESEND_WEBHOOK_SECRET` | Signing secret of the webhook endpoint, from the Resend dashboard |

## File structure

```
@/lib/email/resend/webhooks/
├── actions.ts   # one handler per event — edit these
├── service.ts   # internal logic (signature verification)
└── types.ts     # event types
```

Other files:

| Path | Purpose |
|---|---|
| `app/api/webhooks/resend/route.ts` | Webhook endpoint. Verifies the signature and calls the matching handler in `actions.ts`. Imports from `@/lib/email/resend/webhooks/*` |
| `.env.local` (project root) | `RESEND_WEBHOOK_SECRET` |

Flow: `Resend → route.ts (verify + dispatch) → actions.ts (your logic)`.

## Public API

### Route handler

`app/api/webhooks/resend/route.ts`

| Export | Arguments | Returns |
|---|---|---|
| `POST` | `request: NextRequest` — raw JSON body plus the `svix-id`, `svix-timestamp` and `svix-signature` headers sent by Resend | `200` `{ received: true }` when the event was verified (events outside the six handled types are acknowledged and ignored); `401` `{ error: "Invalid signature" }` when verification fails |

If a handler in `actions.ts` throws, the route responds with an error status and Resend retries the delivery.

### Event handlers

`@/lib/email/resend/webhooks/actions` — plain server-side async functions called only by `route.ts` (no `"use server"`; do not import them into Client Components). Each ships as an empty stub for you to fill in.

| Export | Triggered by | Arguments | Returns |
|---|---|---|---|
| `onEmailSent` | `email.sent` | `event: ResendWebhookEvent` | `Promise<void>` |
| `onEmailDelivered` | `email.delivered` | `event: ResendWebhookEvent` | `Promise<void>` |
| `onEmailBounced` | `email.bounced` | `event: ResendWebhookEvent` | `Promise<void>` |
| `onEmailFailed` | `email.failed` | `event: ResendWebhookEvent` | `Promise<void>` |
| `onEmailOpened` | `email.opened` | `event: ResendWebhookEvent` | `Promise<void>` |
| `onEmailClicked` | `email.clicked` | `event: ResendWebhookEvent` | `Promise<void>` |

### Event shape

```ts
interface ResendWebhookEvent {
  type: "email.sent" | "email.delivered" | "email.bounced" | "email.failed" | "email.opened" | "email.clicked";
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    [key: string]: unknown; // extra fields vary by event type
  };
}
```

## Configuration

1. In the [Resend dashboard](https://resend.com), go to **Webhooks** → **Add Webhook**.
2. Set the endpoint URL to `https://<your-domain>/api/webhooks/resend`.
3. Select the events: `email.sent`, `email.delivered`, `email.bounced`, `email.failed`, `email.opened`, `email.clicked`.
4. Copy the endpoint's **Signing Secret** into `RESEND_WEBHOOK_SECRET`.
5. For local development, expose your dev server with a tunnel (e.g. ngrok) and use the tunnel URL as the endpoint.
6. Opened and clicked events are only reported for emails sent from a domain with open/click tracking enabled in Resend's domain settings.

## Examples

Mark an address as invalid when it bounces:

```ts
// @/lib/email/resend/webhooks/actions.ts
export async function onEmailBounced(event: ResendWebhookEvent) {
  await db.user.update({
    where: { email: event.data.to[0] },
    data: { emailValid: false },
  });
}
```

Record a delivery:

```ts
export async function onEmailDelivered(event: ResendWebhookEvent) {
  await db.emailLog.update({
    where: { resendId: event.data.email_id },
    data: { status: "delivered" },
  });
}
```