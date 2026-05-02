import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";
import { totpVerify } from "../../_lib/totp";

export const onRequestPost: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }

  let body: { code?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Ungültige Anfrage" }, { status: 400 });
  }
  const code =
    typeof body?.code === "string" ? body.code.replace(/\s/g, "").trim() : "";
  if (!/^\d{6}$/.test(code)) {
    return jsonResponse(
      { error: "Bitte den 6‑stelligen Code eingeben" },
      { status: 400 },
    );
  }

  const row = await env.user
    .prepare(
      "SELECT totp_secret, totp_enabled FROM user WHERE id = ?1 AND active = 1 LIMIT 1",
    )
    .bind(user.id)
    .first<{
      totp_secret: string | null;
      totp_enabled: number | null;
    }>();

  if (!row) {
    return jsonResponse({ error: "Konto nicht gefunden" }, { status: 404 });
  }
  if (Number(row.totp_enabled) === 1) {
    return jsonResponse(
      { error: "Zwei‑Faktor ist bereits aktiv" },
      { status: 400 },
    );
  }
  const secret = (row.totp_secret ?? "").trim();
  if (!secret) {
    return jsonResponse(
      {
        error: "Kein Einrichtungslauf gestartet. Bitte „Einrichten“ wählen.",
      },
      { status: 400 },
    );
  }

  if (!(await totpVerify(secret, code, 1))) {
    return jsonResponse({ error: "Code ungültig" }, { status: 401 });
  }

  await env.user
    .prepare(
      `UPDATE user SET totp_enabled = 1, totp_verified_at = ?1 WHERE id = ?2`,
    )
    .bind(new Date().toISOString(), user.id)
    .run();

  return jsonResponse({ ok: true }, { status: 200 });
};
