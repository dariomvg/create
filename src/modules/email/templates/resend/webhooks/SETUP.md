# Resend Webhooks Module

Handles Resend webhook events for Next.js App Router. Independent from the other email modules.

## Dependencies

- `svix` (used to verify the webhook signature — this is what Resend itself uses to sign webhook payloads)

## Files

| File | Purpose |
|---|---|
| `types.ts` | Event type and payload shape |
| `service.ts` | Internal logic — verifies and parses the incoming payload. Do not import this directly. |
| `actions.ts` | One handler function per event — edit these to add your own logic |
| `route.ts` | Thin entry point — verifies the signature and dispatches to `actions.ts`. Place at `app/api/webhooks/resend/route.ts` |
| `.env.local` | Environment variables |

## Architecture

`route.ts` never contains business logic — it only verifies the request and calls the matching function in `actions.ts`. This keeps event handling editable in one place (`actions.ts`) without touching signature verification.

```
Resend → route.ts (verify + dispatch) → actions.ts (your logic per event)
```

## Environment variables

```
RESEND_WEBHOOK_SECRET=
```

## Configuration (dashboard steps)

1. In the Resend dashboard, go to **Webhooks** → **Add Webhook**.
2. Set the endpoint URL to `https://yourdomain.com/api/webhooks/resend`.
3. Select the events: `email.sent`, `email.delivered`, `email.bounced`, `email.failed`, `email.opened`, `email.clicked`.
4. Copy the **Signing Secret** into `RESEND_WEBHOOK_SECRET`.

## Usage

Edit the handler for the event you care about in `actions.ts`:

```ts
export async function onEmailBounced(event: ResendWebhookEvent) {
  // e.g. mark the recipient's address as invalid in your database
  await db.user.update({
    where: { email: event.data.to[0] },
    data: { emailValid: false },
  });
}
```

No other file needs to change — `route.ts` will call it automatically when the matching event arrives.
