/**
 * Minimale Stripe-REST-Client-Hilfen (fetch, kein SDK) für Cloudflare Workers.
 * @see https://stripe.com/docs/api
 */

const API = "https://api.stripe.com/v1";

/** Erstes Line-Item (Checkout-Preis), für Tabelle & Sortierung. */
export type StripePaymentLinkFirstPrice = {
  id: string;
  unitAmount: number | null;
  currency: string;
};

export type StripePaymentLink = {
  id: string;
  object: "payment_link";
  url: string | null;
  active: boolean;
  metadata: Record<string, string>;
  created: number;
  livemode: boolean;
  /** Gesetzt, wenn List-Antwort line_items/price expandiert. */
  firstPrice?: StripePaymentLinkFirstPrice | null;
};

type StripeList<T> = { data: T[]; has_more: boolean; object: "list" };

function getSecret(env: { STRIPE_SECRET_KEY?: string }): string {
  const s = env.STRIPE_SECRET_KEY?.trim();
  if (!s) throw new Error("STRIPE_SECRET_KEY fehlt");
  return s;
}

/** Stripe-Form: `metadata[key]=value`. */
function formEncodeMetadata(meta: Record<string, string>): URLSearchParams {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(meta)) {
    p.set(`metadata[${k}]`, v);
  }
  return p;
}

function parseListWithLineItemPrices(
  j: StripeList<{
    id: string;
    object: "payment_link";
    url: string | null;
    active: boolean;
    metadata: Record<string, string> | null;
    created: number;
    livemode: boolean;
    line_items?: {
      data: Array<{
        price: string | { id: string; unit_amount: number | null; currency: string } | null;
      }>;
    };
  }>,
): StripePaymentLink[] {
  return (j.data ?? []).map((p) => {
    const li = p.line_items?.data?.[0];
    let firstPrice: StripePaymentLinkFirstPrice | null = null;
    if (li?.price) {
      if (typeof li.price === "string") {
        firstPrice = { id: li.price, unitAmount: null, currency: "" };
      } else {
        firstPrice = {
          id: li.price.id,
          unitAmount: li.price.unit_amount,
          currency: li.price.currency,
        };
      }
    }
    return {
      id: p.id,
      object: "payment_link" as const,
      url: p.url,
      active: p.active,
      metadata: p.metadata ?? {},
      created: p.created,
      livemode: p.livemode,
      firstPrice,
    };
  });
}

/**
 * Listet Payment Links, optional mit erstem Preis (Line Items) für Anzeige/Sortierung.
 * @see https://stripe.com/docs/api/payment-link/list
 */
export async function stripeListPaymentLinks(
  env: { STRIPE_SECRET_KEY?: string },
  limit = 100,
): Promise<StripePaymentLink[]> {
  const u = new URL(`${API}/payment_links`);
  u.searchParams.set("limit", String(Math.min(100, limit)));
  u.searchParams.append("expand[]", "data.line_items");
  u.searchParams.append("expand[]", "data.line_items.data.price");
  const res = await fetch(u.toString(), {
    headers: { Authorization: `Bearer ${getSecret(env)}` },
  });
  const text = await res.text();
  if (!res.ok) {
    const u2 = new URL(`${API}/payment_links`);
    u2.searchParams.set("limit", String(Math.min(100, limit)));
    const res2 = await fetch(u2.toString(), {
      headers: { Authorization: `Bearer ${getSecret(env)}` },
    });
    const text2 = await res2.text();
    if (!res2.ok) {
      throw new Error(`Stripe list payment_links ${res.status}: ${text.slice(0, 400)}`);
    }
    const j2 = JSON.parse(text2) as StripeList<{
      id: string;
      object: "payment_link";
      url: string | null;
      active: boolean;
      metadata: Record<string, string> | null;
      created: number;
      livemode: boolean;
    }>;
    return (j2.data ?? []).map((p) => ({
      id: p.id,
      object: "payment_link" as const,
      url: p.url,
      active: p.active,
      metadata: p.metadata ?? {},
      created: p.created,
      livemode: p.livemode,
      firstPrice: null,
    }));
  }
  const j = JSON.parse(text) as StripeList<{
    id: string;
    object: "payment_link";
    url: string | null;
    active: boolean;
    metadata: Record<string, string> | null;
    created: number;
    livemode: boolean;
    line_items?: {
      data: Array<{
        price: string | { id: string; unit_amount: number | null; currency: string } | null;
      }>;
    };
  }>;
  return parseListWithLineItemPrices(j);
}

