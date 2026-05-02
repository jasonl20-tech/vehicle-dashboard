import {
  buildSessionCookie,
  createSessionToken,
  jsonResponse,
  verifySetupToken,
  type AuthEnv,
} from "../_lib/auth";
import {
  diagnosePasswordSecret,
  hashPasswordForStorage,
  PASSWORD_SECRET_MISSING_MESSAGE,
} from "../_lib/passwordHash";

const MIN_LENGTH = 8;

/**
 * Diagnose-Endpunkt: zeigt, ob Cloudflare Pages Functions die Variable
 * `password_secret` aktuell sehen können — **ohne den Wert auszuliefern**.
 *
 * Aufruf z.B. im Browser: `GET /api/setup-password`. Antwort enthält Namen
 * und Längen, aber niemals den Pepper selbst.
 */
export const onRequestGet: PagesFunction<AuthEnv> = async ({ env }) => {
  const diag = diagnosePasswordSecret(env);
  return jsonResponse(
    {
      ok: diag.resolved.length >= diag.minRequired,
      diagnostics: diag,
      hint:
        diag.resolved.length >= diag.minRequired
          ? "password_secret ist im aktuellen Deployment angekommen."
          : "password_secret fehlt im aktuellen Deployment. Variable im selben Pages-Projekt anlegen UND danach erneut deployen (alte Deployments sehen neue Variablen nicht).",
    },
    { status: 200 },
  );
};

export const onRequestPost: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  let body: { setupToken?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Ungültige Anfrage" }, { status: 400 });
  }

  const setupToken =
    typeof body?.setupToken === "string" ? body.setupToken : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!setupToken) {
    return jsonResponse({ error: "Setup-Token fehlt" }, { status: 400 });
  }
  if (!password || password.length < MIN_LENGTH) {
    return jsonResponse(
      {
        error: `Passwort muss mindestens ${MIN_LENGTH} Zeichen lang sein`,
      },
      { status: 400 },
    );
  }

  const session = await verifySetupToken(env, setupToken);
  if (!session) {
    return jsonResponse(
      { error: "Setup-Link ist abgelaufen, bitte erneut anmelden" },
      { status: 401 },
    );
  }

  const row = await env.user
    .prepare(
      "SELECT id, password, active FROM user WHERE id = ?1 LIMIT 1",
    )
    .bind(session.sub)
    .first<{ id: number; password: string | null; active: number }>();

  if (!row || row.active !== 1) {
    return jsonResponse({ error: "Account nicht verfügbar" }, { status: 401 });
  }

  // Doppel-Check: nur setzen, wenn Passwort tatsächlich noch leer ist.
  // Verhindert, dass ein abgefangener Setup-Token später ein gesetztes
  // Passwort überschreiben kann.
  if ((row.password ?? "").trim().length > 0) {
    return jsonResponse(
      {
        error:
          "Für diesen Account ist bereits ein Passwort gesetzt. Bitte normal anmelden.",
      },
      { status: 409 },
    );
  }

  let hashed: string;
  try {
    hashed = await hashPasswordForStorage(env, password);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === PASSWORD_SECRET_MISSING_MESSAGE) {
      const diag = diagnosePasswordSecret(env);
      console.error(
        "[setup-password] password_secret nicht auflösbar:",
        JSON.stringify(diag),
      );
      return jsonResponse(
        {
          error:
            "Der Server kann das Passwort derzeit nicht sicher speichern. Lege im **gleichen Cloudflare Pages-Projekt** (Production und ggf. Preview) die Variable **password_secret** als Text oder Secret mit mind. 16 Zeichen an und stoße danach **erneut einen Deploy** an (alte Deployments sehen die Variable nicht!).",
          /**
           * Diagnose ohne Werte: zeigt, was Functions wirklich in env sehen.
           * Sicherheit: enthält keine Geheimnisse, nur Namen und Längen.
           */
          diagnostics: diag,
        },
        { status: 503 },
      );
    }
    console.error("[setup-password] hashing fehlgeschlagen:", e);
    return jsonResponse(
      {
        error: "Passwort konnte aus technischen Gründen nicht verarbeitet werden.",
        /**
         * Sicher: WebCrypto/PBKDF2-Fehlermeldungen enthalten weder Pepper
         * noch User-Passwort, sondern nur Operationen ("PBKDF2 not supported",
         * "Worker exceeded CPU time" o.ae.). Hilft, Cloudflare-Limits/-Setup-
         * Probleme zu erkennen, ohne in Logs schauen zu muessen.
         */
        details: msg,
      },
      { status: 500 },
    );
  }

  try {
    await env.user
      .prepare(
        "UPDATE user SET password = ?1, last_login = ?2 WHERE id = ?3",
      )
      .bind(hashed, new Date().toISOString(), row.id)
      .run();
  } catch (err) {
    console.error("[setup-password] DB-Update fehlgeschlagen:", err);
    return jsonResponse(
      { error: "Passwort konnte nicht gespeichert werden" },
      { status: 500 },
    );
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
