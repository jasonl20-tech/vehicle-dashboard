/**
 * POST /api/website/crm-customers/sync
 *
 * Trägt fehlende E-Mails aus KV `customer_keys` und D1 `submissions` (ohne Spam)
 * in `crm_customers` ein, sofern die Adresse noch nicht existiert.
 */
import { getCurrentUser, jsonResponse, type AuthEnv } from "../../../_lib/auth";
import { fetchAllSummaries } from "../../../_lib/kvCustomerKeySummaries";

const SUBMISSIONS_PAGE = 400;
/** Obergrenze pro Lauf (Worker-Laufzeit); bei Bedarf Sync erneut ausführen. */
const MAX_SUBMISSION_ROWS = 20000;

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

function requireKv(env: AuthEnv): KVNamespace | Response {
  if (!env.customer_keys) {
    return jsonResponse(
      {
        error:
          "KV-Binding `customer_keys` fehlt. Im Cloudflare-Dashboard unter Functions → Bindings eine KV hinzufügen (Variable `customer_keys`).",
      },
      { status: 503 },
    );
  }
  return env.customer_keys;
}

function normalizeEmail(raw: string): string | null {
  const t = raw.trim().toLowerCase();
  if (!t || !t.includes("@") || t.length > 320) return null;
  return t;
}

function tryParseJson(s: string): unknown {
  try {
    return JSON.parse(s) as unknown;
  } catch {
    return null;
  }
}

function emailFromPayload(payload: unknown): string | null {
  if (payload == null || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const o = payload as Record<string, unknown>;
  const e = o.email;
  if (typeof e === "string" && e.includes("@")) return normalizeEmail(e);
  return null;
}

function emailFromMetadata(metadata: unknown): string | null {
  if (metadata == null || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const m = metadata as Record<string, unknown>;
  for (const k of ["email", "Email", "contact_email", "mail"]) {
    const v = m[k];
    if (typeof v === "string" && v.includes("@")) {
      const n = normalizeEmail(v);
      if (n) return n;
    }
  }
  return null;
}

function sanitizeStatus(s: string | null, fallback: string): string {
  const t = (s ?? "").trim();
  if (!t) return fallback;
  return t.slice(0, 64);
}

type InsertRow = {
  id: string;
  email: string;
  status: string;
  kv_key: string | null;
  notes: string | null;
};

export const onRequestPost: PagesFunction<AuthEnv> = async ({ request, env }) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const db = requireWebsiteDb(env);
  if (db instanceof Response) return db;
  const kv = requireKv(env);
  if (kv instanceof Response) return kv;

  const existing = new Set<string>();
  const loadExisting = await db
    .prepare(`SELECT lower(email) AS e FROM crm_customers WHERE email IS NOT NULL`)
    .all<{ e: string }>();
  for (const row of loadExisting.results ?? []) {
    if (row.e) existing.add(row.e);
  }

  let skippedKvNoEmail = 0;
  let skippedSubNoEmail = 0;
  let skippedAlready = 0;

  const toInsert: InsertRow[] = [];

  const take = (row: InsertRow) => {
    if (existing.has(row.email)) {
      skippedAlready += 1;
      return;
    }
    existing.add(row.email);
    toInsert.push(row);
  };

  const summaries = await fetchAllSummaries(kv);
  for (const s of summaries) {
    const em = s.email ? normalizeEmail(s.email) : null;
    if (!em) {
      skippedKvNoEmail += 1;
      continue;
    }
    take({
      id: crypto.randomUUID(),
      email: em,
      status: sanitizeStatus(s.status, "lead"),
      kv_key: s.key,
      notes: null,
    });
  }

  const insertedFromKv = toInsert.length;

  let subScanned = 0;
  let offset = 0;
  while (subScanned < MAX_SUBMISSION_ROWS) {
    const { results } = await db
      .prepare(
        `SELECT id, form_tag, payload, metadata
         FROM submissions
         WHERE IFNULL(spam, 0) != 1
         ORDER BY datetime(created_at) DESC
         LIMIT ? OFFSET ?`,
      )
      .bind(SUBMISSIONS_PAGE, offset)
      .all<{
        id: string;
        form_tag: string;
        payload: string;
        metadata: string;
      }>();

    const rows = results ?? [];
    if (rows.length === 0) break;

    for (const r of rows) {
      subScanned += 1;
      const payload = tryParseJson(r.payload);
      const metadata = tryParseJson(r.metadata);
      const em =
        emailFromPayload(payload) ?? emailFromMetadata(metadata);
      if (!em) {
        skippedSubNoEmail += 1;
        continue;
      }
      const tag = (r.form_tag || "unbekannt").slice(0, 120);
      const note = `Quelle: Formular „${tag}“ (Submission ${r.id.slice(0, 12)}…)`;
      take({
        id: crypto.randomUUID(),
        email: em,
        status: "lead",
        kv_key: null,
        notes: note.slice(0, 4000),
      });
    }

    offset += rows.length;
    if (rows.length < SUBMISSIONS_PAGE) break;
  }

  const insertedFromSub = toInsert.length - insertedFromKv;

  const BATCH = 80;
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const chunk = toInsert.slice(i, i + BATCH);
    const stmts = chunk.map((row) =>
      db
        .prepare(
          `INSERT INTO crm_customers (
            id, email, status, email_status, kv_key, notes, additional_emails, business_name, updated_at
          ) VALUES (?, ?, ?, 0, ?, ?, '[]', NULL, CURRENT_TIMESTAMP)`,
        )
        .bind(row.id, row.email, row.status, row.kv_key, row.notes),
    );
    await db.batch(stmts);
  }

  const inserted = toInsert.length;

  return jsonResponse(
    {
      ok: true,
      inserted,
      insertedFromKv,
      insertedFromSubmissions: insertedFromSub,
      skippedKvWithoutEmail: skippedKvNoEmail,
      skippedSubmissionWithoutEmail: skippedSubNoEmail,
      skippedAlreadyInCrm: skippedAlready,
      submissionsScanned: subScanned,
    },
    { status: 200 },
  );
};
