import { stripeSetPaymentLinkActive } from "../../_lib/stripeClient";
import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";

type Body = { paymentLinkId?: string; active?: boolean };

/**
 * POST /api/billing/payment-link-archive
 * Setzt `active` am Payment Link: `false` = archivieren (deaktivieren), `true` = wieder aktivieren.
 * Stripe löscht Payment Links nicht – es gibt nur aktiv/inaktiv.
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
      { error: "paymentLinkId muss plink_… sein" },
      { status: 400 },
    );
  }
  if (typeof body.active !== "boolean") {
    return jsonResponse(
      { error: "active (boolean) fehlt: false = archivieren, true = aktivieren" },
      { status: 400 },
    );
  }

  try {
    const paymentLink = await stripeSetPaymentLinkActive(env, id, body.active);
    return jsonResponse({ paymentLink }, { status: 200 });
  } catch (e) {
    return jsonResponse(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
};
