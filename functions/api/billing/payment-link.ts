import { stripeUpdatePaymentLinkMetadata } from "../../_lib/stripeClient";
import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";

type Body = {
  paymentLinkId?: string;
  metadata?: Record<string, string>;
};

/**
 * POST /api/billing/payment-link
 * Body: { "paymentLinkId": "plink_…", "metadata": { "price_id": "plan_test", … } }
 * Merged mit bestehenden Metadaten am Payment Link.
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

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return jsonResponse({ error: "Ungültige JSON-Anfrage" }, { status: 400 });
  }

  const id =
    typeof body.paymentLinkId === "string" ? body.paymentLinkId.trim() : "";
  if (!id || !id.startsWith("plink_")) {
    return jsonResponse(
      { error: "paymentLinkId muss eine Stripe Payment-Link-ID sein (plink_…)" },
      { status: 400 },
    );
  }
  if (!body.metadata || typeof body.metadata !== "object") {
    return jsonResponse({ error: "metadata (Objekt) fehlt" }, { status: 400 });
  }

  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries(body.metadata)) {
    if (typeof v === "string") flat[k] = v;
  }

  try {
    const paymentLink = await stripeUpdatePaymentLinkMetadata(env, id, flat);
    return jsonResponse({ paymentLink }, { status: 200 });
  } catch (e) {
    return jsonResponse(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
};
