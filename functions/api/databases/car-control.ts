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

function likePattern(raw: string): string | null {
  const v = raw.trim().replace(/[%_]/g, " ").replace(/\s+/g, " ").trim();
  return v ? `%${v}%` : null;
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

const ACTIONS = new Set(["approve", "hold", "error", "reset"]);

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

  // SET je nach Aktion. Nur auf noch offene Quell-Zeilen anwenden.
  let setSql: string;
  if (action === "approve") setSql = "kontrolliert = 1, fehler = 0, hold = 0";
  else if (action === "hold") setSql = "hold = 1";
  else if (action === "error") setSql = "fehler = 1";
  else setSql = "kontrolliert = 0, fehler = 0, hold = 0"; // reset

  const placeholders = ids.map(() => "?").join(",");
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
