/**
 * GET /api/website/crm-customers/:id
 */
import { getCurrentUser, jsonResponse, type AuthEnv } from "../../../_lib/auth";

type CrmRowDb = {
  id: string;
  created_at: string;
  updated_at: string;
  email: string;
  status: string;
  email_status: number;
  business_name: string | null;
  kv_key: string | null;
  additional_emails: string;
  notes: string | null;
};

function requireWebsiteDb(env: AuthEnv): D1Database | Response {
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

export const onRequestGet: PagesFunction<AuthEnv> = async (context) => {
  const { request, env, params } = context;
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const db = requireWebsiteDb(env);
  if (db instanceof Response) return db;

  const rawId = params?.id != null ? String(params.id) : "";
  const id = rawId ? decodeURIComponent(rawId) : "";
  if (!id.trim()) {
    return jsonResponse({ error: "Fehlende Kunden-ID" }, { status: 400 });
  }

  const row = await db
    .prepare(
      `SELECT id, created_at, updated_at, email, status, email_status, business_name, kv_key, additional_emails, notes
       FROM crm_customers WHERE id = ? LIMIT 1`,
    )
    .bind(id.trim())
    .first<CrmRowDb>();

  if (!row) {
    return jsonResponse({ error: "Eintrag nicht gefunden" }, { status: 404 });
  }

  return jsonResponse({ row }, { status: 200 });
};
