import {
  buildSessionCookie,
  createSessionToken,
  jsonResponse,
  verifyMfaPendingToken,
  type AuthEnv,
} from "../_lib/auth";
import { tryConsumeRecoveryHash } from "../_lib/mfaRecovery";
import { totpVerify } from "../_lib/totp";

export const onRequestPost: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  let body: { mfaPendingToken?: unknown; code?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Ungültige Anfrage" }, { status: 400 });
  }

  const pending =
    typeof body?.mfaPendingToken === "string" ? body.mfaPendingToken.trim() : "";
  const codeRaw = typeof body?.code === "string" ? body.code.trim() : "";
  if (!pending || !codeRaw) {
    return jsonResponse(
      { error: "Code und Zweitschritt-Token erforderlich" },
      { status: 400 },
    );
  }

  const mfaClaims = await verifyMfaPendingToken(env, pending);
  if (!mfaClaims) {
    return jsonResponse(
      {
        error:
          "Der zweite Anmeldeschritt ist abgelaufen. Bitte erneut anmelden.",
      },
      { status: 401 },
    );
  }

  const row = await env.user
    .prepare(
      "SELECT id, active, totp_enabled, totp_secret, totp_recovery_hashes FROM user WHERE id = ?1 LIMIT 1",
    )
    .bind(mfaClaims.sub)
    .first<{
      id: number;
      active: number;
      totp_enabled: number | null;
      totp_secret: string | null;
      totp_recovery_hashes: string | null;
    }>();

  if (!row || row.active !== 1) {
    return jsonResponse({ error: "Konto nicht verfügbar" }, { status: 403 });
  }
  if (
    Number(row.totp_enabled) !== 1 ||
    !(row.totp_secret ?? "").trim().length
  ) {
    return jsonResponse({ error: "Zwei‑Faktor ist nicht aktiv" }, { status: 400 });
  }

  const secret = row.totp_secret!.trim();

  let totpOk = await totpVerify(secret, codeRaw, 1);
  let recoveryUpdate: string | null = null;

  if (!totpOk) {
    recoveryUpdate = await tryConsumeRecoveryHash(
      env,
      row.id,
      row.totp_recovery_hashes,
      codeRaw,
    );
    totpOk = recoveryUpdate !== null;
  }

  if (!totpOk) {
    return jsonResponse({ error: "Code ungültig" }, { status: 401 });
  }

  if (recoveryUpdate !== null) {
    await env.user
      .prepare("UPDATE user SET totp_recovery_hashes = ?1 WHERE id = ?2")
      .bind(recoveryUpdate, row.id)
      .run();
  }

  try {
    await env.user
      .prepare("UPDATE user SET last_login = ?1 WHERE id = ?2")
      .bind(new Date().toISOString(), row.id)
      .run();
  } catch (err) {
    console.warn("[login-totp] last_login update fehlgeschlagen:", err);
  }

  const token = await createSessionToken(env, row.id);

  return jsonResponse(
    { ok: true },
    {
      status: 200,
      headers: { "Set-Cookie": buildSessionCookie(token) },
    },
  );
};
