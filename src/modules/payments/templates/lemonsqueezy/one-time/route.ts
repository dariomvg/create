/**
 * app/api/webhooks/lemonsqueezy/route.ts
 * ---------------------------------------------------------------------------
 * Receives Lemon Squeezy webhook events. Register this URL
 * (https://yourapp.com/api/webhooks/lemonsqueezy) in your Lemon Squeezy
 * dashboard under Settings > Webhooks, subscribed to at least:
 *   - order_created
 *   - order_refunded
 *
 * IMPORTANT: signature verification requires the *raw* request body, so we
 * read it as text before parsing — never use `request.json()` here directly.
 * ---------------------------------------------------------------------------
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature, parseWebhookPayload } from "@/lib/payments/lemonsqueezy/one-time/service";

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
    console.error("[lemonsqueezy webhook] Signature verification failed to run:", error);
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
      case "order_created": {
        // A one-time payment was completed. `payload.data.id` is the Order id.
        // If you generated your own reference id and sent it as
        // `customData` when creating the checkout, it arrives here as
        // `payload.meta.custom_data`. This is the place to persist the
        // (reference -> order id) mapping if your app needs to resolve
        // status by that reference later (see SETUP.md).
        console.log("[lemonsqueezy webhook] order_created", payload.data.id);
        break;
      }
      case "order_refunded": {
        console.log("[lemonsqueezy webhook] order_refunded", payload.data.id);
        break;
      }
      default: {
        console.log("[lemonsqueezy webhook] Unhandled event:", payload.meta.event_name);
      }
    }
  } catch (error) {
    console.error("[lemonsqueezy webhook] Handler error:", error);
    return NextResponse.json({ error: "Webhook handler failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
