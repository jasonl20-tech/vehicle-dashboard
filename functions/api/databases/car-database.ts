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
  "incomplete_ext",
  "incomplete_int",
  "no_transparent",
  "no_shadow",
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

/** Die 8 Außen-Ansichten (Basis der Vollständigkeits-Prüfung). */
const EXTERIOR_VIEWS_SQL = `lower("view") IN ('front','rear','left','right','front_left','front_right','rear_left','rear_right')`;
/** Anzahl vorhandener Außen-Ansichten je Gruppe (0–8). */
const AUSSEN_COUNT_SQL = `COUNT(DISTINCT CASE WHEN ${EXTERIOR_VIEWS_SQL} THEN lower("view") END)`;
/** Anzeige-Reihenfolge der Außen-Ansichten (im Uhrzeigersinn). */
const EXTERIOR_ORDER = [
  "front",
  "front_right",
  "right",
  "rear_right",
  "rear",
  "rear_left",
  "left",
  "front_left",
];
/** Innen-Ansichten (aktuell genau diese zwei). */
const INTERIOR_VIEWS_SQL = `lower("view") IN ('dashboard','center_console')`;
/** Anzahl vorhandener Innen-Ansichten je Gruppe (0–2). */
const INNEN_COUNT_SQL = `COUNT(DISTINCT CASE WHEN ${INTERIOR_VIEWS_SQL} THEN lower("view") END)`;
/** Hat die Gruppe mind. eine transparente / eine Schatten-Variante? */
const HAS_TRP_SQL = `MAX(transparent)`;
const HAS_SHADOW_SQL = `MAX(shadow)`;

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
    if (mode === "gallery") {
      return await handleGallery(db, url);
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
    cars: 0,
    variants: 0,
    images: 0,
    marken: 0,
    aktiv: 0,
    fehler: 0,
    hold: 0,
    nicht_gerendert: 0,
  },
  completeness: {
    aussen_komplett: 0,
    aussen_unvollstaendig: 0,
    innen_komplett: 0,
    innen_teilweise: 0,
    innen_keine: 0,
    mit_transparenz: 0,
    ohne_transparenz: 0,
    mit_schatten: 0,
    ohne_schatten: 0,
  },
  stages: {
    gesamt: 0,
    kontrolliert: 0,
    ausgeschnitten: 0,
    skaliert: 0,
    aktiv: 0,
  },
  exteriorCars: 0,
  missingByView: [] as unknown[],
  topBrands: [] as unknown[],
};

