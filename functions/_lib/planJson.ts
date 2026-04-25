const STRIPE_PRICE_RE = /^price_[a-zA-Z0-9]+$/;

export function isValidStripePriceId(s: string): boolean {
  return STRIPE_PRICE_RE.test(s.trim());
}

/**
 * Liest die Stripe-Preis-ID aus dem Plan-JSON (KV), die für den Payment Link genutzt wird.
 * Erwartet ein Feld, das du in Stripe angelegt hast, z. B. in die Plan-Konfiguration:
 *   "stripe_price_id": "price_…"
 * Alternativen: `stripePriceId`, `billing.stripe_price_id`
 */
export function extractStripePriceIdFromPlanJson(
  value: unknown,
): string | null {
  if (value == null || typeof value !== "object") return null;
  const o = value as Record<string, unknown>;
  const tryStr = (s: unknown): string | null => {
    if (typeof s !== "string" || !s.trim()) return null;
    const t = s.trim();
    return STRIPE_PRICE_RE.test(t) ? t : null;
  };
  const a = tryStr(o.stripe_price_id);
  if (a) return a;
  const b = tryStr(o.stripePriceId);
  if (b) return b;
  const bill = o.billing;
  if (bill && typeof bill === "object") {
    const c = tryStr(
      (bill as Record<string, unknown>).stripe_price_id,
    );
    if (c) return c;
  }
  return null;
}
