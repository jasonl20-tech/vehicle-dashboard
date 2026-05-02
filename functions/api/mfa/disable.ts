import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";
import {
  hashPasswordForStorage,
  verifyStoredPassword,
} from "../../_lib/passwordHash";

export const onRequestPost: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }

  if (user.mfa.requireTotp) {
    return jsonResponse(
      {
        error:
          "2FA ist für dieses Konto Pflicht. Wende dich an einen Administrator, um die Pflicht aufzuheben.",
      },
      { status: 403 },
    );
  }

  let body: { password?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Ungültige Anfrage" }, { status: 400 });
  }
  const password =
    typeof body?.password === "string" ? body.password : "";

  if (!password) {
    return jsonResponse({ error: "Passwort erforderlich" }, { status: 400 });
  }

  const row = await env.user
    .prepare("SELECT password FROM user WHERE id = ?1 AND active = 1 LIMIT 1")
    .bind(user.id)
    .first<{ password: string | null }>();

  if (!row) {
    return jsonResponse({ error: "Passwort falsch" }, { status: 401 });
  }

  const stored = (row.password ?? "").trim();
  const pwCheck = await verifyStoredPassword(env, password, stored);
  if (!pwCheck.ok) {
    return jsonResponse({ error: "Passwort falsch" }, { status: 401 });
  }

  if (pwCheck.needsLegacyRehash) {
    try {
      const hashed = await hashPasswordForStorage(env, password);
      await env.user
        .prepare("UPDATE user SET password = ?1 WHERE id = ?2")
        .bind(hashed, user.id)
        .run();
    } catch (e) {
      console.warn("[mfa/disable] Legacy-Rehash fehlgeschlagen:", e);
    }
  }

  await env.user
    .prepare(
      `UPDATE user SET totp_secret = NULL, totp_enabled = 0, totp_verified_at = NULL
       WHERE id = ?1`,
    )
    .bind(user.id)
    .run();

  return jsonResponse({ ok: true }, { status: 200 });
};
