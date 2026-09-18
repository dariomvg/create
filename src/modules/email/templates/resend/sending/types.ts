// Shared types for the Resend email module

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

// Fields shared by every email, regardless of body type
export interface BaseEmailParams {
  to: string | string[];
  subject: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  attachments?: EmailAttachment[];
}

export interface SendPlainTextEmailParams extends BaseEmailParams {
  text: string;
}

export interface SendHtmlEmailParams extends BaseEmailParams {
  html: string;
}

export type SendEmailResult =
  | { success: true; id: string }
  | { success: false; error: string };
