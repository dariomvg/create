"use server";

// Public API of the email module. Import these functions from server
// components or other server actions to send emails.

import { sendHtmlEmailInternal, sendPlainTextEmailInternal } from "./service";
import type {
  SendHtmlEmailParams,
  SendPlainTextEmailParams,
  SendEmailResult,
} from "./types";

// Sends a plain text email (no HTML formatting)
export async function sendPlainTextEmail(
  params: SendPlainTextEmailParams
): Promise<SendEmailResult> {
  return sendPlainTextEmailInternal(params);
}

// Sends an HTML email
export async function sendHtmlEmail(
  params: SendHtmlEmailParams
): Promise<SendEmailResult> {
  return sendHtmlEmailInternal(params);
}
