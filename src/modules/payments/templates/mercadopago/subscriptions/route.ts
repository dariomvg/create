/**
 * Mercado Pago subscriptions webhook route handler.
 *
 * Handles two distinct notification topics:
 *   - "preapproval": subscription lifecycle changes (authorized, paused,
 *     cancelled). `data.id` is the subscription (preapproval) id.
 *   - "subscription_authorized_payment": an individual recurring charge was
 *     scheduled/processed/recycled. `data.id` is the authorized payment id,
 *     NOT the subscription id.
 *
 * Configure this URL in your Mercado Pago dashboard under
 * Integrations > Webhooks, e.g.:
 *   https://yourdomain.com/api/webhooks/mercadopago-subscriptions
 */

import { NextRequest, NextResponse } from "next/server";
import {
  verifyWebhookSignature,
  getPreapproval,
  getAuthorizedPaymentById,
} from "@/lib/payments/mercadopago/subscriptions/service";
import type { SubscriptionWebhookNotification } from "@/lib/payments/mercadopago/subscriptions/types";

export async function POST(request: NextRequest) {
  const xSignature = request.headers.get("x-signature");
  const xRequestId = request.headers.get("x-request-id");

  let body: SubscriptionWebhookNotification;
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
    console.error("Mercado Pago subscriptions webhook signature check failed to run:", err.message);
    return NextResponse.json({ error: "Signature verification unavailable." }, { status: 500 });
  }

  if (!isValid) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  if (body.type === "subscription_preapproval" || body.type === "preapproval") {
    const result = await getPreapproval(dataId);

    if (!result.success) {
      console.error("Mercado Pago webhook: failed to fetch subscription", dataId, result.error);
      return NextResponse.json({ received: true });
    }

    const subscription = result.data;

    // -----------------------------------------------------------------
    // Hook your own business logic here, e.g.:
    //
    // switch (subscription.status) {
    //   case "authorized":
    //     await activateUserPlan(subscription.externalReference);
    //     break;
    //   case "paused":
    //     await markPlanAsPaused(subscription.externalReference);
    //     break;
    //   case "cancelled":
    //     await deactivateUserPlan(subscription.externalReference);
    //     break;
    // }
    // -----------------------------------------------------------------

    console.log(`Mercado Pago subscription ${subscription.id} updated to status: ${subscription.status}`);
  } else if (body.type === "subscription_authorized_payment") {
    const result = await getAuthorizedPaymentById(dataId);

    if (!result.success) {
      console.error("Mercado Pago webhook: failed to fetch authorized payment", dataId, result.error);
      return NextResponse.json({ received: true });
    }

    const payment = result.data;

    // -----------------------------------------------------------------
    // Hook your own business logic here, e.g.:
    //
    // if (payment.status === "processed") {
    //   await recordRenewalPayment(payment.preapprovalId, payment.transactionAmount);
    // } else if (payment.status === "recycled") {
    //   await notifyPaymentRetry(payment.preapprovalId);
    // }
    // -----------------------------------------------------------------

    console.log(
      `Mercado Pago recurring charge ${payment.id} for subscription ${payment.preapprovalId}: ${payment.status}`
    );
  }

  return NextResponse.json({ received: true });
}
