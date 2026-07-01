/**
 * Kontroll-Plattform NEUES System — Quell-Bild-Freigabe.
 *
 * GET  /api/databases/car-control     → offene Autos (kontrolliert=0) zum Prüfen
 * POST /api/databases/car-control      → Aktion: freigeben / on-hold / Fehler
 *
 * Im neuen System ist Kontrolle = ein Mensch gibt das QUELL-Bild frei
 * (`kontrolliert 0 → 1`); danach übernimmt der Motor (Freistellen, Skalieren,
 * Schatten) automatisch. „Offen" = Quell-Zeilen mit `kontrolliert=0`
 * (transparent=0, shadow=0).
 *
 * Bilder zeigt das Frontend über `/api/databases/car-control-image?key=…`
 * (ID-basiert aus R2 `vehicleimages`).
 */

import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";

/** „Offen zur Kontrolle": Quell-Bild, noch nicht freigegeben. */
const OPEN_WHERE =
  "kontrolliert = 0 AND transparent = 0 AND shadow = 0";

const EXTERIOR = [
  "front",
  "rear",
  "left",
  "right",
  "front_left",
  "front_right",
  "rear_left",
  "rear_right",
];
const INTERIOR = ["dashboard", "center_console"];

function likePattern(raw: string): string | null {
  const v = raw.trim().replace(/[%_]/g, " ").replace(/\s+/g, " ").trim();
  return v ? `%${v}%` : null;
}

const num = (v: unknown): number => Number(v ?? 0) || 0;

/** mode=list — eine Zeile je Variante (marke|modell|jahr|body|trim|farbe) mit
 *  Zähl-Aggregaten (Quell-Ansichten: total/approved/open/error/hold) für die
 *  Sidebar (Badge + Fortschrittsbalken). */
async function listVariants(
  db: D1Database,
  p: URLSearchParams,
): Promise<Response> {
  const where = ["transparent = 0", "shadow = 0"];
  const binds: (string | number)[] = [];
  const q = likePattern(p.get("q") || "");
  if (q) {
    where.push("(marke LIKE ? OR modell LIKE ? OR (marke || ' ' || modell) LIKE ?)");
    binds.push(q, q, q);
  }
  const marke = (p.get("marke") || "").trim();
  if (marke) {
    where.push("lower(marke) = ?");
    binds.push(marke.toLowerCase());
  }
  const whereSql = `WHERE ${where.join(" AND ")}`;

  const status = (p.get("status") || "open").toLowerCase();
  const having =
    status === "open"
      ? "HAVING open > 0"
      : status === "open_ext"
        ? "HAVING open_ext > 0"
        : status === "open_int"
          ? "HAVING open_int > 0"
          : status === "done"
            ? "HAVING open = 0"
            : status === "error"
              ? "HAVING error > 0"
              : status === "hold"
                ? "HAVING hold > 0"
                : ""; // all

  const ORDER: Record<string, string> = {
    open_desc: "open DESC, marke, modell, jahr",
    updated_desc: "lastUpdated DESC",
    approved_desc: "approved DESC, marke, modell",
    hold_desc: "hold DESC, open DESC",
    error_desc: "error DESC, open DESC",
    total_desc: "total DESC",
    marke: "marke, modell, jahr",
  };
  const orderSql = `ORDER BY ${ORDER[p.get("sort") || "open_desc"] || ORDER.open_desc}`;
  const limit = Math.min(200, Math.max(1, Number(p.get("limit") || 50)));
  const offset = Math.max(0, Number(p.get("offset") || 0));

  const AGG = `
    SUM(CASE WHEN kontrolliert=1 THEN 1 ELSE 0 END) AS approved,
    SUM(CASE WHEN fehler=1 THEN 1 ELSE 0 END) AS error,
    SUM(CASE WHEN hold=1 THEN 1 ELSE 0 END) AS hold,
    SUM(CASE WHEN kontrolliert=0 AND fehler=0 AND hold=0 THEN 1 ELSE 0 END) AS open,
    SUM(CASE WHEN innen=0 AND kontrolliert=0 AND fehler=0 AND hold=0 THEN 1 ELSE 0 END) AS open_ext,
    SUM(CASE WHEN innen=1 AND kontrolliert=0 AND fehler=0 AND hold=0 THEN 1 ELSE 0 END) AS open_int`;
  const group = "GROUP BY marke, modell, jahr, body, trim, farbe";
  const sql = `SELECT marke, modell, jahr, body, trim, farbe,
      COUNT(*) AS total, ${AGG}, MAX(last_updated) AS lastUpdated
    FROM fahrzeugliste ${whereSql} ${group} ${having} ${orderSql} LIMIT ? OFFSET ?`;
  const countSql = `SELECT COUNT(*) AS n FROM (
    SELECT ${AGG} FROM fahrzeugliste ${whereSql} ${group} ${having})`;
  // „Übrig": Varianten mit noch offenen Ansichten (unabhängig vom Status-Filter).
  const remainingSql = `SELECT COUNT(*) AS n FROM (
    SELECT ${AGG} FROM fahrzeugliste ${whereSql} ${group} HAVING open > 0)`;

  const [countRow, remRow, res] = await Promise.all([
    db.prepare(countSql).bind(...binds).first<{ n: number }>(),
    db.prepare(remainingSql).bind(...binds).first<{ n: number }>(),
    db.prepare(sql).bind(...binds, limit, offset).all(),
  ]);
  const rows = (res.results ?? []).map((r) => {
    const o = r as Record<string, unknown>;
    return {
      marke: String(o.marke ?? ""),
      modell: String(o.modell ?? ""),
      jahr: num(o.jahr),
      body: String(o.body ?? ""),
      trim: String(o.trim ?? ""),
      farbe: String(o.farbe ?? ""),
      total: num(o.total),
      approved: num(o.approved),
      open: num(o.open),
      error: num(o.error),
      hold: num(o.hold),
      lastUpdated: o.lastUpdated ? String(o.lastUpdated) : null,
    };
  });
  return jsonResponse({
    total: num(countRow?.n),
    remaining: num(remRow?.n),
    rows,
    limit,
    offset,
  });
}

