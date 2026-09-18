// Business logic for each webhook event. Edit these functions to add
// your own behavior (update a database, notify a user, log, etc).
// Called only from route.ts (server-only), so no "use server" is needed.

import type { ResendWebhookEvent } from "./types";

export async function onEmailSent(event: ResendWebhookEvent) {
  // TODO: add your logic
}

export async function onEmailDelivered(event: ResendWebhookEvent) {
  // TODO: add your logic
}

export async function onEmailBounced(event: ResendWebhookEvent) {
  // TODO: add your logic
}

export async function onEmailFailed(event: ResendWebhookEvent) {
  // TODO: add your logic
}

export async function onEmailOpened(event: ResendWebhookEvent) {
  // TODO: add your logic
}

export async function onEmailClicked(event: ResendWebhookEvent) {
  // TODO: add your logic
}
