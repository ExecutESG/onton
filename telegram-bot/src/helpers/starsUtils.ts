function isValidUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
}

/**
 * Safely parse invoice_payload which could be:
 * 1) A plain UUID string (e.g. "550e8400-e29b-41d4-a716-446655440000")
 * 2) A JSON string (e.g. '{"order_uuid":"..."}' or '{"order_id":"..."}')
 */
export function parseInvoicePayload(payload: string): { orderUuid: string | null } {
  if (!payload || typeof payload !== "string") {
    return { orderUuid: null };
  }
  const trimmed = payload.trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      const uuid = parsed.order_uuid || parsed.order_id || parsed.orderId || parsed.uuid;
      if (typeof uuid === "string" && isValidUuid(uuid)) {
        return { orderUuid: uuid };
      }
    } catch {
      // not valid JSON, fall through
    }
  }
  if (isValidUuid(trimmed)) {
    return { orderUuid: trimmed };
  }
  return { orderUuid: null };
}

/**
 * Calculate expected Telegram Stars based on price and currency.
 */
export function calculateExpectedStars(totalPrice: number, tokenSymbol?: string | null): number {
  const symbol = (tokenSymbol || "USDT").toUpperCase();
  if (symbol === "STAR" || symbol === "STARS") {
    return Math.max(1, Math.round(totalPrice));
  }
  if (symbol === "TON") {
    return Math.max(1, Math.round(totalPrice * 150));
  }
  // Default USDT / fiat peg: ~50 Stars per USDT
  return Math.max(1, Math.round(totalPrice * 50));
}
