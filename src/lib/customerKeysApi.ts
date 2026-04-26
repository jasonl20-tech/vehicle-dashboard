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

export type CustomerKeyMetadata = {
  created_at: string;
  /** Ablauf (ISO 8601), optional — kann auch früher als `expire` am Root stand. */
  expires_at?: string;
};

export type CustomerKeyValue = {
  status: string;
  customer: CustomerKeyCustomer;
  metadata: CustomerKeyMetadata;
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
  /** `plan_id === "plan_test"`. Fehlt bei alter API-Antwort → per plan_id ableiten. */
  is_test_key?: boolean;
  /** Ablauf (ISO), falls aus Feldern oder created+TTL ermittelbar. */
  expires_at: string | null;
};

/** Test-Key: gebündelter Plan-Test-Preis. */
export const TEST_PLAN_ID = "plan_test";

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
    plan_id: TEST_PLAN_ID,
    plan: defaultPlanValue(TEST_PLAN_ID),
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
  const plan_id = asStr(base.plan_id, TEST_PLAN_ID);

  const planParsed = parsePlanValue(planRaw, plan_id);
  if (!planParsed.ok) {
    return { ok: false, error: planParsed.error };
  }

  const expiresFromMeta = asStr(metadata.expires_at as string, "").trim();
  const expiresFromMetaAlt = asStr(
    (metadata as Record<string, unknown>).expire as string,
    "",
  ).trim();
  const expiresRoot = asStr(base.expire as string, "").trim();
  const expiresRootAt = asStr(base.expires_at as string, "").trim();
  const expiresAt =
    expiresFromMeta ||
    expiresFromMetaAlt ||
    expiresRoot ||
    expiresRootAt;

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
        ...(expiresAt ? { expires_at: expiresAt } : {}),
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
  const metadata: Record<string, unknown> = {
    created_at: v.metadata.created_at,
  };
  const exp = v.metadata.expires_at?.trim();
  if (exp) metadata.expires_at = exp;

  const out: Record<string, unknown> = {
    status: v.status,
    customer: {
      email: v.customer.email,
      stripe_customer_id: v.customer.stripe_customer_id,
      stripe_subscription_id: v.customer.stripe_subscription_id,
    },
    metadata,
    plan_id: v.plan_id,
    plan: planValueToKvJson(v.plan),
  };
  // internes UI-Flag nie persistieren
  return out;
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

const KEYS_BASE = "/kunden/keys";

/** React-Router-Pfad zu einem Kunden-Key (Key ist URL-encodiert). */
export function customerKeyDetailPath(key: string): string {
  return `${KEYS_BASE}/${encodeURIComponent(key)}`;
}

/** `true` wenn `expires_at` in der Vergangenheit liegt. */
export function isExpiredIso(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false;
  const t = Date.parse(expiresAt);
  if (isNaN(t)) return false;
  return t < Date.now();
}