export async function stripeGetPaymentLink(
  env: { STRIPE_SECRET_KEY?: string },
  id: string,
): Promise<StripePaymentLink> {
  const u = new URL(`${API}/payment_links/${encodeURIComponent(id)}`);
  u.searchParams.set("expand[]", "line_items");
  const res = await fetch(u.toString(), {
    headers: { Authorization: `Bearer ${getSecret(env)}` },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Stripe get payment_link ${res.status}: ${text.slice(0, 400)}`);
  }
  return JSON.parse(text) as StripePaymentLink;
}

/** Eintrag für Preis-Dropdown (aktive Preise, Produkt-Name per expand). */
export type StripePriceOption = {
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

/**
 * Listet aktive Preise, bei denen das zugehörige Produkt nicht archiviert ist
 * (`active: true` im Produkt, wie im Dashboard „nicht archiviert“).
 * `data.product` expand für Namen/Status. Preise mit nur `product: id`-String
 * ohne Expand werden weggelassen.
 * @see https://stripe.com/docs/api/prices/list
 */
export async function stripeListPricesWithProduct(
  env: { STRIPE_SECRET_KEY?: string },
  limit = 100,
): Promise<StripePriceOption[]> {
  const u = new URL(`${API}/prices`);
  u.searchParams.set("active", "true");
  u.searchParams.set("limit", String(Math.min(100, limit)));
  u.searchParams.append("expand[]", "data.product");
  const res = await fetch(u.toString(), {
    headers: { Authorization: `Bearer ${getSecret(env)}` },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Stripe list prices ${res.status}: ${text.slice(0, 500)}`);
  }
  const j = JSON.parse(text) as {
    data: Array<{
      id: string;
      active: boolean;
      currency: string;
      type: string;
      unit_amount: number | null;
      nickname: string | null;
      product:
        | string
        | { id: string; name: string; active?: boolean; deleted?: boolean }
        | null;
      recurring: { interval: string; interval_count: number } | null;
    }>;
  };
  const out: StripePriceOption[] = [];
  for (const p of j.data ?? []) {
    let productName: string | null = null;
    let productId: string | null = null;
    let productActive: boolean | null = null;
    if (p.product && typeof p.product === "object") {
      const prod = p.product;
      productName = prod.name ?? null;
      productId = prod.id ?? null;
      if (typeof prod.active === "boolean") productActive = prod.active;
      if (prod.deleted) productActive = false;
    } else if (typeof p.product === "string") {
      productId = p.product;
    }
    // Nur Produkte, die in Stripe nicht archiviert sind (ohne expand: nicht verifizierbar → weglassen).
    if (productActive !== true) continue;
    out.push({
      id: p.id,
      active: p.active,
      currency: p.currency,
      type: p.type,
      unitAmount: p.unit_amount,
      nickname: p.nickname,
      productName,
      productId,
      recurring: p.recurring ?? null,
    });
  }
  return out;
}

/**
 * Neuen Payment Link anlegen: ein Line Item (Stripe-Preis) + Metadaten `price_id` = KV-Plan-Key.
 * @see https://stripe.com/docs/api/payment_links/create
 */
export async function stripeCreatePaymentLink(
  env: { STRIPE_SECRET_KEY?: string },
  params: { stripePriceId: string; planKey: string },
): Promise<StripePaymentLink> {
  const p = new URLSearchParams();
  p.set("line_items[0][price]", params.stripePriceId);
  p.set("line_items[0][quantity]", "1");
  p.set("metadata[price_id]", params.planKey);

  const res = await fetch(`${API}/payment_links`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getSecret(env)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: p.toString(),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Stripe create payment_link ${res.status}: ${text.slice(0, 600)}`);
  }
  return JSON.parse(text) as StripePaymentLink;
}

/** Archivieren = in Stripe deaktivieren (`active: false`). */
export async function stripeSetPaymentLinkActive(
  env: { STRIPE_SECRET_KEY?: string },
  id: string,
  active: boolean,
): Promise<StripePaymentLink> {
  const p = new URLSearchParams();
  p.set("active", active ? "true" : "false");
  const res = await fetch(`${API}/payment_links/${encodeURIComponent(id)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getSecret(env)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: p.toString(),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Stripe set payment_link active ${res.status}: ${text.slice(0, 500)}`);
  }
  return JSON.parse(text) as StripePaymentLink;
}

export async function stripeUpdatePaymentLinkMetadata(
  env: { STRIPE_SECRET_KEY?: string },
  id: string,
  patch: Record<string, string>,
): Promise<StripePaymentLink> {
  const current = await stripeGetPaymentLink(env, id);
  const next: Record<string, string> = { ...(current.metadata || {}) };
  for (const [k, v] of Object.entries(patch)) {
    if (v === "") delete next[k];
    else next[k] = v;
  }
  const body = formEncodeMetadata(next);
  const res = await fetch(
    `${API}/payment_links/${encodeURIComponent(id)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getSecret(env)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    },
  );
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Stripe update payment_link ${res.status}: ${text.slice(0, 500)}`);
  }
  return JSON.parse(text) as StripePaymentLink;
}
