import { stripeListPricesWithProduct } from "../../_lib/stripeClient";
import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";

/**
 * GET /api/billing/stripe-prices
 * Aktive Stripe-Preise (mit Produktname) für die Payment-Link-Erstellung.
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
    const prices = await stripeListPricesWithProduct(env, 100);
    return jsonResponse({ prices }, { status: 200 });
  } catch (e) {
    return jsonResponse(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
};
