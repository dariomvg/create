// Stripe webhook endpoint.
// Kept intentionally thin: signature verification and event handling
// both live in lib/stripe/service.ts (via actions.ts). This file's only
// job is to adapt the raw Next.js request into what that function needs.

import { handleStripeWebhook } from "@/lib/payments/stripe/one-time/actions";
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

  const result = await handleStripeWebhook(rawBody, signature);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result.data, { status: 200 });
}
