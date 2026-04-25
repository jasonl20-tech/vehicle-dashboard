import {
  extractStripePriceIdFromPlanJson,
  isValidStripePriceId,
} from "../../_lib/planJson";
import {
  stripeCreatePaymentLink,
  stripeListPaymentLinks,
} from "../../_lib/stripeClient";
import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";

const PLAN_KEY_RE = /^[a-zA-Z0-9_.-]{1,200}$/;

/**
 * GET /api/billing/payment-links
 * Listet Stripe Payment Links (Metadaten inkl. price_id → KV-Plan-Key).
 */
export const onRequestGet: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }
  if (!env.STRIPE_SECRET_KEY?.trim()) {
    return jsonResponse(
      { error: "STRIPE_SECRET_KEY ist nicht gesetzt" },
      { status: 503 },
    );
  }
  try {
    const all = await stripeListPaymentLinks(env, 100);
    const paymentLinks = all.filter((p) => p.active);
    return jsonResponse({ paymentLinks }, { status: 200 });
  } catch (e) {
    return jsonResponse(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
};

type CreateBody = { planKey?: string; stripePriceId?: string };

/**
 * POST /api/billing/payment-links
 * Legt einen neuen Payment Link in Stripe an; Metadaten `price_id` = `planKey`.
 * Preis: entweder `stripePriceId` (z. B. aus API-Auswahl) oder im Plan-JSON `stripe_price_id`.
 * Wird `stripePriceId` mitgeschickt, wird sie zusätzlich im Plan-KV gespeichert.
 */
export const onRequestPost: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }
  if (!env.STRIPE_SECRET_KEY?.trim()) {
    return jsonResponse(
      { error: "STRIPE_SECRET_KEY ist nicht gesetzt" },
      { status: 503 },
    );
  }
  if (!env.plans) {
    return jsonResponse(
      {
        error:
          "KV-Binding `plans` fehlt – ohne Plan-Speicher kann kein Payment Link verknüpft werden.",
      },
      { status: 503 },
    );
  }

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return jsonResponse({ error: "Ungültige JSON-Anfrage" }, { status: 400 });
  }

  const planKey =
    typeof body.planKey === "string" ? body.planKey.trim() : "";
  const fromBody =
    typeof body.stripePriceId === "string" ? body.stripePriceId.trim() : "";

  if (!planKey || !PLAN_KEY_RE.test(planKey)) {
    return jsonResponse(
      { error: "planKey fehlt oder ist ungültig" },
      { status: 400 },
    );
  }

  const raw = await env.plans.get(planKey, "text");
  if (raw == null) {
    return jsonResponse(
      {
        error: `Kein Plan im KV unter „${planKey}“ – zuerst anlegen oder anderen Key wählen.`,
      },
      { status: 400 },
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return jsonResponse(
      { error: "Plan-JSON im KV ist ungültig" },
      { status: 400 },
    );
  }

  let stripePriceId: string | null = null;
  if (fromBody) {
    if (!isValidStripePriceId(fromBody)) {
      return jsonResponse(
        { error: "stripePriceId muss eine gültige Stripe-Preis-ID sein (price_…)" },
        { status: 400 },
      );
    }
    stripePriceId = fromBody;
  } else {
    stripePriceId = extractStripePriceIdFromPlanJson(parsed);
  }

  if (!stripePriceId) {
    return jsonResponse(
      {
        error:
          "Kein Preis gewählt: wähle einen Stripe-Preis in der Oberfläche oder trage im Plan-JSON " +
            '"stripe_price_id": "price_…" ein.',
      },
      { status: 400 },
    );
  }

  try {
    const paymentLink = await stripeCreatePaymentLink(env, {
      stripePriceId,
      planKey,
    });

    if (
      fromBody &&
      isValidStripePriceId(fromBody) &&
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
    ) {
      const next = { ...(parsed as Record<string, unknown>) };
      next.stripe_price_id = fromBody;
      await env.plans.put(planKey, JSON.stringify(next));
    }

    return jsonResponse({ paymentLink }, { status: 201 });
  } catch (e) {
    return jsonResponse(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
};
