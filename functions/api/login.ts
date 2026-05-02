import {
  buildSessionCookie,
  createMfaPendingToken,
  createSessionToken,
  createSetupToken,
  jsonResponse,
  verifyPassword,
  type AuthEnv,
} from "../_lib/auth";

export const onRequestPost: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  let body: { benutzername?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Ungültige Anfrage" }, { status: 400 });
  }

  const benutzername =
    typeof body?.benutzername === "string" ? body.benutzername.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!benutzername) {
    return jsonResponse(
      { error: "Bitte gib deinen Benutzernamen ein" },
      { status: 400 },
    );
  }

  const row = await env.user
    .prepare(
      "SELECT id, benutzername, password, active, totp_enabled, totp_secret FROM user WHERE benutzername = ?1 LIMIT 1",
    )
    .bind(benutzername)
    .first<{
      id: number;
      benutzername: string;
      password: string | null;
      active: number;
      totp_enabled: number | null;
      totp_secret: string | null;
    }>();

  if (!row || row.active !== 1) {
    return jsonResponse(
      { error: "Benutzername oder Passwort falsch" },
      { status: 401 },
    );
  }

  // Account existiert, hat aber noch kein Passwort gesetzt → Setup-Flow.
  // Wir geben einen kurzlebigen, signierten Setup-Token zurück, mit dem das
  // Frontend dann /api/setup-password aufruft.
  const storedPw = (row.password ?? "").trim();
  if (storedPw.length === 0) {
    const setupToken = await createSetupToken(env, row.id);
    return jsonResponse({
      needsPasswordSetup: true,
      setupToken,
      benutzername: row.benutzername,
    });
  }

  if (!password) {
    return jsonResponse(
      { error: "Bitte gib dein Passwort ein" },
      { status: 400 },
    );
  }

  if (!verifyPassword(password, storedPw)) {
    return jsonResponse(
      { error: "Benutzername oder Passwort falsch" },
      { status: 401 },
    );
  }

  const totpOn =
    Number(row.totp_enabled) === 1 &&
    (row.totp_secret ?? "").trim().length > 0;
  if (totpOn) {
    const mfaPendingToken = await createMfaPendingToken(env, row.id);
    return jsonResponse(
      { needsTotp: true, mfaPendingToken },
      { status: 200 },
    );
  }

  // last_login aktualisieren (best effort, kein harter Fail)
  try {
    await env.user
      .prepare("UPDATE user SET last_login = ?1 WHERE id = ?2")
      .bind(new Date().toISOString(), row.id)
      .run();
  } catch (err) {
    console.warn("[login] last_login update fehlgeschlagen:", err);
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
