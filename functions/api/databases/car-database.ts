/**
 * GET /api/databases/car-database
 *
 * Liest die NEUE Fahrzeug-Datenbank (`cardb` → Tabelle `fahrzeugliste`,
 * eine Zeile je Bild-Variante) für die „Car Database"-Übersicht.
 *
 *   ?mode=overview          → Kennzahlen + Daten für Grafiken
 *   (sonst, list)           → gefilterte, paginierte Liste PRO AUTO
 *                             (marke|modell|jahr|body|trim|farbe aggregiert)
 *
 * List-Parameter: q, marke, farbe, format, view, status
 *   status ∈ open|done|error|hold|not_rendered|all
 *   view   → nur Autos, bei denen diese Ansicht noch offen ist
 * Pagination: limit (max 100), offset.
 *
 * Robust gegen leere/fehlende DB: liefert Nullwerte / leere Liste mit `empty`.
 */

import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";

const STATUS_KEYS = [
  "all",
  "open",
  "done",
  "error",
  "hold",
  "not_rendered",
] as const;
type StatusKey = (typeof STATUS_KEYS)[number];

/** LIKE-Muster aus User-Eingabe; entfernt Wildcards, trimmt. */
function likePattern(raw: string): string | null {
  const v = raw.trim().replace(/[%_]/g, " ").replace(/\s+/g, " ").trim();
  if (!v) return null;
  return `%${v}%`;
}

/** `aktiv`-Ausdruck (generierte Spalte existiert, aber wir bleiben robust). */
const NOT_RENDERED = "(r2_key IS NULL OR r2_key = '')";

