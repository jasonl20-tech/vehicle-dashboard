/**
 * Finder + Nach-Generierung für Live-Autos mit fehlenden AUSSEN-Ansichten.
 *
 * GET  /api/databases/vehicle-imagery-incomplete?q=&only=incomplete|all&limit=&offset=
 *   Liest den LIVE-Bestand (`vehicleimagery_public_storage`, active=1) und
 *   zählt die 8 Standard-Außen-Ansichten im `views`-Feld. Liefert pro Auto:
 *   vorhandene/fehlende Ansichten + ob ein Controlling-Zwilling existiert.
 *
 * POST /api/databases/vehicle-imagery-incomplete   Body: { controllingId, views: string[] }
 *   Legt für die genannten (fehlenden) Außen-Ansichten je einen Re-Generierungs-
 *   Job in `controll_status` an (mode=correction, status=regen_vertex, check=8) —
 *   genau wie der bestehende Missing-View-Seeder. Die Pipeline (n8n → kie.ai)
 *   generiert sie dann und stellt sie neu live.
 */

import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";
import { controllingStorageR2KeyFromViewToken } from "../../_lib/vehicleImageryR2Key";

const EXTERIOR_VIEWS = [
  "front",
  "rear",
  "left",
  "right",
  "front_left",
  "front_right",
  "rear_left",
  "rear_right",
] as const;

// `views`-Feld normalisieren (CR/LF → ;) für ;-getrennte Token-Suche.
const NORM = "replace(replace(ifnull(views,''),char(13),''),char(10),';')";
// „Ansicht vorhanden" = Name VOR `#` stimmt (also `front` ODER `front#trp`/
// `#skaliert`/`#shadow`) — kanonische Definition (wie der Missing-View-Seeder).
const presentExpr = (v: string) =>
  `(CASE WHEN (';'||${NORM}||';') LIKE '%;${v};%' OR (';'||${NORM}||';') LIKE '%;${v}#%' THEN 1 ELSE 0 END)`;
const N_EXT = EXTERIOR_VIEWS.map(presentExpr).join(" + ");

const INSERT_REGEN = `INSERT OR IGNORE INTO controll_status (vehicle_id, view_token, mode, status, key, updated_at, "check")
VALUES (?, ?, 'correction', 'regen_vertex', ?, datetime('now'), 8)`;

function likePattern(raw: string): string | null {
  const v = raw.trim().replace(/[%_]/g, " ").replace(/\s+/g, " ").trim();
  return v ? `%${v}%` : null;
}

export const onRequestGet: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  const db = env.vehicledatabase;
  if (!db) {
    return jsonResponse(
      { error: "D1-Binding `vehicledatabase` fehlt." },
      { status: 503 },
    );
  }

  const p = new URL(request.url).searchParams;
  const only = (p.get("only") || "incomplete").toLowerCase();
  const limit = Math.min(200, Math.max(1, Number(p.get("limit") || 50)));
  const offset = Math.max(0, Number(p.get("offset") || 0));

  const where = ["active = 1", "sonstiges IS NULL"];
  const binds: (string | number)[] = [];
  const q = likePattern(p.get("q") || "");
  if (q) {
    where.push(
      "(marke LIKE ? OR modell LIKE ? OR (marke || ' ' || modell) LIKE ? OR CAST(jahr AS TEXT) LIKE ?)",
    );
    binds.push(q, q, q, q);
  }
  const whereSql = `WHERE ${where.join(" AND ")}`;
  const havingSql = only === "incomplete" ? `HAVING n_ext < 8` : "";

  // Pro-View-Spalten + n_ext + Controlling-Zwilling-Id.
  const viewCols = EXTERIOR_VIEWS.map(
    (v) => `${presentExpr(v)} AS has_${v}`,
  ).join(",\n      ");

  const sql = `SELECT
      id AS public_id, marke, modell, jahr, body, trim, farbe, format, resolution,
      (${N_EXT}) AS n_ext,
      ${viewCols},
      (SELECT c.id FROM vehicleimagery_controlling_storage c
        WHERE c.marke = v.marke AND c.modell = v.modell AND c.jahr = v.jahr
          AND c.body = v.body AND c.trim = v.trim AND c.farbe = v.farbe
        LIMIT 1) AS controlling_id
    FROM vehicleimagery_public_storage v
    ${whereSql}
    GROUP BY id
    ${havingSql}
    ORDER BY n_ext ASC, marke, modell, jahr
    LIMIT ? OFFSET ?`;

  const countSql = `SELECT COUNT(*) AS n FROM (
    SELECT (${N_EXT}) AS n_ext FROM vehicleimagery_public_storage v
    ${whereSql} GROUP BY id ${havingSql})`;

  try {
    const [countRow, res] = await Promise.all([
      db.prepare(countSql).bind(...binds).first<{ n: number }>(),
      db.prepare(sql).bind(...binds, limit, offset).all(),
    ]);
    const rows = (res.results ?? []).map((r) => {
      const o = r as Record<string, unknown>;
      const present = EXTERIOR_VIEWS.filter((v) => Number(o[`has_${v}`]) === 1);
      const missing = EXTERIOR_VIEWS.filter((v) => Number(o[`has_${v}`]) !== 1);
      return {
        publicId: Number(o.public_id ?? 0),
        marke: String(o.marke ?? ""),
        modell: String(o.modell ?? ""),
        jahr: Number(o.jahr ?? 0),
        body: String(o.body ?? ""),
        trim: String(o.trim ?? ""),
        farbe: String(o.farbe ?? ""),
        nExt: Number(o.n_ext ?? 0),
        present,
        missing,
        controllingId: o.controlling_id ? Number(o.controlling_id) : null,
      };
    });
    return jsonResponse({
      total: Number(countRow?.n ?? 0),
      rows,
      limit,
      offset,
    });
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
};