/** mode=detail — alle Quell-Ansichten EINER Variante fürs Raster + welche der
 *  8 Außen-/2 Innen-Ansichten fehlen (für „+"-Nachgenerieren). */
async function detailVariant(
  db: D1Database,
  p: URLSearchParams,
): Promise<Response> {
  const marke = (p.get("marke") || "").trim();
  const modell = (p.get("modell") || "").trim();
  const jahr = Number(p.get("jahr") || 0);
  if (!marke || !modell || !jahr) {
    return jsonResponse(
      { error: "marke, modell, jahr erforderlich." },
      { status: 400 },
    );
  }
  const where = ["transparent = 0", "shadow = 0", "marke = ?", "modell = ?", "jahr = ?"];
  const binds: (string | number)[] = [marke, modell, jahr];
  for (const f of ["body", "trim", "farbe"] as const) {
    const v = (p.get(f) || "").trim();
    if (v) {
      where.push(`${f} = ?`);
      binds.push(v);
    }
  }
  const res = await db
    .prepare(
      `SELECT id, "view" AS view, innen, kontrolliert, fehler, hold, hohe,
         original_r2_key, r2_key, last_updated
       FROM fahrzeugliste WHERE ${where.join(" AND ")} ORDER BY "view"`,
    )
    .bind(...binds)
    .all();
  const views = (res.results ?? []).map((r) => {
    const o = r as Record<string, unknown>;
    const imageKey =
      (o.original_r2_key ? String(o.original_r2_key) : "") ||
      (o.r2_key ? String(o.r2_key) : "");
    const fehler = num(o.fehler) === 1;
    const hold = num(o.hold) === 1;
    const approved = num(o.kontrolliert) === 1;
    const stateStatus = fehler
      ? "error"
      : hold
        ? "hold"
        : approved
          ? "approved"
          : "open";
    return {
      id: num(o.id),
      view: String(o.view ?? ""),
      innen: num(o.innen) === 1,
      approved,
      fehler,
      hold,
      status: stateStatus,
      hohe: o.hohe == null ? null : Number(o.hohe),
      imageKey,
      lastUpdated: o.last_updated ? String(o.last_updated) : null,
    };
  });
  const present = new Set(views.map((v) => v.view));
  return jsonResponse({
    identity: {
      marke,
      modell,
      jahr,
      body: (p.get("body") || "").trim(),
      trim: (p.get("trim") || "").trim(),
      farbe: (p.get("farbe") || "").trim(),
    },
    views,
    missingExt: EXTERIOR.filter((v) => !present.has(v)),
    missingInt: INTERIOR.filter((v) => !present.has(v)),
  });
}

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
      { error: "D1-Binding `cardb` fehlt." },
      { status: 503 },
    );
  }

  const p = new URL(request.url).searchParams;
  const mode = (p.get("mode") || "").toLowerCase();
  try {
    if (mode === "list") return await listVariants(db, p);
    if (mode === "detail") return await detailVariant(db, p);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/no such table|no such column/i.test(msg)) {
      return jsonResponse(
        mode === "detail"
          ? { views: [], missingExt: [], missingInt: [] }
          : { total: 0, rows: [] },
        { status: 200 },
      );
    }
    return jsonResponse({ error: msg }, { status: 500 });
  }
  const where = [OPEN_WHERE];
  const binds: (string | number)[] = [];

  const q = likePattern(p.get("q") || "");
  if (q) {
    where.push(
      "(marke LIKE ? OR modell LIKE ? OR (marke || ' ' || modell) LIKE ?)",
    );
    binds.push(q, q, q);
  }
  const marke = (p.get("marke") || "").trim();
  if (marke) {
    where.push("lower(marke) = ?");
    binds.push(marke.toLowerCase());
  }

  const whereSql = `WHERE ${where.join(" AND ")}`;
  const limit = Math.min(200, Math.max(1, Number(p.get("limit") || 60)));
  const offset = Math.max(0, Number(p.get("offset") || 0));

  try {
    const [countRow, rowsRes] = await Promise.all([
      db
        .prepare(`SELECT COUNT(*) AS n FROM fahrzeugliste ${whereSql}`)
        .bind(...binds)
        .first<{ n: number }>(),
      db
        .prepare(
          `SELECT id, marke, modell, jahr, body, trim, farbe, "view" AS view,
             innen, fehler, hold, hohe,
             original_r2_key, r2_key, created_at
           FROM fahrzeugliste ${whereSql}
           ORDER BY marke, modell, jahr, body, trim, farbe, "view"
           LIMIT ? OFFSET ?`,
        )
        .bind(...binds, limit, offset)
        .all(),
    ]);

    const rows = (rowsRes.results ?? []).map((r) => {
      const o = r as Record<string, unknown>;
      const imageKey =
        (o.original_r2_key ? String(o.original_r2_key) : "") ||
        (o.r2_key ? String(o.r2_key) : "");
      return {
        id: Number(o.id ?? 0),
        marke: String(o.marke ?? ""),
        modell: String(o.modell ?? ""),
        jahr: Number(o.jahr ?? 0),
        body: String(o.body ?? ""),
        trim: String(o.trim ?? ""),
        farbe: String(o.farbe ?? ""),
        view: String(o.view ?? ""),
        innen: Number(o.innen ?? 0) === 1,
        fehler: Number(o.fehler ?? 0) === 1,
        hold: Number(o.hold ?? 0) === 1,
        hohe: o.hohe == null ? null : Number(o.hohe),
        imageKey,
        createdAt: o.created_at ? String(o.created_at) : null,
      };
    });

    return jsonResponse({
      empty: rows.length === 0,
      total: Number(countRow?.n ?? 0),
      rows,
      limit,
      offset,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/no such table|no such column/i.test(msg)) {
      return jsonResponse({ empty: true, total: 0, rows: [] }, { status: 200 });
    }
    return jsonResponse({ error: msg }, { status: 500 });
  }
};

