import { getCurrentUser, jsonResponse, verifyPassword, type AuthEnv } from "../../_lib/auth";

export const onRequestPost: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
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

  if (!row || !verifyPassword(password, (row.password ?? "").trim())) {
    return jsonResponse({ error: "Passwort falsch" }, { status: 401 });
  }

  await env.user
    .prepare(
      `UPDATE user SET totp_secret = NULL, totp_enabled = 0, totp_verified_at = NULL, totp_recovery_hashes = NULL
       WHERE id = ?1`,
    )
    .bind(user.id)
    .run();

  return jsonResponse({ ok: true }, { status: 200 });
};
