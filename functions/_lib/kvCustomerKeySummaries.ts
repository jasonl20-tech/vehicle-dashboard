/**
 * KV `customer_keys`: Listen + JSON-Summary (mit keys.ts geteilt).
 */

export const KV_CUSTOMER_KEYS_FETCH_BATCH = 32;

export type CustomerKeySummary = {
  key: string;
  status: string | null;
  email: string | null;
  plan_id: string | null;
  plan_name: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string | null;
  is_test_mode: boolean | null;
  is_test_key: boolean;
  expires_at: string | null;
};

function pickExpiresAtIso(
  parsed: Record<string, unknown>,
  metadata: Record<string, unknown>,
  plan: Record<string, unknown> | null | undefined,
): string | null {
  const tryParse = (v: unknown): string | null => {
    if (v == null) return null;
    if (typeof v === "string" && v.trim()) {
      const t = Date.parse(v.trim());
      if (!isNaN(t)) return new Date(t).toISOString();
    }
    if (typeof v === "number" && v > 0) {
      const ms = v < 1e12 ? v * 1000 : v;
      return new Date(ms).toISOString();
    }
    return null;
  };

  const fromFields = tryParse(parsed.expire) ?? tryParse(parsed.expires_at);
  if (fromFields) return fromFields;
  const fromMeta =
    tryParse(metadata.expire) ??
    tryParse(metadata.expires_at) ??
    tryParse((metadata as Record<string, unknown>).expired_at);
  if (fromMeta) return fromMeta;

  const created =
    typeof metadata.created_at === "string" ? metadata.created_at : null;
  const sec = plan?.expires_in_seconds;
  if (created && typeof sec === "number" && sec > 0) {
    const t0 = Date.parse(created);
    if (!isNaN(t0)) {
      return new Date(t0 + sec * 1000).toISOString();
    }
  }
  return null;
}

function isTestKeyPlanName(
  planId: string | null,
  planName: string | null,
): boolean {
  const a = (planId ?? "").toLowerCase();
  const b = (planName ?? "").toLowerCase();
  return a.includes("test") || b.includes("test");
}

export function summarize(
  key: string,
  raw: string | null,
): CustomerKeySummary | null {
  if (!raw) return null;
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {
      key,
      status: null,
      email: null,
      plan_id: null,
      plan_name: null,
      stripe_customer_id: null,
      stripe_subscription_id: null,
      created_at: null,
      is_test_mode: null,
      is_test_key: false,
      expires_at: null,
    };
  }
  const customer =
    (parsed?.customer as Record<string, unknown> | null | undefined) ?? null;
  const metadata =
    (parsed?.metadata as Record<string, unknown> | null | undefined) ?? {};
  const plan =
    (parsed?.plan as Record<string, unknown> | null | undefined) ?? null;
  const restrictions =
    (plan?.content_restrictions as Record<string, unknown> | null | undefined) ??
    null;
  const planId =
    typeof parsed?.plan_id === "string" ? (parsed.plan_id as string) : null;
  const planNameFromPlan =
    typeof plan?.plan_name === "string" ? (plan.plan_name as string) : null;
  const expiresAt = pickExpiresAtIso(
    parsed,
    metadata,
    plan ?? undefined,
  );
  const isTestKey = isTestKeyPlanName(planId, planNameFromPlan);

  return {
    key,
    status: typeof parsed?.status === "string" ? (parsed.status as string) : null,
    email:
      typeof customer?.email === "string" ? (customer.email as string) : null,
    plan_id: planId,
    plan_name: planNameFromPlan,
    stripe_customer_id:
      typeof customer?.stripe_customer_id === "string"
        ? (customer.stripe_customer_id as string)
        : null,
    stripe_subscription_id:
      typeof customer?.stripe_subscription_id === "string"
        ? (customer.stripe_subscription_id as string)
        : null,
    created_at:
      typeof metadata?.created_at === "string"
        ? (metadata.created_at as string)
        : null,
    is_test_mode:
      typeof restrictions?.is_test_mode === "boolean"
        ? (restrictions.is_test_mode as boolean)
        : null,
    is_test_key: isTestKey,
    expires_at: expiresAt,
  };
}

export async function fetchAllSummaries(
  kv: KVNamespace,
): Promise<CustomerKeySummary[]> {
  const names: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await kv.list({ prefix: "", limit: 1000, cursor });
    for (const e of page.keys) names.push(e.name);
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  const out: CustomerKeySummary[] = [];
  for (let i = 0; i < names.length; i += KV_CUSTOMER_KEYS_FETCH_BATCH) {
    const slice = names.slice(i, i + KV_CUSTOMER_KEYS_FETCH_BATCH);
    const settled = await Promise.all(
      slice.map(async (name) => {
        try {
          const raw = await kv.get(name, "text");
          return summarize(name, raw);
        } catch {
          return null;
        }
      }),
    );
    for (const s of settled) if (s) out.push(s);
  }
  return out;
}
