/**
 * Email-Jobs — Einzelner Job (READ-ONLY).
 *
 *   GET /api/emails/jobs/<id>
 *     → EmailJobFull (inkl. raw `custom_body_html` und voller `recipient_data`)
 *
 * Schreibende Verben: 405. Bearbeitung erfolgt ausschließlich durch den
 * externen Mail-Worker, der die Tabelle ursprünglich befüllt.
 */
import { getCurrentUser, jsonResponse, type AuthEnv } from "../../../_lib/auth";

type FullRow = {
  id: string;
  recipient_data: string;
  template_id: string | null;
  custom_subject: string | null;
  custom_body_html: string | null;
  status: string;
  error_message: string | null;
  retries: number;
  scheduled_at: string | null;
  sent_at: string | null;
  created_at: string | null;
  from_email: string;
};

function requireDb(env: AuthEnv): D1Database | Response {
  if (!env.website) {
    return jsonResponse(
      {
        error:
          "D1-Binding `website` fehlt. Im Cloudflare-Dashboard → Functions → D1, Variable `website` (env.website) setzen.",
      },
      { status: 503 },
    );
  }
  return env.website;
}

function tableMissingHint(e: unknown): string | null {
  const msg = (e as Error)?.message || String(e);
  if (/no such table/i.test(msg) || /email_jobs/.test(msg)) {
    return "Tabelle `email_jobs` fehlt. Migration ausführen: `wrangler d1 execute <DB-NAME> --file=./d1/migrations/0008_email_jobs.sql`.";
  }
  return null;
}

export const onRequestGet: PagesFunction<AuthEnv> = async ({
  request,
  env,
  params,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const db = requireDb(env);
  if (db instanceof Response) return db;

  const id = typeof params?.id === "string" ? params.id : "";
  if (!id) {
    return jsonResponse({ error: "id fehlt" }, { status: 400 });
  }

  try {
    const row = await db
      .prepare(
        `SELECT id,
                recipient_data,
                template_id,
                custom_subject,
                custom_body_html,
                status,
                error_message,
                COALESCE(retries, 0) AS retries,
                scheduled_at,
                sent_at,
                created_at,
                from_email
           FROM email_jobs
          WHERE id = ?
          LIMIT 1`,
      )
      .bind(id)
      .first<FullRow>();

    if (!row) {
      return jsonResponse(
        { error: `Job \`${id}\` nicht gefunden` },
        { status: 404 },
      );
    }

    return jsonResponse(row);
  } catch (e) {
    const hint = tableMissingHint(e);
    return jsonResponse(
      {
        error: (e as Error).message || String(e),
        ...(hint ? { hint } : null),
      },
      { status: hint ? 503 : 500 },
    );
  }
};

const NOT_ALLOWED: Response = jsonResponse(
  {
    error:
      "Email-Jobs sind im Dashboard nur lesend einsehbar. Schreibende Operationen erfolgen ausschließlich über den externen Mail-Worker.",
  },
  { status: 405, headers: { Allow: "GET" } },
);

export const onRequestPost: PagesFunction<AuthEnv> = async () =>
  NOT_ALLOWED.clone();
export const onRequestPut: PagesFunction<AuthEnv> = async () =>
  NOT_ALLOWED.clone();
export const onRequestPatch: PagesFunction<AuthEnv> = async () =>
  NOT_ALLOWED.clone();
export const onRequestDelete: PagesFunction<AuthEnv> = async () =>
  NOT_ALLOWED.clone();
