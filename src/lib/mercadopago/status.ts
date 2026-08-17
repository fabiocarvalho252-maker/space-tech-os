// Single place that translates Mercado Pago's own status vocabulary into
// this app's internal status columns — nothing else in the codebase should
// compare a raw Mercado Pago status string directly.

const PREAPPROVAL_STATUS_MAP: Record<string, string> = {
  pending: "pending",
  authorized: "active",
  paused: "suspended",
  cancelled: "canceled",
};

/** subscriptions.status from a /preapproval status. Unknown values fall
 * back to "pending" rather than throwing — a future Mercado Pago status we
 * don't recognize yet shouldn't crash the webhook, just leave the
 * subscription unresolved for manual review. */
export function mapMercadoPagoSubscriptionStatus(mpStatus: string): string {
  return PREAPPROVAL_STATUS_MAP[mpStatus] ?? "pending";
}

const PAYMENT_STATUS_MAP: Record<string, string> = {
  pending: "pending",
  in_process: "processing",
  approved: "paid",
  rejected: "failed",
  cancelled: "canceled",
  refunded: "refunded",
  charged_back: "refunded",
};

/** subscription_payments.status from a /v1/payments status (used for the
 * Pix-per-cycle path — see subscription-service.ts). */
export function mapMercadoPagoPaymentStatus(mpStatus: string): string {
  return PAYMENT_STATUS_MAP[mpStatus] ?? "pending";
}
