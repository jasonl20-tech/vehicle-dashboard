/**
 * GET /api/databases/car-database
 *
 * Liest die NEUE Fahrzeug-Datenbank (`cardb` → Tabelle `fahrzeugliste`,
 * eine Zeile je Bild-Variante) für die „Car Database"-Übersicht.
 *
 *   ?mode=overview          → Kennzahlen + Daten für Grafiken
 *   ?mode=detail            → ein Auto im Detail: alle Farben + alle Ansichten
 *                             (pro Ansicht aggregiert) für die Detail-Ansicht
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
    if (mode === "detail") {
      return await handleDetail(db, url);
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
  // Drei Voll-Scans (KPIs, offene Ansichten, Top-Marken) PARALLEL statt seriell —
  // auf der großen Tabelle (>500k Zeilen) spart das ~⅔ der Wartezeit.
  const [kpiRow, openByView, topBrands] = await Promise.all([
    db
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
      .first<Record<string, number>>(),
    db
      .prepare(
        `SELECT "view" AS view,
           ifnull(SUM(CASE WHEN aktiv = 0 THEN 1 ELSE 0 END), 0) AS offen,
           COUNT(*) AS gesamt
         FROM fahrzeugliste
         GROUP BY "view"
         ORDER BY offen DESC, gesamt DESC, view
         LIMIT 30`,
      )
      .all(),
    db
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
      .all(),
  ]);

  const k = kpiRow ?? {};
  const num = (v: unknown) => Number(v ?? 0);

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
      MAX(last_updated) AS last_updated
    FROM fahrzeugliste${whereSql}
    GROUP BY marke, modell, jahr, body, trim, farbe${havingSql}
    ORDER BY views_offen DESC, fehler DESC, marke, modell, jahr
    LIMIT ? OFFSET ?`;

  // Zählung (für Pagination) + Liste PARALLEL.
  const [countRow, listRes] = await Promise.all([
    db.prepare(countSql).bind(...binds, ...havingBinds).first<{ n: number }>(),
    db
      .prepare(listSql)
      .bind(...binds, ...havingBinds, limit, offset)
      .all(),
  ]);
  const total = Number(countRow?.n ?? 0);

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
    };
  });

  return jsonResponse({ empty: total === 0, rows, total, limit, offset });
}

/**
 * Detail eines Autos (marke|modell|jahr|body|trim): alle Farben + je Ansicht
 * aggregierte Status-Infos für die ausgewählte Farbe. Die Bilder selbst lädt
 * das Frontend über den Thumbnail-Proxy (aus der Auto-Identität).
 */
async function handleDetail(db: D1Database, url: URL): Promise<Response> {
  const p = url.searchParams;
  const marke = (p.get("marke") || "").trim();
  const modell = (p.get("modell") || "").trim();
  const jahrRaw = (p.get("jahr") || "").trim();
  const body = (p.get("body") || "").trim();
  const trim = (p.get("trim") || "").trim();
  const farbeWanted = (p.get("farbe") || "").trim();

  if (!marke || !modell || !jahrRaw) {
    return jsonResponse(
      { error: "marke, modell und jahr sind erforderlich." },
      { status: 400 },
    );
  }
  const jahr = Number(jahrRaw) || 0;

  // jahr als Zahl binden (Spalte ist INTEGER); body/trim können leer sein.
  const carWhere =
    "marke = ? AND modell = ? AND jahr = ? AND body = ? AND trim = ?";
  const carBinds: (string | number)[] = [marke, modell, jahr, body, trim];

  // Alle Farben dieses Modells (für die Farb-Auswahl).
  const colorsRes = await db
    .prepare(
      `SELECT farbe,
         COUNT(*) AS images,
         ifnull(SUM(aktiv), 0) AS aktiv,
         COUNT(DISTINCT "view") AS views_total,
         COUNT(DISTINCT CASE WHEN aktiv = 0 THEN "view" END) AS views_offen
       FROM fahrzeugliste
       WHERE ${carWhere}
       GROUP BY farbe
       ORDER BY aktiv DESC, farbe`,
    )
    .bind(...carBinds)
    .all();

  const colors = (colorsRes.results ?? []).map((r) => {
    const o = r as Record<string, unknown>;
    return {
      farbe: String(o.farbe ?? ""),
      images: Number(o.images ?? 0),
      aktiv: Number(o.aktiv ?? 0),
      viewsTotal: Number(o.views_total ?? 0),
      viewsOffen: Number(o.views_offen ?? 0),
    };
  });

  if (colors.length === 0) {
    return jsonResponse({
      empty: true,
      car: { marke, modell, jahr, body, trim },
      colors: [],
      selectedFarbe: "",
      views: [],
    });
  }

  // Gewählte Farbe: angefragte, sonst die mit den meisten fertigen Bildern.
  const selectedFarbe =
    colors.find((c) => c.farbe === farbeWanted)?.farbe ?? colors[0].farbe;

  // Je Ansicht aggregiert (für die gewählte Farbe).
  const viewsRes = await db
    .prepare(
      `SELECT "view" AS view,
         COUNT(*) AS images,
         ifnull(SUM(aktiv), 0) AS aktiv,
         ifnull(SUM(fehler), 0) AS fehler,
         ifnull(SUM(hold), 0) AS hold,
         ifnull(SUM(CASE WHEN ${NOT_RENDERED} THEN 1 ELSE 0 END), 0) AS not_rendered,
         ifnull(SUM(kontrolliert), 0) AS kontrolliert,
         ifnull(SUM(ausgeschnitten), 0) AS ausgeschnitten,
         ifnull(SUM(skaliert), 0) AS skaliert,
         GROUP_CONCAT(DISTINCT format) AS formats,
         GROUP_CONCAT(DISTINCT resolution) AS resolutions,
         MAX(hohe) AS hohe,
         MAX(shadow) AS shadow,
         MAX(transparent) AS transparent,
         MAX(last_updated) AS last_updated
       FROM fahrzeugliste
       WHERE ${carWhere} AND farbe = ?
       GROUP BY "view"
       ORDER BY "view"`,
    )
    .bind(...carBinds, selectedFarbe)
    .all();

  const splitList = (v: unknown) =>
    String(v ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  const views = (viewsRes.results ?? []).map((r) => {
    const o = r as Record<string, unknown>;
    const images = Number(o.images ?? 0);
    const aktiv = Number(o.aktiv ?? 0);
    const fehler = Number(o.fehler ?? 0);
    const hold = Number(o.hold ?? 0);
    const notRendered = Number(o.not_rendered ?? 0);
    // Status der Ansicht ableiten.
    let status: "done" | "open" | "error" | "hold" | "not_rendered";
    if (fehler > 0) status = "error";
    else if (hold > 0) status = "hold";
    else if (notRendered >= images && images > 0) status = "not_rendered";
    else if (aktiv >= images && images > 0) status = "done";
    else status = "open";
    return {
      view: String(o.view ?? ""),
      images,
      aktiv,
      fehler,
      hold,
      notRendered,
      status,
      formats: splitList(o.formats),
      resolutions: splitList(o.resolutions),
      hohe: o.hohe == null ? null : Number(o.hohe),
      shadow: Number(o.shadow ?? 0) > 0,
      transparent: Number(o.transparent ?? 0) > 0,
      lastUpdated: o.last_updated ? String(o.last_updated) : null,
    };
  });

  return jsonResponse({
    empty: false,
    car: { marke, modell, jahr, body, trim },
    colors,
    selectedFarbe,
    views,
  });
}