export const onRequestGet: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const db = env.cardb;
  if (!db) {
    return jsonResponse(
      {
        error:
          "D1-Binding `cardb` (neue Fahrzeug-DB) fehlt. Im Pages-Projekt → Settings → Functions → D1-Bindings als `cardb` ergänzen.",
      },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const mode = (url.searchParams.get("mode") || "list").toLowerCase();

  try {
    if (mode === "overview") {
      return await handleOverview(db);
    }
    return await handleList(db, url);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Leere DB ohne Tabelle → freundlicher Leerzustand statt 500.
    if (/no such table/i.test(msg)) {
      return jsonResponse(
        mode === "overview"
          ? { empty: true, reason: "no-table", ...EMPTY_OVERVIEW }
          : { empty: true, reason: "no-table", rows: [], total: 0 },
        { status: 200 },
      );
    }
    return jsonResponse({ error: msg }, { status: 500 });
  }
};

const EMPTY_OVERVIEW = {
  kpis: {
    vehicles: 0,
    images: 0,
    aktiv: 0,
    offen: 0,
    fehler: 0,
    hold: 0,
    nicht_gerendert: 0,
  },
  stages: {
    gesamt: 0,
    kontrolliert: 0,
    ausgeschnitten: 0,
    skaliert: 0,
    aktiv: 0,
  },
  openByView: [] as unknown[],
  topBrands: [] as unknown[],
};

async function handleOverview(db: D1Database): Promise<Response> {
  const kpiRow = await db
    .prepare(
      `SELECT
         COUNT(*) AS images,
         COUNT(DISTINCT marke||'|'||modell||'|'||jahr||'|'||body||'|'||trim||'|'||farbe) AS vehicles,
         ifnull(SUM(aktiv), 0) AS aktiv,
         ifnull(SUM(CASE WHEN aktiv = 0 THEN 1 ELSE 0 END), 0) AS offen,
         ifnull(SUM(kontrolliert), 0) AS kontrolliert,
         ifnull(SUM(ausgeschnitten), 0) AS ausgeschnitten,
         ifnull(SUM(skaliert), 0) AS skaliert,
         ifnull(SUM(fehler), 0) AS fehler,
         ifnull(SUM(hold), 0) AS hold,
         ifnull(SUM(CASE WHEN ${NOT_RENDERED} THEN 1 ELSE 0 END), 0) AS nicht_gerendert
       FROM fahrzeugliste`,
    )
    .first<Record<string, number>>();

  const k = kpiRow ?? {};
  const num = (v: unknown) => Number(v ?? 0);

  const openByView = await db
    .prepare(
      `SELECT "view" AS view,
         ifnull(SUM(CASE WHEN aktiv = 0 THEN 1 ELSE 0 END), 0) AS offen,
         COUNT(*) AS gesamt
       FROM fahrzeugliste
       GROUP BY "view"
       ORDER BY offen DESC, gesamt DESC, view
       LIMIT 30`,
    )
    .all();

  const topBrands = await db
    .prepare(
      `SELECT marke,
         COUNT(*) AS images,
         COUNT(DISTINCT modell||'|'||jahr||'|'||body||'|'||trim||'|'||farbe) AS vehicles,
         ifnull(SUM(aktiv), 0) AS aktiv
       FROM fahrzeugliste
       GROUP BY marke
       ORDER BY images DESC, marke
       LIMIT 10`,
    )
    .all();

  return jsonResponse({
    empty: num(k.images) === 0,
    kpis: {
      vehicles: num(k.vehicles),
      images: num(k.images),
      aktiv: num(k.aktiv),
      offen: num(k.offen),
      fehler: num(k.fehler),
      hold: num(k.hold),
      nicht_gerendert: num(k.nicht_gerendert),
    },
    stages: {
      gesamt: num(k.images),
      kontrolliert: num(k.kontrolliert),
      ausgeschnitten: num(k.ausgeschnitten),
      skaliert: num(k.skaliert),
      aktiv: num(k.aktiv),
    },
    openByView: (openByView.results ?? []).map((r) => ({
      view: String((r as Record<string, unknown>).view ?? ""),
      offen: Number((r as Record<string, unknown>).offen ?? 0),
      gesamt: Number((r as Record<string, unknown>).gesamt ?? 0),
    })),
    topBrands: (topBrands.results ?? []).map((r) => ({
      marke: String((r as Record<string, unknown>).marke ?? ""),
      images: Number((r as Record<string, unknown>).images ?? 0),
      vehicles: Number((r as Record<string, unknown>).vehicles ?? 0),
      aktiv: Number((r as Record<string, unknown>).aktiv ?? 0),
    })),
  });
}

async function handleList(db: D1Database, url: URL): Promise<Response> {
  const p = url.searchParams;
  const where: string[] = [];
  const binds: (string | number)[] = [];

  const q = likePattern(p.get("q") || "");
  if (q) {
    where.push(
      "(marke LIKE ? OR modell LIKE ? OR CAST(jahr AS TEXT) LIKE ? OR (marke || ' ' || modell) LIKE ?)",
    );
    binds.push(q, q, q, q);
  }
  for (const col of ["marke", "farbe", "format"] as const) {
    const raw = (p.get(col) || "").trim();
    if (raw) {
      where.push(`lower(${col}) = ?`);
      binds.push(raw.toLowerCase());
    }
  }

  // Status-Filter → HAVING auf den Aggregaten.
  const statusRaw = (p.get("status") || "all").toLowerCase();
  const status: StatusKey = (STATUS_KEYS as readonly string[]).includes(
    statusRaw,
  )
    ? (statusRaw as StatusKey)
    : "all";
  const having: string[] = [];
  if (status === "open") having.push("SUM(CASE WHEN aktiv = 0 THEN 1 ELSE 0 END) > 0");
  else if (status === "done") having.push("SUM(aktiv) = COUNT(*)");
  else if (status === "error") having.push("SUM(fehler) > 0");
  else if (status === "hold") having.push("SUM(hold) > 0");
  else if (status === "not_rendered")
    having.push(`SUM(CASE WHEN ${NOT_RENDERED} THEN 1 ELSE 0 END) > 0`);

  // View-Filter → nur Autos, bei denen diese Ansicht offen ist.
  const view = (p.get("view") || "").trim().toLowerCase();
  if (view) {
    having.push(
      "SUM(CASE WHEN lower(\"view\") = ? AND aktiv = 0 THEN 1 ELSE 0 END) > 0",
    );
  }

  const whereSql = where.length ? ` WHERE ${where.join(" AND ")}` : "";
  const havingSql = having.length ? ` HAVING ${having.join(" AND ")}` : "";
  // HAVING-Binds (View) kommen NACH den WHERE-Binds.
  const havingBinds: (string | number)[] = view ? [view] : [];

  const limit = Math.min(100, Math.max(1, Number(p.get("limit") || 30)));
  const offset = Math.max(0, Number(p.get("offset") || 0));

  // Gesamtzahl der Gruppen (für Pagination).
  const countSql = `SELECT COUNT(*) AS n FROM (
    SELECT 1 FROM fahrzeugliste${whereSql}
    GROUP BY marke, modell, jahr, body, trim, farbe${havingSql}
  )`;
  const countRow = await db
    .prepare(countSql)
    .bind(...binds, ...havingBinds)
    .first<{ n: number }>();
  const total = Number(countRow?.n ?? 0);

  const listSql = `SELECT
      marke, modell, jahr, body, trim, farbe,
      COUNT(*) AS images,
      ifnull(SUM(aktiv), 0) AS aktiv,
      COUNT(DISTINCT "view") AS views_total,
      COUNT(DISTINCT CASE WHEN aktiv = 0 THEN "view" END) AS views_offen,
      GROUP_CONCAT(DISTINCT CASE WHEN aktiv = 0 THEN "view" END) AS offene_views,
      ifnull(SUM(fehler), 0) AS fehler,
      ifnull(SUM(hold), 0) AS hold,
      ifnull(SUM(CASE WHEN ${NOT_RENDERED} THEN 1 ELSE 0 END), 0) AS nicht_gerendert,
      MAX(last_updated) AS last_updated,
      MAX(CASE WHEN lower("view") = 'front_right' AND NOT ${NOT_RENDERED} THEN r2_key END) AS thumb_key
    FROM fahrzeugliste${whereSql}
    GROUP BY marke, modell, jahr, body, trim, farbe${havingSql}
    ORDER BY views_offen DESC, fehler DESC, marke, modell, jahr
    LIMIT ? OFFSET ?`;
  const listRes = await db
    .prepare(listSql)
    .bind(...binds, ...havingBinds, limit, offset)
    .all();

  const rows = (listRes.results ?? []).map((r) => {
    const o = r as Record<string, unknown>;
    return {
      marke: String(o.marke ?? ""),
      modell: String(o.modell ?? ""),
      jahr: Number(o.jahr ?? 0),
      body: String(o.body ?? ""),
      trim: String(o.trim ?? ""),
      farbe: String(o.farbe ?? ""),
      images: Number(o.images ?? 0),
      aktiv: Number(o.aktiv ?? 0),
      viewsTotal: Number(o.views_total ?? 0),
      viewsOffen: Number(o.views_offen ?? 0),
      offeneViews: String(o.offene_views ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      fehler: Number(o.fehler ?? 0),
      hold: Number(o.hold ?? 0),
      nichtGerendert: Number(o.nicht_gerendert ?? 0),
      lastUpdated: o.last_updated ? String(o.last_updated) : null,
      thumbKey: o.thumb_key ? String(o.thumb_key) : null,
    };
  });

  return jsonResponse({ empty: total === 0, rows, total, limit, offset });
}
