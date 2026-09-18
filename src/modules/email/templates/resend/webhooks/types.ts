// Shared types for the Resend webhooks module

export type ResendEventType =
  | "email.sent"
  | "email.delivered"
  | "email.bounced"
  | "email.failed"
  | "email.opened"
  | "email.clicked";

export interface ResendWebhookEvent {
  type: ResendEventType;
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    [key: string]: unknown;
  };
}
