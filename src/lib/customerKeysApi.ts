import {
  defaultPlanValue,
  parsePlanValue,
  planValueToKvJson,
  type PlanValue,
} from "./planFormTypes";

export const CUSTOMER_KEYS_URL = "/api/customers/keys";

/**
 * Erlaubte Status-Werte. Wir akzeptieren defensiv auch andere Strings beim
 * Lesen (Legacy-/Custom-Werte), bieten aber im Form-Dropdown nur diese hier.
 */
export const CUSTOMER_KEY_STATUSES = [
  "granted",
  "pending",
  "revoked",
  "expired",
] as const;
export type CustomerKeyStatus = (typeof CUSTOMER_KEY_STATUSES)[number];

export type CustomerKeyCustomer = {
  email: string;
  /** Stripe-Customer-ID, optional. */
  stripe_customer_id: string | null;
  /** Stripe-Subscription-ID oder z. B. `one_time_purchase`. */
  stripe_subscription_id: string;
};

export type CustomerKeyValue = {
  status: string;
  customer: CustomerKeyCustomer;
  metadata: { created_at: string };
  plan_id: string;
  plan: PlanValue;
};

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
};

export type CustomerKeysListResponse = {
  keys: CustomerKeySummary[];
};

export type CustomerKeyOneResponse = {
  key: string;
  value: unknown;
  raw: string;
};

export type CustomerKeyEmailMap = {
  map: Record<string, string>;
};

export function customerKeyUrlOne(key: string): string {
  return `${CUSTOMER_KEYS_URL}?key=${encodeURIComponent(key)}`;
}

export const CUSTOMER_KEYS_EMAIL_MAP_URL = `${CUSTOMER_KEYS_URL}?map=email`;

function asStr(v: unknown, d: string): string {
  return typeof v === "string" ? v : d;
}

/**
 * Initialwert für einen frischen Kunden-Key. `plan_id` per Default
 * `plan_test`, damit es offensichtlich austauschbar ist.
 */
export function defaultCustomerKeyValue(): CustomerKeyValue {
  return {
    status: "granted",
    customer: {
      email: "",
      stripe_customer_id: null,
      stripe_subscription_id: "one_time_purchase",
    },
    metadata: { created_at: new Date().toISOString() },
    plan_id: "plan_test",
    plan: defaultPlanValue("plan_test"),
  };
}

/**
 * Parst den im KV gespeicherten Kunden-Key in das Form-Modell. Falls die
 * eingebettete `plan` ungültig oder leer ist, fallen wir mit `parsePlanValue`
 * + Defaults sauber zurück.
 */
export function parseCustomerKeyValue(
  input: unknown,
):
  | { ok: true; value: CustomerKeyValue }
  | { ok: false; error: string } {
  let base: Record<string, unknown>;
  if (input == null) return { ok: true, value: defaultCustomerKeyValue() };
  if (typeof input === "string") {
    try {
      base = JSON.parse(input) as Record<string, unknown>;
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "JSON" };
    }
  } else if (typeof input === "object" && !Array.isArray(input)) {
    base = { ...(input as Record<string, unknown>) };
  } else {
    return { ok: false, error: "Ungültiger Kunden-Key-Wert" };
  }

  const customer =
    (base.customer as Record<string, unknown> | null | undefined) ?? {};
  const metadata =
    (base.metadata as Record<string, unknown> | null | undefined) ?? {};
  const planRaw = base.plan;
  const plan_id = asStr(base.plan_id, "plan_test");

  const planParsed = parsePlanValue(planRaw, plan_id);
  if (!planParsed.ok) {
    return { ok: false, error: planParsed.error };
  }

  return {
    ok: true,
    value: {
      status: asStr(base.status, "granted"),
      customer: {
        email: asStr(customer.email, ""),
        stripe_customer_id:
          typeof customer.stripe_customer_id === "string"
            ? (customer.stripe_customer_id as string)
            : null,
        stripe_subscription_id: asStr(
          customer.stripe_subscription_id,
          "one_time_purchase",
        ),
      },
      metadata: {
        created_at: asStr(metadata.created_at, new Date().toISOString()),
      },
      plan_id,
      plan: planParsed.value,
    },
  };
}

/**
 * Serialisiert einen `CustomerKeyValue` in die Form, in der er im KV liegt.
 * Behält die Reihenfolge der Felder (status, customer, metadata, plan_id, plan).
 */
export function customerKeyValueToKv(
  v: CustomerKeyValue,
): Record<string, unknown> {
  return {
    status: v.status,
    customer: {
      email: v.customer.email,
      stripe_customer_id: v.customer.stripe_customer_id,
      stripe_subscription_id: v.customer.stripe_subscription_id,
    },
    metadata: { created_at: v.metadata.created_at },
    plan_id: v.plan_id,
    plan: planValueToKvJson(v.plan),
  };
}

export async function putCustomerKey(
  key: string,
  value: CustomerKeyValue,
): Promise<void> {
  const res = await fetch(CUSTOMER_KEYS_URL, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ key, value: customerKeyValueToKv(value) }),
  });
  const j = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
}

/**
 * Verkürzt einen Kunden-Key für Anzeige (Sidebar, Chips). `VI-…ab12`.
 */
export function shortKey(id: string): string {
  if (id.length <= 22) return id;
  return `${id.slice(0, 8)}…${id.slice(-6)}`;
}
