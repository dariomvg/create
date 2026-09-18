// Internal Resend logic. Not meant to be imported outside this module —
// use the functions exported from actions.ts instead.

import { Resend } from "resend";
import type {
  SendHtmlEmailParams,
  SendPlainTextEmailParams,
  SendEmailResult,
} from "./types";

// Single Resend client instance for the whole module
const resend = new Resend(process.env.RESEND_API_KEY);

// Default sender address used for every outgoing email
const FROM = process.env.EMAIL_FROM as string;

// Normalizes any thrown error into the module's result shape
function toErrorResult(error: unknown): SendEmailResult {
  const message =
    error instanceof Error ? error.message : "Unknown error sending email";
  return { success: false, error: message };
}

// Sends a plain text email through Resend
export async function sendPlainTextEmailInternal(
  params: SendPlainTextEmailParams
): Promise<SendEmailResult> {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: params.to,
      subject: params.subject,
      text: params.text,
      cc: params.cc,
      bcc: params.bcc,
      replyTo: params.replyTo,
      attachments: params.attachments,
    });

    if (error) return toErrorResult(error);
    return { success: true, id: data!.id };
  } catch (error) {
    return toErrorResult(error);
  }
}

// Sends an HTML email through Resend
export async function sendHtmlEmailInternal(
  params: SendHtmlEmailParams
): Promise<SendEmailResult> {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: params.to,
      subject: params.subject,
      html: params.html,
      cc: params.cc,
      bcc: params.bcc,
      replyTo: params.replyTo,
      attachments: params.attachments,
    });

    if (error) return toErrorResult(error);
    return { success: true, id: data!.id };
  } catch (error) {
    return toErrorResult(error);
  }
}
