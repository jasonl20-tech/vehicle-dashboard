import {
  extractStripePriceIdFromPlanJson,
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

type CreateBody = { planKey?: string };

/**
 * POST /api/billing/payment-links
 * Legt einen neuen Payment Link in Stripe an; Metadaten `price_id` = `planKey`.
 * Die Stripe-Preis-ID (`price_…`) muss im Plan-JSON im KV stehen, Feld `stripe_price_id`
 * (Preis in Stripe anlegen, ID ins JSON übernehmen).
 * Body: { "planKey": "plan_test" }
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

  const stripePriceId = extractStripePriceIdFromPlanJson(parsed);
  if (!stripePriceId) {
    return jsonResponse(
      {
        error:
          "Im Plan-JSON fehlt eine gültige Stripe-Preis-ID. In Stripe den Preis anlegen, dann im KV z. B. " +
            '"stripe_price_id": "price_…" in diesen Plan eintragen.',
      },
      { status: 400 },
    );
  }

  try {
    const paymentLink = await stripeCreatePaymentLink(env, {
      stripePriceId,
      planKey,
    });
    return jsonResponse({ paymentLink }, { status: 201 });
  } catch (e) {
    return jsonResponse(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
};