export const onRequestPost: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  const db = env.vehicledatabase;
  if (!db) {
    return jsonResponse(
      { error: "D1-Binding `vehicledatabase` fehlt." },
      { status: 503 },
    );
  }

  let body: { controllingId?: unknown; views?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: "Ungültiger Body." }, { status: 400 });
  }
  const controllingId = Number(body.controllingId);
  if (!Number.isInteger(controllingId) || controllingId <= 0) {
    return jsonResponse(
      {
        error:
          "controllingId erforderlich. Auto hat keinen Controlling-Eintrag — bitte erst über 'Auto erstellen' anlegen.",
      },
      { status: 400 },
    );
  }
  const views = Array.isArray(body.views)
    ? body.views
        .map((v) => String(v).trim().toLowerCase())
        .filter((v) => (EXTERIOR_VIEWS as readonly string[]).includes(v))
    : [];
  if (views.length === 0) {
    return jsonResponse(
      { error: "Mindestens eine gültige Außen-Ansicht erforderlich." },
      { status: 400 },
    );
  }

  try {
    // Controlling-Zeile laden (für den R2-Key je View).
    const row = await db
      .prepare(
        `SELECT id, format, resolution, marke, modell, jahr, body, trim, farbe
         FROM vehicleimagery_controlling_storage WHERE id = ?`,
      )
      .bind(controllingId)
      .first<Record<string, unknown>>();
    if (!row) {
      return jsonResponse(
        { error: "Controlling-Eintrag nicht gefunden." },
        { status: 404 },
      );
    }
    const rowForKey = {
      format: (row.format as string) ?? null,
      resolution: (row.resolution as string) ?? null,
      marke: (row.marke as string) ?? null,
      modell: (row.modell as string) ?? null,
      jahr: (row.jahr as number) ?? null,
      body: (row.body as string) ?? null,
      trim: (row.trim as string) ?? null,
      farbe: (row.farbe as string) ?? null,
    };

    // Server-seitig gegenprüfen: nur Ansichten regenerieren, die im LIVE-Bestand
    // wirklich fehlen (kanonisch = Name vor `#`) — schützt vor unnötigen,
    // kostenpflichtigen Jobs bei manipulierten Anfragen.
    const liveRow = await db
      .prepare(
        `SELECT views FROM vehicleimagery_public_storage
         WHERE marke = ? AND modell = ? AND jahr = ? AND body = ? AND trim = ?
           AND farbe = ? AND active = 1 AND sonstiges IS NULL
         LIMIT 1`,
      )
      .bind(
        rowForKey.marke,
        rowForKey.modell,
        rowForKey.jahr,
        rowForKey.body,
        rowForKey.trim,
        rowForKey.farbe,
      )
      .first<{ views: string | null }>();
    const presentSet = new Set(
      String(liveRow?.views ?? "")
        .replace(/[\r\n]+/g, ";")
        .split(";")
        .map((t) => t.trim().toLowerCase().split("#")[0])
        .filter(Boolean),
    );
    // Wenn keine Live-Zeile gefunden wurde, alle angefragten zulassen (Controlling
    // existiert ja); sonst nur die tatsächlich fehlenden.
    const targetViews = liveRow
      ? views.filter((v) => !presentSet.has(v))
      : views;
    if (targetViews.length === 0) {
      return jsonResponse({
        ok: true,
        controllingId,
        requested: views,
        inserted: 0,
        note: "Alle angefragten Ansichten sind bereits live vorhanden.",
      });
    }

    const stmts = targetViews.map((view) => {
      const key = controllingStorageR2KeyFromViewToken(rowForKey, view);
      return db.prepare(INSERT_REGEN).bind(controllingId, view, key);
    });
    const res = await db.batch(stmts);
    let inserted = 0;
    for (const r of res) {
      inserted +=
        typeof (r as { meta?: { changes?: number } }).meta?.changes === "number"
          ? (r as { meta: { changes: number } }).meta.changes
          : 0;
    }
    return jsonResponse({ ok: true, controllingId, requested: views, inserted });
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
};
