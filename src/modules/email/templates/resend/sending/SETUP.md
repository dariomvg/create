# Resend Email Module

A minimal email-sending module for Next.js App Router, built on top of [Resend](https://resend.com).

## Dependencies

- `resend`

## Files

| File | Purpose |
|---|---|
| `types.ts` | Shared types for email params and results |
| `service.ts` | Internal logic — Resend client and low-level send functions. Do not import this directly. |
| `actions.ts` | Public API — `"use server"` functions to import from your app |
| `.env.local` | Environment variables |

## Environment variables

```
RESEND_API_KEY=
EMAIL_FROM=
```

- `RESEND_API_KEY`: found in your Resend dashboard under API Keys.
- `EMAIL_FROM`: the default sender address (e.g. `Acme <onboarding@yourdomain.com>`). The domain must be a [verified domain](https://resend.com/docs/dashboard/domains/introduction) in your Resend account.

## Usage

Import the functions you need from `actions.ts` in any server component or server action.

### Plain text email

```ts
import { sendPlainTextEmail } from "@/lib/email/actions";

const result = await sendPlainTextEmail({
  to: "user@example.com",
  subject: "Welcome!",
  text: "Thanks for signing up.",
});
```

### HTML email

```ts
import { sendHtmlEmail } from "@/lib/email/actions";

const result = await sendHtmlEmail({
  to: "user@example.com",
  subject: "Welcome!",
  html: "<p>Thanks for signing up.</p>",
});
```

### Common parameters

Both functions accept the same additional parameters:

```ts
await sendHtmlEmail({
  to: ["user1@example.com", "user2@example.com"],
  subject: "Update",
  html: "<p>Hello</p>",
  cc: "manager@example.com",
  bcc: ["archive@example.com"],
  replyTo: "support@example.com",
  attachments: [
    { filename: "invoice.pdf", content: pdfBuffer, contentType: "application/pdf" },
  ],
});
```

### Result shape

Both functions return the same result type:

```ts
type SendEmailResult =
  | { success: true; id: string }
  | { success: false; error: string };
```

Check `result.success` before assuming the email was sent.
