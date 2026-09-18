// Webhook entry point. Only verifies the signature and dispatches the
// event to the matching handler in actions.ts — no business logic here.
// Place this file at: app/api/webhooks/resend/route.ts

import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookEvent } from "@/lib/email/resend/webhooks/service";
import {
  onEmailSent,
  onEmailDelivered,
  onEmailBounced,
  onEmailFailed,
  onEmailOpened,
  onEmailClicked,
} from "@/lib/email/resend/webhooks/actions";
import type { ResendEventType, ResendWebhookEvent } from "@/lib/email/resend/webhooks/types";

const handlers: Record<
  ResendEventType,
  (event: ResendWebhookEvent) => Promise<void>
> = {
  "email.sent": onEmailSent,
  "email.delivered": onEmailDelivered,
  "email.bounced": onEmailBounced,
  "email.failed": onEmailFailed,
  "email.opened": onEmailOpened,
  "email.clicked": onEmailClicked,
};

export async function POST(request: NextRequest) {
  const payload = await request.text();
  const headers = {
    "svix-id": request.headers.get("svix-id") ?? "",
    "svix-timestamp": request.headers.get("svix-timestamp") ?? "",
    "svix-signature": request.headers.get("svix-signature") ?? "",
  };

  let event: ResendWebhookEvent;
  try {
    event = verifyWebhookEvent(payload, headers);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const handler = handlers[event.type];
  if (handler) await handler(event);

  return NextResponse.json({ received: true });
}