async function handleOverview(db: D1Database): Promise<Response> {
  // Voll-Scans PARALLEL (KPIs, Vollständigkeit pro Auto, vorhandene Außen-
  // Ansichten, Top-Marken) — auf der großen Tabelle spart das viel Wartezeit.
  const [kpiRow, carRow, haveByView, topBrands] = await Promise.all([
    db
      .prepare(
        `SELECT
           COUNT(*) AS images,
           COUNT(DISTINCT marke) AS marken,
           COUNT(DISTINCT marke||'|'||modell||'|'||jahr||'|'||body||'|'||trim||'|'||farbe) AS variants,
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
    // Pro AUTO (ohne Farbe): Vollständigkeit Außen/Innen + Transparenz/Schatten.
    db
      .prepare(
        `SELECT
           COUNT(*) AS cars,
           ifnull(SUM(CASE WHEN aussen >= 8 THEN 1 ELSE 0 END), 0) AS aussen_komplett,
           ifnull(SUM(CASE WHEN aussen < 8 THEN 1 ELSE 0 END), 0) AS aussen_unvollstaendig,
           ifnull(SUM(CASE WHEN innen >= 2 THEN 1 ELSE 0 END), 0) AS innen_komplett,
           ifnull(SUM(CASE WHEN innen = 1 THEN 1 ELSE 0 END), 0) AS innen_teilweise,
           ifnull(SUM(CASE WHEN innen = 0 THEN 1 ELSE 0 END), 0) AS innen_keine,
           ifnull(SUM(CASE WHEN has_trp = 0 THEN 1 ELSE 0 END), 0) AS ohne_transparenz,
           ifnull(SUM(CASE WHEN has_shadow = 0 THEN 1 ELSE 0 END), 0) AS ohne_schatten
         FROM (
           SELECT ${AUSSEN_COUNT_SQL} AS aussen,
                  ${INNEN_COUNT_SQL} AS innen,
                  ${HAS_TRP_SQL} AS has_trp,
                  ${HAS_SHADOW_SQL} AS has_shadow
           FROM fahrzeugliste
           GROUP BY marke, modell, jahr, body, trim
         )`,
      )
      .first<Record<string, number>>(),
    // Wie viele AUTOS haben jede einzelne Außen-Ansicht (für „fehlt"-Grafik).
    db
      .prepare(
        `SELECT lower("view") AS view,
           COUNT(DISTINCT marke||'|'||modell||'|'||jahr||'|'||body||'|'||trim) AS have
         FROM fahrzeugliste
         WHERE ${EXTERIOR_VIEWS_SQL}
         GROUP BY lower("view")`,
      )
      .all(),
    db
      .prepare(
        `SELECT marke,
           COUNT(*) AS images,
           COUNT(DISTINCT modell||'|'||jahr||'|'||body||'|'||trim) AS vehicles,
           ifnull(SUM(aktiv), 0) AS aktiv
         FROM fahrzeugliste
         GROUP BY marke
         ORDER BY images DESC, marke
         LIMIT 10`,
      )
      .all(),
  ]);

  const k = kpiRow ?? {};
  const c = carRow ?? {};
  const num = (v: unknown) => Number(v ?? 0);
  const exteriorCars = num(c.cars);
  const haveMap = new Map<string, number>();
  for (const r of haveByView.results ?? []) {
    const o = r as Record<string, unknown>;
    haveMap.set(String(o.view ?? "").toLowerCase(), Number(o.have ?? 0));
  }
  const missingByView = EXTERIOR_ORDER.map((v) => {
    const have = haveMap.get(v) ?? 0;
    return { view: v, have, fehlt: Math.max(0, exteriorCars - have) };
  });

  const cars = num(c.cars);
  return jsonResponse({
    empty: num(k.images) === 0,
    kpis: {
      cars,
      variants: num(k.variants),
      images: num(k.images),
      marken: num(k.marken),
      aktiv: num(k.aktiv),
      fehler: num(k.fehler),
      hold: num(k.hold),
      nicht_gerendert: num(k.nicht_gerendert),
    },
    completeness: {
      aussen_komplett: num(c.aussen_komplett),
      aussen_unvollstaendig: num(c.aussen_unvollstaendig),
      innen_komplett: num(c.innen_komplett),
      innen_teilweise: num(c.innen_teilweise),
      innen_keine: num(c.innen_keine),
      mit_transparenz: cars - num(c.ohne_transparenz),
      ohne_transparenz: num(c.ohne_transparenz),
      mit_schatten: cars - num(c.ohne_schatten),
      ohne_schatten: num(c.ohne_schatten),
    },
    stages: {
      gesamt: num(k.images),
      kontrolliert: num(k.kontrolliert),
      ausgeschnitten: num(k.ausgeschnitten),
      skaliert: num(k.skaliert),
      aktiv: num(k.aktiv),
    },
    exteriorCars,
    missingByView,
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
  // Exakte Gleichheit: marke, format.
  for (const col of ["marke", "format"] as const) {
    const raw = (p.get(col) || "").trim();
    if (raw) {
      where.push(`lower(${col}) = ?`);
      binds.push(raw.toLowerCase());
    }
  }
  // LIKE %…%: modell, body, trim, farbe (Text), resolution.
  for (const col of ["modell", "body", "trim", "farbe", "resolution"] as const) {
    const pat = likePattern(p.get(col) || "");
    if (pat) {
      where.push(`${col} LIKE ?`);
      binds.push(pat);
    }
  }
  // Mehrfach-Farben (farben=comma, exakte Werte).
  const farbenList = (p.get("farben") || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (farbenList.length) {
    where.push(`lower(farbe) IN (${farbenList.map(() => "?").join(", ")})`);
    binds.push(...farbenList);
  }
  // Jahr: exakt + Bereich (von/bis).
  const jahrExact = Number((p.get("jahr") || "").trim());
  if (Number.isFinite(jahrExact) && jahrExact > 0) {
    where.push("jahr = ?");
    binds.push(jahrExact);
  }
  const jahrMin = Number((p.get("jahr_min") || "").trim());
  if (Number.isFinite(jahrMin) && jahrMin > 0) {
    where.push("jahr >= ?");
    binds.push(jahrMin);
  }
  const jahrMax = Number((p.get("jahr_max") || "").trim());
  if (Number.isFinite(jahrMax) && jahrMax > 0) {
    where.push("jahr <= ?");
    binds.push(jahrMax);
  }
  // Stand (last_updated) Datum von/bis (YYYY-MM-DD, UTC).
  const updFrom = (p.get("updated_from") || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(updFrom)) {
    where.push("date(last_updated) >= ?");
    binds.push(updFrom);
  }
  const updTo = (p.get("updated_to") || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(updTo)) {
    where.push("date(last_updated) <= ?");
    binds.push(updTo);
  }

  // Status-Filter → HAVING auf den Aggregaten.
  const statusRaw = (p.get("status") || "all").toLowerCase();
  const status: StatusKey = (STATUS_KEYS as readonly string[]).includes(
    statusRaw,
  )
    ? (statusRaw as StatusKey)
    : "all";
  const having: string[] = [];
  if (status === "incomplete_ext") having.push(`${AUSSEN_COUNT_SQL} < 8`);
  else if (status === "incomplete_int") having.push(`${INNEN_COUNT_SQL} = 1`);
  else if (status === "no_transparent") having.push(`${HAS_TRP_SQL} = 0`);
  else if (status === "no_shadow") having.push(`${HAS_SHADOW_SQL} = 0`);
  else if (status === "error") having.push("SUM(fehler) > 0");
  else if (status === "hold") having.push("SUM(hold) > 0");
  else if (status === "not_rendered")
    having.push(`SUM(CASE WHEN ${NOT_RENDERED} THEN 1 ELSE 0 END) > 0`);

  // HAVING-Binds (Reihenfolge = Reihenfolge der HAVING-Klauseln) kommen NACH den WHERE-Binds.
  const havingBinds: (string | number)[] = [];
  // View-Filter → nur Autos, denen diese Ansicht ganz FEHLT.
  const view = (p.get("view") || "").trim().toLowerCase();
  if (view) {
    having.push('COUNT(DISTINCT CASE WHEN lower("view") = ? THEN 1 END) = 0');
    havingBinds.push(view);
  }
  // Ansichten-Anzahl (gesamt) min/max.
  const viewsMin = Number((p.get("views_min") || "").trim());
  if (Number.isFinite(viewsMin) && viewsMin > 0) {
    having.push('COUNT(DISTINCT "view") >= ?');
    havingBinds.push(viewsMin);
  }
  const viewsMax = Number((p.get("views_max") || "").trim());
  if (Number.isFinite(viewsMax) && viewsMax > 0) {
    having.push('COUNT(DISTINCT "view") <= ?');
    havingBinds.push(viewsMax);
  }

  const whereSql = where.length ? ` WHERE ${where.join(" AND ")}` : "";
  const havingSql = having.length ? ` HAVING ${having.join(" AND ")}` : "";

  const limit = Math.min(100, Math.max(1, Number(p.get("limit") || 30)));
  const offset = Math.max(0, Number(p.get("offset") || 0));

  // Sortierung (Whitelist gegen Injection; Spalten-Aliase erlaubt).
  // Tie-Breaker marke, modell, jahr, body, trim am Ende → vollständig
  // deterministisch; gleichnamige Modelle bleiben gruppiert und nach Jahr
  // aufsteigend (Standard-Sort), nicht durcheinander.
  const SORTS: Record<string, string> = {
    marke: "marke, modell, jahr, body, trim",
    jahr_desc: "jahr DESC, marke, modell, body, trim",
    jahr_asc: "jahr ASC, marke, modell, body, trim",
    aussen_asc: "aussen ASC, marke, modell, jahr, body, trim",
    bilder_desc: "images DESC, marke, modell, jahr, body, trim",
    updated_desc: "last_updated DESC, marke, modell, jahr, body, trim",
  };
  const orderBy = SORTS[(p.get("sort") || "marke").toLowerCase()] || SORTS.marke;

  // Gesamtzahl der Gruppen (für Pagination).
  const countSql = `SELECT COUNT(*) AS n FROM (
    SELECT 1 FROM fahrzeugliste${whereSql}
    GROUP BY marke, modell, jahr, body, trim${havingSql}
  )`;
  // EINE Zeile pro Auto (ohne Farbe). farbe = repräsentative Farbe fürs Thumbnail
  // (bevorzugt „default"); farben = Anzahl Varianten; aussen/innen = vorhandene
  // Außen-/Innen-Ansichten; has_trp/has_shadow = Transparenz/Schatten vorhanden.
  const listSql = `SELECT
      marke, modell, jahr, body, trim,
      COALESCE(MAX(CASE WHEN lower(farbe) = 'default' THEN farbe END), MIN(farbe)) AS farbe,
      COUNT(DISTINCT farbe) AS farben,
      COUNT(*) AS images,
      COUNT(DISTINCT "view") AS views_total,
      ${AUSSEN_COUNT_SQL} AS aussen,
      ${INNEN_COUNT_SQL} AS innen,
      ${HAS_TRP_SQL} AS has_trp,
      ${HAS_SHADOW_SQL} AS has_shadow,
      ifnull(SUM(fehler), 0) AS fehler,
      ifnull(SUM(hold), 0) AS hold,
      ifnull(SUM(CASE WHEN ${NOT_RENDERED} THEN 1 ELSE 0 END), 0) AS nicht_gerendert,
      MAX(last_updated) AS last_updated
    FROM fahrzeugliste${whereSql}
    GROUP BY marke, modell, jahr, body, trim${havingSql}
    ORDER BY ${orderBy}
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
      farben: Number(o.farben ?? 0),
      images: Number(o.images ?? 0),
      viewsTotal: Number(o.views_total ?? 0),
      aussen: Number(o.aussen ?? 0),
      innen: Number(o.innen ?? 0),
      hasTrp: Number(o.has_trp ?? 0) > 0,
      hasShadow: Number(o.has_shadow ?? 0) > 0,
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

/**
 * Galerie: N Autos (zufällig oder sortiert), optional gefiltert (Marke/Jahr) und
 * eingeschränkt auf Autos, die die gewählte Ansicht wirklich haben. Liefert nur
 * die Auto-Identität (+ repräsentative Farbe) — die Bilder lädt das Frontend
 * über den Thumbnail-Proxy. `seed` (vom Frontend) bricht nur den useApi-Cache,
 * damit „Würfeln" eine neue Zufallsauswahl liefert.
 */
async function handleGallery(db: D1Database, url: URL): Promise<Response> {
  const p = url.searchParams;
  const where: string[] = [];
  const binds: (string | number)[] = [];

  const marke = (p.get("marke") || "").trim();
  if (marke) {
    where.push("lower(marke) = ?");
    binds.push(marke.toLowerCase());
  }
  const jahrMin = Number((p.get("jahr_min") || "").trim());
  if (Number.isFinite(jahrMin) && jahrMin > 0) {
    where.push("jahr >= ?");
    binds.push(jahrMin);
  }
  const jahrMax = Number((p.get("jahr_max") || "").trim());
  if (Number.isFinite(jahrMax) && jahrMax > 0) {
    where.push("jahr <= ?");
    binds.push(jahrMax);
  }

  // Nur Autos, die die gewählte Ansicht haben (sonst nur Platzhalter).
  const view = (p.get("view") || "").trim().toLowerCase();
  const havingBinds: (string | number)[] = [];
  let havingSql = "";
  if (view) {
    havingSql = ` HAVING COUNT(DISTINCT CASE WHEN lower("view") = ? THEN 1 END) > 0`;
    havingBinds.push(view);
  }

  const whereSql = where.length ? ` WHERE ${where.join(" AND ")}` : "";
  const limit = Math.min(60, Math.max(1, Number(p.get("limit") || 24)));
  const random = (p.get("random") || "1") !== "0";
  const orderBy = random ? "RANDOM()" : "marke, modell, jahr";

  const sql = `SELECT marke, modell, jahr, body, trim,
      COALESCE(MAX(CASE WHEN lower(farbe) = 'default' THEN farbe END), MIN(farbe)) AS farbe,
      COUNT(DISTINCT farbe) AS farben
    FROM fahrzeugliste${whereSql}
    GROUP BY marke, modell, jahr, body, trim${havingSql}
    ORDER BY ${orderBy}
    LIMIT ?`;

  const res = await db
    .prepare(sql)
    .bind(...binds, ...havingBinds, limit)
    .all();

  const rows = (res.results ?? []).map((r) => {
    const o = r as Record<string, unknown>;
    return {
      marke: String(o.marke ?? ""),
      modell: String(o.modell ?? ""),
      jahr: Number(o.jahr ?? 0),
      body: String(o.body ?? ""),
      trim: String(o.trim ?? ""),
      farbe: String(o.farbe ?? ""),
      farben: Number(o.farben ?? 0),
    };
  });

  return jsonResponse({ rows, count: rows.length });
}