const ACTIONS = new Set(["approve", "hold", "error", "reset", "delete"]);

export const onRequestPost: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const db = env.cardb;
  if (!db) {
    return jsonResponse({ error: "D1-Binding `cardb` fehlt." }, { status: 503 });
  }

  let body: { action?: string; ids?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  const action = String(body.action || "").toLowerCase();
  if (!ACTIONS.has(action)) {
    return jsonResponse(
      { error: "action muss approve | hold | error | reset sein." },
      { status: 400 },
    );
  }
  const ids = Array.isArray(body.ids)
    ? body.ids.map((x) => Number(x)).filter((n) => Number.isInteger(n) && n > 0)
    : [];
  if (ids.length === 0) {
    return jsonResponse({ error: "ids (Liste) erforderlich." }, { status: 400 });
  }
  if (ids.length > 500) {
    return jsonResponse(
      { error: "Maximal 500 Einträge pro Aktion." },
      { status: 400 },
    );
  }

  const placeholders = ids.map(() => "?").join(",");

  // „delete": Quell-Zeile(n) + zugehörige R2-Objekte entfernen (schlechtes Bild
  // wegräumen, danach neu generieren). Nur Quell-Zeilen (transparent=0,shadow=0).
  if (action === "delete") {
    try {
      const sel = await db
        .prepare(
          `SELECT id, r2_key, original_r2_key FROM fahrzeugliste
           WHERE id IN (${placeholders}) AND transparent = 0 AND shadow = 0`,
        )
        .bind(...ids)
        .all();
      const found = (sel.results ?? []).map((r) => r as Record<string, unknown>);
      const delIds = found.map((o) => num(o.id)).filter((n) => n > 0);
      if (delIds.length === 0) {
        return jsonResponse({ ok: true, action, changed: 0 });
      }
      const ph = delIds.map(() => "?").join(",");
      const res = await db
        .prepare(`DELETE FROM fahrzeugliste WHERE id IN (${ph})`)
        .bind(...delIds)
        .run();
      const changed = (res as { meta?: { changes?: number } })?.meta?.changes ?? 0;
      // R2-Objekte löschen — aber NUR wenn keine andere (z. B. abgeleitete
      // transparent/shadow-)Zeile denselben Schlüssel via original_r2_key noch
      // referenziert (sonst würden diese zu Waisen mit 404). Zeilen sind oben
      // schon gelöscht; verbleibende Referenzen = andere Zeilen.
      const bucket = env.vehicleimages;
      if (bucket) {
        const keys = new Set<string>();
        for (const o of found) {
          for (const k of [o.r2_key, o.original_r2_key]) {
            if (k && /^(source|scaled|shadow)\//.test(String(k)))
              keys.add(String(k));
          }
        }
        for (const k of keys) {
          const ref = await db
            .prepare(
              `SELECT COUNT(*) AS n FROM fahrzeugliste
               WHERE r2_key = ?1 OR original_r2_key = ?1`,
            )
            .bind(k)
            .first<{ n: number }>();
          if (Number(ref?.n ?? 0) === 0) await bucket.delete(k).catch(() => {});
        }
      }
      return jsonResponse({ ok: true, action, changed });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return jsonResponse({ error: msg }, { status: 500 });
    }
  }

  // SET je nach Aktion. Nur auf noch offene Quell-Zeilen anwenden.
  let setSql: string;
  if (action === "approve") setSql = "kontrolliert = 1, fehler = 0, hold = 0";
  else if (action === "hold") setSql = "hold = 1";
  else if (action === "error") setSql = "fehler = 1";
  else setSql = "kontrolliert = 0, fehler = 0, hold = 0"; // reset

  try {
    const res = await db
      .prepare(
        `UPDATE fahrzeugliste
           SET ${setSql}, last_updated = CURRENT_TIMESTAMP
         WHERE id IN (${placeholders})
           AND transparent = 0 AND shadow = 0`,
      )
      .bind(...ids)
      .run();
    const changed = (res as { meta?: { changes?: number } })?.meta?.changes ?? 0;
    return jsonResponse({ ok: true, action, changed });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: msg }, { status: 500 });
  }
};
