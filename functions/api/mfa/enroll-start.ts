import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";
import { buildOtpauthUri, generateTotpSecret } from "../../_lib/totp";

export const onRequestPost: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const row = await env.user
    .prepare(
      "SELECT totp_enabled FROM user WHERE id = ?1 AND active = 1 LIMIT 1",
    )
    .bind(user.id)
    .first<{ totp_enabled: number | null }>();

  if (!row) {
    return jsonResponse({ error: "Konto nicht gefunden" }, { status: 404 });
  }
  if (Number(row.totp_enabled) === 1) {
    return jsonResponse(
      { error: "Zwei‑Faktor ist aktiv. Bitte zuerst deaktivieren." },
      { status: 400 },
    );
  }

  const secret = await generateTotpSecret();
  await env.user
    .prepare(
      `UPDATE user SET totp_secret = ?1, totp_enabled = 0, totp_verified_at = NULL, totp_recovery_hashes = NULL
       WHERE id = ?2`,
    )
    .bind(secret, user.id)
    .run();

  const otpauthUri = buildOtpauthUri({
    issuer: "Vehicleimagery",
    accountLabel: user.benutzername,
    secretBase32: secret,
  });

  return jsonResponse(
    { secret, otpauthUri },
    { status: 200 },
  );
};
