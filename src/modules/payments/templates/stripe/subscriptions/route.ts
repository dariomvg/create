// Stripe Subscriptions webhook endpoint.
// Separate from app/api/webhooks/stripe/route.ts (one-time payments) and
// app/api/webhooks/stripe-billing/route.ts (billing) — register this as
// its own endpoint in the Stripe Dashboard, subscribed only to
// subscription lifecycle and recurring invoice events.

import { handleStripeSubscriptionsWebhook } from "@/lib/payments/stripe/subscriptions/actions";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header." },
      { status: 400 }
    );
  }

  // Stripe requires the raw, unparsed body to verify the signature.
  const rawBody = await request.text();

  const result = await handleStripeSubscriptionsWebhook(rawBody, signature);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result.data, { status: 200 });
}
