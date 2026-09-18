/**
 * Mercado Pago service layer.
 *
 * Contains all direct interaction with the Mercado Pago SDK. This file runs
 * server-side only and relies on the secret access token — never import it
 * from client components.
 *
 * Consumers should go through `actions.ts` (server) or `client.ts` (client)
 * instead of importing this file directly.
 */

import { MercadoPagoConfig, Preference, Payment, PaymentRefund, PaymentMethod } from "mercadopago";
import crypto from "crypto";
import type {
  CreatePreferenceInput,
  MPPreferenceResult,
  MPPayment,
  PaymentStatusResult,
  RefundResult,
  PaymentMethodInfo,
  MPResult,
} from "./types";

// ---------------------------------------------------------------------------
// SDK client initialization
// ---------------------------------------------------------------------------

if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
  throw new Error("Missing MERCADOPAGO_ACCESS_TOKEN environment variable.");
}

const mpConfig = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN,
});

const preferenceClient = new Preference(mpConfig);
const paymentClient = new Payment(mpConfig);
const refundClient = new PaymentRefund(mpConfig);
const paymentMethodClient = new PaymentMethod(mpConfig);

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Wraps a Mercado Pago SDK call, normalizing thrown errors into an MPResult. */
async function safeCall<T>(fn: () => Promise<T>): Promise<MPResult<T>> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (err: any) {
    // Mercado Pago SDK errors usually carry a `cause` array with the real detail.
    const message =
      err?.cause?.[0]?.description ||
      err?.message ||
      "Unexpected Mercado Pago error.";
    return { success: false, error: message, code: err?.status?.toString() };
  }
}

/** Maps a raw Mercado Pago payment object into our narrowed MPPayment shape. */
function mapPayment(raw: any): MPPayment {
  return {
    id: raw.id,
    status: raw.status,
    statusDetail: raw.status_detail,
    transactionAmount: raw.transaction_amount,
    currencyId: raw.currency_id,
    dateCreated: raw.date_created,
    dateApproved: raw.date_approved ?? null,
    externalReference: raw.external_reference ?? null,
    metadata: raw.metadata ?? {},
    payerEmail: raw.payer?.email ?? null,
  };
}

// ---------------------------------------------------------------------------
// Checkout Pro (Preference)
// ---------------------------------------------------------------------------

/** Creates a checkout preference and returns its redirect URLs. */
export async function createPreference(
  input: CreatePreferenceInput
): Promise<MPResult<MPPreferenceResult>> {
  return safeCall(async () => {
    const response = await preferenceClient.create({
      body: {
        items: input.items,
        back_urls: {
          success: input.backUrls.success,
          failure: input.backUrls.failure,
          pending: input.backUrls.pending,
        },
        auto_return: input.autoReturn ?? "approved",
        external_reference: input.externalReference,
        metadata: input.metadata,
      },
    });

    return {
      id: response.id!,
      initPoint: response.init_point!,
      sandboxInitPoint: response.sandbox_init_point!,
    };
  });
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

/** Fetches a payment by id. */
export async function getPayment(paymentId: string | number): Promise<MPResult<MPPayment>> {
  return safeCall(async () => {
    const raw = await paymentClient.get({ id: paymentId });
    return mapPayment(raw);
  });
}

/** Returns a simplified status snapshot for a payment. */
export async function getPaymentStatus(
  paymentId: string | number
): Promise<MPResult<PaymentStatusResult>> {
  return safeCall(async () => {
    const raw = await paymentClient.get({ id: paymentId });
    return {
      id: raw.id!,
      status: raw.status as PaymentStatusResult["status"],
      statusDetail: raw.status_detail!,
    };
  });
}

/**
 * Cancels a payment.
 * Mercado Pago only allows cancellation while the payment is "pending" or
 * "in_process" — an already "approved" payment must be refunded instead of
 * cancelled.
 */
export async function cancelPayment(paymentId: string | number): Promise<MPResult<MPPayment>> {
  return safeCall(async () => {
    const raw = await paymentClient.update({
      id: paymentId,
      body: { status: "cancelled" },
    });
    return mapPayment(raw);
  });
}

// ---------------------------------------------------------------------------
// Refunds
// ---------------------------------------------------------------------------

/**
 * Refunds a payment.
 * Pass `amount` for a partial refund; omit it for a full refund.
 */
export async function refundPayment(
  paymentId: string | number,
  amount?: number
): Promise<MPResult<RefundResult>> {
  return safeCall(async () => {
    const raw = await refundClient.create({
      payment_id: Number(paymentId),
      body: amount !== undefined ? { amount } : {},
    });

    return {
      id: raw.id!,
      paymentId: Number(paymentId),
      amount: raw.amount!,
      status: raw.status!,
      dateCreated: raw.date_created!,
    };
  });
}

// ---------------------------------------------------------------------------
// Payment methods
// ---------------------------------------------------------------------------

/** Lists the payment methods available/enabled for this Mercado Pago account. */
export async function getPaymentMethods(): Promise<MPResult<PaymentMethodInfo[]>> {
  return safeCall(async () => {
    const raw = await paymentMethodClient.get();
    return (raw as any[]).map((pm) => ({
      id: pm.id,
      name: pm.name,
      paymentTypeId: pm.payment_type_id,
      status: pm.status,
      thumbnail: pm.thumbnail,
    }));
  });
}

// ---------------------------------------------------------------------------
// Webhook signature verification
// ---------------------------------------------------------------------------

/**
 * Verifies the `x-signature` header Mercado Pago sends with webhook notifications.
 *
 * Mercado Pago builds the signature as an HMAC-SHA256 over a manifest string:
 *   "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
 * using your webhook secret, sent as "ts=<ts>,v1=<hash>" in the x-signature header.
 * The data.id must be lowercased before building the manifest.
 *
 * Docs: https://www.mercadopago.com/developers/en/docs/checkout-api/webhooks
 */
export function verifyWebhookSignature(params: {
  xSignature: string;
  xRequestId: string;
  dataId: string;
}): boolean {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("Missing MERCADOPAGO_WEBHOOK_SECRET environment variable.");
  }

  const parts = Object.fromEntries(
    params.xSignature.split(",").map((part) => {
      const [key, value] = part.split("=");
      return [key?.trim(), value?.trim()];
    })
  );

  const ts = parts.ts;
  const hash = parts.v1;
  if (!ts || !hash) return false;

  const manifest = `id:${params.dataId.toLowerCase()};request-id:${params.xRequestId};ts:${ts};`;
  const computedHash = crypto.createHmac("sha256", secret).update(manifest).digest("hex");

  const hashBuffer = Buffer.from(hash, "hex");
  const computedBuffer = Buffer.from(computedHash, "hex");

  if (hashBuffer.length !== computedBuffer.length) return false;
  return crypto.timingSafeEqual(hashBuffer, computedBuffer);
}
