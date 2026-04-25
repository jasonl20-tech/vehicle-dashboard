/**
 * Minimale Stripe-REST-Client-Hilfen (fetch, kein SDK) für Cloudflare Workers.
 * @see https://stripe.com/docs/api
 */

const API = "https://api.stripe.com/v1";

export type StripePaymentLink = {
  id: string;
  object: "payment_link";
  url: string | null;
  active: boolean;
  metadata: Record<string, string>;
  created: number;
  livemode: boolean;
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

export async function stripeListPaymentLinks(
  env: { STRIPE_SECRET_KEY?: string },
  limit = 100,
): Promise<StripePaymentLink[]> {
  const u = new URL(`${API}/payment_links`);
  u.searchParams.set("limit", String(Math.min(100, limit)));
  const res = await fetch(u.toString(), {
    headers: { Authorization: `Bearer ${getSecret(env)}` },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Stripe list payment_links ${res.status}: ${text.slice(0, 400)}`);
  }
  const j = JSON.parse(text) as StripeList<StripePaymentLink>;
  return j.data ?? [];
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

/**
 * Setzt/merged Metadaten am Payment Link (trägt alle Werte, die in `metadata` stehen, ein;
 * leere Werte entfernen optional via Key nicht mitsenden – wir mergen zuerst mit dem aktuellen Stand).
 */
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
