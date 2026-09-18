# Transactional Email Module

Event-triggered emails for Next.js App Router, built on top of [Resend](https://resend.com). Independent from the general-purpose email module — send whichever this app needs after each event.

## Dependencies

- `resend`

## Files

| File | Purpose |
|---|---|
| `types.ts` | Params for each transactional email |
| `service.ts` | Internal logic — Resend client and per-event send functions. Do not import this directly. |
| `actions.ts` | Public API — `"use server"` functions to import from your app |
| `.env.local` | Environment variables |

## Environment variables

```
RESEND_API_KEY=
EMAIL_FROM=
```

- `RESEND_API_KEY`: found in your Resend dashboard under API Keys.
- `EMAIL_FROM`: the default sender address. The domain must be a [verified domain](https://resend.com/docs/dashboard/domains/introduction) in your Resend account.

## Usage

Import the function for the event you need from `actions.ts`.

```ts
import { sendVerificationEmail } from "@/lib/email-transactional/actions";

await sendVerificationEmail({
  to: "user@example.com",
  verificationUrl: "https://app.com/verify?token=...",
  userName: "Dari",
});
```

### Available functions

| Function | Required params | Optional params |
|---|---|---|
| `sendVerificationEmail` | `to`, `verificationUrl` | `userName` |
| `sendPasswordResetEmail` | `to`, `resetUrl` | `expiresInMinutes` |
| `sendWelcomeEmail` | `to`, `userName` | — |
| `sendInvitationEmail` | `to`, `inviterName`, `organizationName`, `invitationUrl` | — |
| `sendPaymentConfirmationEmail` | `to`, `amount`, `currency`, `paymentDate` | `invoiceUrl` |
| `sendSubscriptionConfirmationEmail` | `to`, `planName`, `renewalDate` | — |
| `sendInvoiceEmail` | `to`, `invoiceNumber`, `amount`, `currency`, `invoiceUrl` | — |
| `sendNotificationEmail` | `to`, `title`, `message` | `actionUrl` |

### Result shape

Every function returns the same result type:

```ts
type SendEmailResult =
  | { success: true; id: string }
  | { success: false; error: string };
```

Check `result.success` before assuming the email was sent.
