# Email — Resend — Transactional

Event-triggered emails sent through Resend. One function per event; each builds a fixed subject and HTML body from the arguments you pass.

## Dependencies

- `resend`

## Environment variables

| Variable | Description |
|---|---|
| `RESEND_API_KEY` | Resend API key |
| `EMAIL_FROM` | Default sender address, e.g. `Acme <hello@yourdomain.com>` |

## File structure

```
@/lib/email/resend/transactional/
├── actions.ts   # public API ("use server")
├── service.ts   # internal logic (Resend client + email bodies)
└── types.ts     # params and result types
```

Other files:

| Path | Purpose |
|---|---|
| `.env.local` (project root) | `RESEND_API_KEY` and `EMAIL_FROM` |

## Public API

Import from `@/lib/email/resend/transactional/actions`. All functions are server actions, take a single params object, return `Promise<SendEmailResult>` and never throw.

| Export | Arguments (`params`) | Returns |
|---|---|---|
| `sendVerificationEmail` | `{ to, verificationUrl, userName? }` | `Promise<SendEmailResult>` |
| `sendPasswordResetEmail` | `{ to, resetUrl, expiresInMinutes? }` | `Promise<SendEmailResult>` |
| `sendWelcomeEmail` | `{ to, userName }` | `Promise<SendEmailResult>` |
| `sendInvitationEmail` | `{ to, inviterName, organizationName, invitationUrl }` | `Promise<SendEmailResult>` |
| `sendPaymentConfirmationEmail` | `{ to, amount, currency, paymentDate, invoiceUrl? }` | `Promise<SendEmailResult>` |
| `sendSubscriptionConfirmationEmail` | `{ to, planName, renewalDate }` | `Promise<SendEmailResult>` |
| `sendInvoiceEmail` | `{ to, invoiceNumber, amount, currency, invoiceUrl }` | `Promise<SendEmailResult>` |
| `sendNotificationEmail` | `{ to, title, message, actionUrl? }` | `Promise<SendEmailResult>` |

### Parameter types

| Field | Type | Notes |
|---|---|---|
| `to` | `string \| string[]` | Recipient(s). Present in every function |
| `verificationUrl`, `resetUrl`, `invitationUrl`, `invoiceUrl`, `actionUrl` | `string` | Absolute URL placed in the email's link |
| `userName`, `inviterName`, `organizationName`, `planName`, `invoiceNumber`, `title`, `message` | `string` | Text interpolated into the email |
| `expiresInMinutes` | `number` | Adds an expiry line to the password reset email |
| `amount` | `number` | Interpolated as-is next to `currency` (no formatting applied) |
| `currency` | `string` | e.g. `"USD"` |
| `paymentDate`, `renewalDate` | `string` | Pre-formatted date text, interpolated as-is |

### Subjects sent

| Function | Subject |
|---|---|
| `sendVerificationEmail` | `Verify your email address` |
| `sendPasswordResetEmail` | `Reset your password` |
| `sendWelcomeEmail` | `Welcome!` |
| `sendInvitationEmail` | `You've been invited to join <organizationName>` |
| `sendPaymentConfirmationEmail` | `Payment confirmation` |
| `sendSubscriptionConfirmationEmail` | `Subscription confirmed` |
| `sendInvoiceEmail` | `Invoice <invoiceNumber>` |
| `sendNotificationEmail` | the `title` argument |

### Return type

```ts
type SendEmailResult =
  | { success: true; id: string }
  | { success: false; error: string };
```

The sender is always `EMAIL_FROM`. Check `result.success` before assuming the email was sent.

## Configuration

1. In the [Resend dashboard](https://resend.com), create an API key (API Keys) and set it as `RESEND_API_KEY`.
2. Add and verify your sending domain (Domains) by adding the DNS records Resend shows you.
3. Set `EMAIL_FROM` to an address on that verified domain. Until a domain is verified, Resend only lets you send test emails from `onboarding@resend.dev` to your own account email.

## Examples

Verification email after sign-up:

```ts
import { sendVerificationEmail } from "@/lib/email/resend/transactional/actions";

const result = await sendVerificationEmail({
  to: "user@example.com",
  verificationUrl: `${process.env.NEXT_PUBLIC_APP_URL}/verify?token=${token}`,
  userName: "Dari",
});
```

Payment confirmation after a successful charge:

```ts
import { sendPaymentConfirmationEmail } from "@/lib/email/resend/transactional/actions";

const result = await sendPaymentConfirmationEmail({
  to: customerEmail,
  amount: 29,
  currency: "USD",
  paymentDate: "October 9, 2026",
  invoiceUrl: "https://app.com/invoices/INV-001",
});

if (!result.success) {
  console.error(result.error);
}
```

Generic notification:

```ts
import { sendNotificationEmail } from "@/lib/email/resend/transactional/actions";

await sendNotificationEmail({
  to: "user@example.com",
  title: "New comment on your post",
  message: "Someone commented on your post.",
  actionUrl: "https://app.com/posts/42",
});
```