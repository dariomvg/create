// Internal logic for the webhooks module. Not meant to be imported
// outside this module — use route.ts as the entry point.

import { Webhook } from "svix";
import type { ResendWebhookEvent } from "./types";

const WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET as string;

// Verifies the Svix signature and parses the raw payload into a typed
// event. Throws if the signature is invalid or missing.
export function verifyWebhookEvent(
  payload: string,
  headers: {
    "svix-id": string;
    "svix-timestamp": string;
    "svix-signature": string;
  }
): ResendWebhookEvent {
  const wh = new Webhook(WEBHOOK_SECRET);
  return wh.verify(payload, headers) as ResendWebhookEvent;
}
