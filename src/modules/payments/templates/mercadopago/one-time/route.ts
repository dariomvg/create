/**
 * Mercado Pago webhook route handler.
 *
 * Mercado Pago sends a POST notification here whenever a payment event
 * happens (created, updated, etc). This route validates the signature,
 * looks up the actual payment, and is where you hook in your own business
 * logic (e.g. marking an order as paid).
 *
 * Configure this URL in your Mercado Pago dashboard under
 * Integrations > Webhooks, e.g.:
 *   https://yourdomain.com/api/webhooks/mercadopago
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature, getPayment } from "@/lib/payments/mercadopago/one-time/service";
import type { WebhookNotification } from "@/lib/payments/mercadopago/one-time/types";

export async function POST(request: NextRequest) {
  const xSignature = request.headers.get("x-signature");
  const xRequestId = request.headers.get("x-request-id");

  let body: WebhookNotification;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const dataId = body?.data?.id;

  if (!xSignature || !xRequestId || !dataId) {
    return NextResponse.json({ error: "Missing signature or data.id." }, { status: 400 });
  }

  let isValid: boolean;
  try {
    isValid = verifyWebhookSignature({ xSignature, xRequestId, dataId });
  } catch (err: any) {
    // Misconfiguration (e.g. missing MERCADOPAGO_WEBHOOK_SECRET) — not the caller's fault,
    // but we still don't want to process an unverifiable notification.
    console.error("Mercado Pago webhook signature verification failed to run:", err.message);
    return NextResponse.json({ error: "Signature verification unavailable." }, { status: 500 });
  }

  if (!isValid) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  // Mercado Pago only really needs a 200 fast — do the actual processing
  // after validating, and keep this handler resilient to unknown event types.
  if (body.type === "payment") {
    const result = await getPayment(dataId);

    if (!result.success) {
      console.error("Mercado Pago webhook: failed to fetch payment", dataId, result.error);
      // Still 200 so Mercado Pago doesn't retry indefinitely for a payment
      // that may no longer exist; log for manual follow-up instead.
      return NextResponse.json({ received: true });
    }

    const payment = result.data;

    // ---------------------------------------------------------------------
    // Hook your own business logic here, e.g.:
    //
    // switch (payment.status) {
    //   case "approved":
    //     await markOrderAsPaid(payment.externalReference);
    //     break;
    //   case "refunded":
    //   case "charged_back":
    //     await markOrderAsRefunded(payment.externalReference);
    //     break;
    //   case "cancelled":
    //   case "rejected":
    //     await markOrderAsFailed(payment.externalReference);
    //     break;
    // }
    // ---------------------------------------------------------------------

    console.log(`Mercado Pago payment ${payment.id} updated to status: ${payment.status}`);
  }

  return NextResponse.json({ received: true });
}
