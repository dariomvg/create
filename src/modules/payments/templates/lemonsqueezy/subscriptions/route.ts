/**
 * app/api/webhooks/lemonsqueezy-subscriptions/route.ts
 * ---------------------------------------------------------------------------
 * Receives Lemon Squeezy subscription lifecycle webhook events. Register
 * this URL (https://yourapp.com/api/webhooks/lemonsqueezy-subscriptions) as
 * its own webhook in the Lemon Squeezy dashboard, subscribed to:
 *   - subscription_created
 *   - subscription_updated
 *   - subscription_cancelled
 *   - subscription_resumed
 *   - subscription_paused
 *   - subscription_unpaused
 *   - subscription_expired
 *   - subscription_plan_changed
 *
 * Payment/invoice events (subscription_payment_success/failed/recovered)
 * are intentionally NOT handled here — they belong to a billing module.
 *
 * IMPORTANT: signature verification requires the *raw* request body, so we
 * read it as text before parsing — never use `request.json()` here directly.
 * ---------------------------------------------------------------------------
 */
import { NextRequest, NextResponse } from "next/server";
import {
  verifyWebhookSignature,
  parseWebhookPayload,
} from "@/lib/payments/lemonsqueezy/subscriptions/service";

export async function POST(request: NextRequest) {
  let rawBody: string;

  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: "Unable to read request body." }, { status: 400 });
  }

  const signature = request.headers.get("x-signature");

  let signatureIsValid: boolean;
  try {
    signatureIsValid = verifyWebhookSignature(rawBody, signature);
  } catch (error) {
    console.error(
      "[lemonsqueezy-subscriptions webhook] Signature verification failed to run:",
      error
    );
    return NextResponse.json({ error: "Webhook misconfigured." }, { status: 500 });
  }

  if (!signatureIsValid) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let payload;
  try {
    payload = parseWebhookPayload(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  try {
    switch (payload.meta.event_name) {
      case "subscription_created":
      case "subscription_updated":
      case "subscription_cancelled":
      case "subscription_resumed":
      case "subscription_paused":
      case "subscription_unpaused":
      case "subscription_expired":
      case "subscription_plan_changed": {
        console.log(
          `[lemonsqueezy-subscriptions webhook] ${payload.meta.event_name}`,
          payload.data.id
        );
        // Add your own persistence/side effects here (e.g. sync subscription
        // status to your database, revoke/grant access, etc.).
        break;
      }
      default: {
        console.log(
          "[lemonsqueezy-subscriptions webhook] Unhandled event:",
          payload.meta.event_name
        );
      }
    }
  } catch (error) {
    console.error("[lemonsqueezy-subscriptions webhook] Handler error:", error);
    return NextResponse.json({ error: "Webhook handler failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
