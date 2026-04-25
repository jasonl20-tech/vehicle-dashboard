import { stripeListPaymentLinks } from "../../_lib/stripeClient";
import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";

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
    const paymentLinks = await stripeListPaymentLinks(env, 100);
    return jsonResponse({ paymentLinks }, { status: 200 });
  } catch (e) {
    return jsonResponse(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
};
