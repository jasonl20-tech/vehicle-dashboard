import { useEffect, useState, useCallback, useRef } from "react";

export const BILLING_PAYMENT_LINKS = "/api/billing/payment-links";
export const BILLING_PAYMENT_LINK = "/api/billing/payment-link";
export const BILLING_PLANS = "/api/billing/plans";

export type StripePaymentLinkRow = {
  id: string;
  url: string | null;
  active: boolean;
  metadata: Record<string, string>;
  created: number;
  livemode: boolean;
};

export type PaymentLinksResponse = { paymentLinks: StripePaymentLinkRow[] };

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

export async function deletePlanKey(key: string): Promise<void> {
  const res = await fetch(
    `${BILLING_PLANS}?key=${encodeURIComponent(key)}`,
    {
      method: "DELETE",
      credentials: "include",
    },
  );
  const j = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
}
