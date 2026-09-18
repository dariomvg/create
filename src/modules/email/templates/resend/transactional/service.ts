// Internal logic for event-triggered transactional emails.
// Not meant to be imported outside this module — use actions.ts instead.

import { Resend } from "resend";
import type {
  SendEmailResult,
  VerificationEmailParams,
  PasswordResetEmailParams,
  WelcomeEmailParams,
  InvitationEmailParams,
  PaymentConfirmationEmailParams,
  SubscriptionConfirmationEmailParams,
  InvoiceEmailParams,
  NotificationEmailParams,
} from "./types";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM as string;

function toErrorResult(error: unknown): SendEmailResult {
  const message =
    error instanceof Error ? error.message : "Unknown error sending email";
  return { success: false, error: message };
}

// Shared low-level send used by every transactional email below
async function send(
  to: string | string[],
  subject: string,
  html: string
): Promise<SendEmailResult> {
  try {
    const { data, error } = await resend.emails.send({ from: FROM, to, subject, html });
    if (error) return toErrorResult(error);
    return { success: true, id: data!.id };
  } catch (error) {
    return toErrorResult(error);
  }
}

export function sendVerificationEmailInternal(params: VerificationEmailParams) {
  const greeting = params.userName ? `Hi ${params.userName},` : "Hi,";
  const html = `<p>${greeting}</p><p>Please verify your email address by clicking the link below.</p><p><a href="${params.verificationUrl}">Verify email</a></p>`;
  return send(params.to, "Verify your email address", html);
}

export function sendPasswordResetEmailInternal(params: PasswordResetEmailParams) {
  const expiry = params.expiresInMinutes
    ? `<p>This link expires in ${params.expiresInMinutes} minutes.</p>`
    : "";
  const html = `<p>We received a request to reset your password.</p><p><a href="${params.resetUrl}">Reset password</a></p>${expiry}`;
  return send(params.to, "Reset your password", html);
}

export function sendWelcomeEmailInternal(params: WelcomeEmailParams) {
  const html = `<p>Welcome, ${params.userName}!</p><p>We're glad to have you on board.</p>`;
  return send(params.to, "Welcome!", html);
}

export function sendInvitationEmailInternal(params: InvitationEmailParams) {
  const html = `<p>${params.inviterName} invited you to join ${params.organizationName}.</p><p><a href="${params.invitationUrl}">Accept invitation</a></p>`;
  return send(params.to, `You've been invited to join ${params.organizationName}`, html);
}

export function sendPaymentConfirmationEmailInternal(
  params: PaymentConfirmationEmailParams
) {
  const invoiceLink = params.invoiceUrl
    ? `<p><a href="${params.invoiceUrl}">View invoice</a></p>`
    : "";
  const html = `<p>We've received your payment of ${params.amount} ${params.currency} on ${params.paymentDate}.</p>${invoiceLink}`;
  return send(params.to, "Payment confirmation", html);
}

export function sendSubscriptionConfirmationEmailInternal(
  params: SubscriptionConfirmationEmailParams
) {
  const html = `<p>Your subscription to the ${params.planName} plan is confirmed.</p><p>It will renew on ${params.renewalDate}.</p>`;
  return send(params.to, "Subscription confirmed", html);
}

export function sendInvoiceEmailInternal(params: InvoiceEmailParams) {
  const html = `<p>Invoice ${params.invoiceNumber} for ${params.amount} ${params.currency} is ready.</p><p><a href="${params.invoiceUrl}">View invoice</a></p>`;
  return send(params.to, `Invoice ${params.invoiceNumber}`, html);
}

export function sendNotificationEmailInternal(params: NotificationEmailParams) {
  const action = params.actionUrl
    ? `<p><a href="${params.actionUrl}">View details</a></p>`
    : "";
  const html = `<p>${params.message}</p>${action}`;
  return send(params.to, params.title, html);
}
