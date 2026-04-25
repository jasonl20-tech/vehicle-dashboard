import { useEffect, useState, useCallback, useRef } from "react";

export const BILLING_PAYMENT_LINKS = "/api/billing/payment-links";
export const BILLING_PAYMENT_LINK = "/api/billing/payment-link";
export const BILLING_PAYMENT_LINK_ARCHIVE = "/api/billing/payment-link-archive";
export const BILLING_STRIPE_PRICES = "/api/billing/stripe-prices";
export const BILLING_PLANS = "/api/billing/plans";

export type StripePaymentLinkRow = {
  id: string;
  url: string | null;
  active: boolean;
  metadata: Record<string, string>;
  created: number;
  livemode: boolean;
  /** Erstes Line-Item, wenn die API line_items expandiert. */
  firstPrice?: {
    id: string;
    unitAmount: number | null;
    currency: string;
  } | null;
};

export type PaymentLinksResponse = { paymentLinks: StripePaymentLinkRow[] };

export type StripePriceRow = {
  id: string;
  active: boolean;
  currency: string;
  type: string;
  unitAmount: number | null;
  nickname: string | null;
  productName: string | null;
  productId: string | null;
  recurring: { interval: string; interval_count: number } | null;
};

export type StripePricesResponse = { prices: StripePriceRow[] };

export type PlansListResponse = { keys: string[] };

export type PlanOneResponse = {
  key: string;
  value: unknown;
  raw: string;
};

export function plansUrlOne(key: string) {
  return `${BILLING_PLANS}?key=${encodeURIComponent(key)}`;
}

export function useJsonApi<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);
  const aborter = useRef<AbortController | null>(null);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!url) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    aborter.current?.abort();
    const ac = new AbortController();
    aborter.current = ac;
    setLoading(true);
    setError(null);
    fetch(url, { credentials: "include", signal: ac.signal })
      .then(async (res) => {
        const json = (await res.json().catch(() => ({}))) as T & { error?: string };
        if (!res.ok) {
          throw new Error(json.error || `HTTP ${res.status}`);
        }
        setData(json as T);
      })
      .catch((err) => {
        if (ac.signal.aborted) return;
        setError(err instanceof Error ? err.message : String(err));
        setData(null);
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
  }, [url, tick]);

  return { data, error, loading, reload };
}

export async function postPaymentLinkMetadata(
  paymentLinkId: string,
  metadata: Record<string, string>,
): Promise<void> {
  const res = await fetch(BILLING_PAYMENT_LINK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ paymentLinkId, metadata }),
  });
  const j = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
}

export async function putPlan(
  key: string,
  value: unknown,
): Promise<void> {
  const res = await fetch(BILLING_PLANS, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ key, value }),
  });
  const j = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
}

/**
 * Erstellt den Payment Link in Stripe.
 * Mit `stripePriceId`: aus Stripe-API-Liste; wird im KV unter `stripe_price_id` abgelegt.
 * Ohne: es wird `stripe_price_id` aus dem Plan-JSON im KV gelesen.
 */
export async function createPaymentLink(
  planKey: string,
  stripePriceId?: string,
): Promise<void> {
  const body: { planKey: string; stripePriceId?: string } = { planKey };
  if (stripePriceId) body.stripePriceId = stripePriceId;
  const res = await fetch(BILLING_PAYMENT_LINKS, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const j = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
}

/** `active: false` = archivieren, `true` = wieder aktivieren. */
export async function setPaymentLinkActive(
  paymentLinkId: string,
  active: boolean,
): Promise<void> {
  const res = await fetch(BILLING_PAYMENT_LINK_ARCHIVE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ paymentLinkId, active }),
  });
  const j = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
}
