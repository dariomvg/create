"use server";

// Public API of the transactional email module. Import these functions
// from server components or other server actions after the relevant event.

import {
  sendVerificationEmailInternal,
  sendPasswordResetEmailInternal,
  sendWelcomeEmailInternal,
  sendInvitationEmailInternal,
  sendPaymentConfirmationEmailInternal,
  sendSubscriptionConfirmationEmailInternal,
  sendInvoiceEmailInternal,
  sendNotificationEmailInternal,
} from "./service";
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

export async function sendVerificationEmail(
  params: VerificationEmailParams
): Promise<SendEmailResult> {
  return sendVerificationEmailInternal(params);
}

export async function sendPasswordResetEmail(
  params: PasswordResetEmailParams
): Promise<SendEmailResult> {
  return sendPasswordResetEmailInternal(params);
}

export async function sendWelcomeEmail(
  params: WelcomeEmailParams
): Promise<SendEmailResult> {
  return sendWelcomeEmailInternal(params);
}

export async function sendInvitationEmail(
  params: InvitationEmailParams
): Promise<SendEmailResult> {
  return sendInvitationEmailInternal(params);
}

export async function sendPaymentConfirmationEmail(
  params: PaymentConfirmationEmailParams
): Promise<SendEmailResult> {
  return sendPaymentConfirmationEmailInternal(params);
}

export async function sendSubscriptionConfirmationEmail(
  params: SubscriptionConfirmationEmailParams
): Promise<SendEmailResult> {
  return sendSubscriptionConfirmationEmailInternal(params);
}

export async function sendInvoiceEmail(
  params: InvoiceEmailParams
): Promise<SendEmailResult> {
  return sendInvoiceEmailInternal(params);
}

export async function sendNotificationEmail(
  params: NotificationEmailParams
): Promise<SendEmailResult> {
  return sendNotificationEmailInternal(params);
}
