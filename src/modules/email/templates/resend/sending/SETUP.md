# Email — Resend — Sending

Send plain text and HTML emails through Resend from Next.js server code. Both functions accept the same recipient options (multiple recipients, CC, BCC, reply-to) and attachments.

## Dependencies

- `resend`

## Environment variables

| Variable | Description |
|---|---|
| `RESEND_API_KEY` | Resend API key |
| `EMAIL_FROM` | Default sender address, e.g. `Acme <hello@yourdomain.com>` |

## File structure

```
@/lib/email/resend/sending/
├── actions.ts   # public API ("use server")
├── service.ts   # internal logic (Resend client)
└── types.ts     # params and result types
```

Other files:

| Path | Purpose |
|---|---|
| `.env.local` (project root) | `RESEND_API_KEY` and `EMAIL_FROM` |

## Public API

Import from `@/lib/email/resend/sending/actions`. Both functions are server actions and return a result object instead of throwing.

| Export | Arguments | Returns |
|---|---|---|
| `sendPlainTextEmail` | `params: SendPlainTextEmailParams` | `Promise<SendEmailResult>` |
| `sendHtmlEmail` | `params: SendHtmlEmailParams` | `Promise<SendEmailResult>` |

### Parameters

`SendPlainTextEmailParams` and `SendHtmlEmailParams` share every field except the body.

| Field | Type | Required | Notes |
|---|---|---|---|
| `to` | `string \| string[]` | yes | One or more recipients |
| `subject` | `string` | yes | |
| `text` | `string` | yes (`sendPlainTextEmail` only) | Plain text body |
| `html` | `string` | yes (`sendHtmlEmail` only) | HTML body |
| `cc` | `string \| string[]` | no | |
| `bcc` | `string \| string[]` | no | |
| `replyTo` | `string` | no | |
| `attachments` | `EmailAttachment[]` | no | |

`EmailAttachment`:

| Field | Type | Required |
|---|---|---|
| `filename` | `string` | yes |
| `content` | `Buffer \| string` | yes |
| `contentType` | `string` | no |

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

Plain text:

```ts
import { sendPlainTextEmail } from "@/lib/email/resend/sending/actions";

const result = await sendPlainTextEmail({
  to: "user@example.com",
  subject: "Welcome!",
  text: "Thanks for signing up.",
});
```

HTML with multiple recipients, CC, BCC, reply-to and an attachment:

```ts
import { sendHtmlEmail } from "@/lib/email/resend/sending/actions";

const result = await sendHtmlEmail({
  to: ["user1@example.com", "user2@example.com"],
  subject: "Monthly report",
  html: "<h1>Report</h1><p>See attached.</p>",
  cc: "manager@example.com",
  bcc: ["archive@example.com"],
  replyTo: "support@example.com",
  attachments: [
    { filename: "report.pdf", content: pdfBuffer, contentType: "application/pdf" },
  ],
});

if (!result.success) {
  console.error(result.error);
}
```