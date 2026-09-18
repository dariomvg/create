// Shared types for the transactional email module

export type SendEmailResult =
  | { success: true; id: string }
  | { success: false; error: string };

interface BaseParams {
  to: string | string[];
}

export interface VerificationEmailParams extends BaseParams {
  verificationUrl: string;
  userName?: string;
}

export interface PasswordResetEmailParams extends BaseParams {
  resetUrl: string;
  expiresInMinutes?: number;
}

export interface WelcomeEmailParams extends BaseParams {
  userName: string;
}

export interface InvitationEmailParams extends BaseParams {
  inviterName: string;
  organizationName: string;
  invitationUrl: string;
}

export interface PaymentConfirmationEmailParams extends BaseParams {
  amount: number;
  currency: string;
  paymentDate: string;
  invoiceUrl?: string;
}

export interface SubscriptionConfirmationEmailParams extends BaseParams {
  planName: string;
  renewalDate: string;
}

export interface InvoiceEmailParams extends BaseParams {
  invoiceNumber: string;
  amount: number;
  currency: string;
  invoiceUrl: string;
}

export interface NotificationEmailParams extends BaseParams {
  title: string;
  message: string;
  actionUrl?: string;
}
