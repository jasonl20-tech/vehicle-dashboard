/**
 * Demo-Links: öffentliche, ablaufende, eng begrenzte Showcase-Links für Kunden.
 *
 * Speicher: D1 `website` (Binding `env.website`), Tabelle `demo_links` (wird
 * idempotent per `CREATE TABLE IF NOT EXISTS` angelegt — keine separate Migration
 * nötig). Ein Token (`dl_…`, 128 Bit Zufall) ist der Schlüssel; die Konfiguration
 * (erlaubte Farben + Fahrzeug-Snapshot) liegt im Datensatz.
 *
 * Sicherheitskern: Der Bild-Proxy prüft JEDE Demo-Bildanfrage serverseitig gegen
 * diesen Datensatz (Fahrzeug + Farbe im erlaubten Scope) BEVOR er den internen
 * Voll-Key nutzt — und zählt echte Kunden-API-Aufrufe (Cache-MISS) gegen ein
 * Tageslimit pro Link.
 */

import type { AuthEnv } from "./auth";

export type DemoCar = {
  marke: string;
  modell: string;
  jahr: number;
  body: string;
  trim: string;
};

export type DemoLinkConfig = {
  token: string;
  name: string;
  allowedColors: string[];
  featured: DemoCar[];
  showroom: DemoCar[];
  status: "active" | "revoked";
  createdAt: number;
  expiresAt: number;
};

/** Max. echte Bild-Abrufe (Cache-MISS = Kunden-API-Aufruf) pro Tag und Link. */
export const DEMO_DAILY_MISS_CAP = 500;

/**
 * Erlaubte Bild-Breiten im Demo-Modus. Demo-Bildanfragen werden auf die
 * nächstgelegene dieser Breiten „eingerastet" → ein Token kann NICHT durch
 * beliebige `w`-Werte den Cache umgehen und so massenhaft teure Voll-Key-
 * Renderings auslösen. (Entspricht den Breiten, die die Demo wirklich nutzt.)
 */
export const DEMO_ALLOWED_WIDTHS = [110, 260, 380, 480, 560, 720, 1100, 1500];

export function snapDemoWidth(w: number): number {
  let best = DEMO_ALLOWED_WIDTHS[0];
  let bestDiff = Infinity;
  for (const cand of DEMO_ALLOWED_WIDTHS) {
    const d = Math.abs(cand - w);
    if (d < bestDiff) {
      bestDiff = d;
      best = cand;
    }
  }
  return best;
}

/** „default" (+ leer) ist immer erlaubt — die Demo nutzt es intern (Showroom/360/…). */
const ALWAYS_ALLOWED_COLORS = new Set(["default", ""]);

function db(env: AuthEnv): D1Database {
  const d = env.website;
  if (!d) throw new Error("D1-Binding `website` fehlt (Demo-Links).");
  return d;
}

/** Normalisierter Vergleichsschlüssel eines Fahrzeugs (Backend == Frontend-Logik). */
export function demoCarKey(c: {
  marke?: string | null;
  modell?: string | null;
  jahr?: number | string | null;
  body?: string | null;
  trim?: string | null;
}): string {
  return [c.marke, c.modell, c.jahr, c.body, c.trim]
    .map((x) => String(x ?? "").trim().toLowerCase())
    .join("|");
}

function randomToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let s = "";
  for (const b of bytes) s += b.toString(16).padStart(2, "0");
  return `dl_${s}`;
}

async function ensureTable(d: D1Database): Promise<void> {
  await d
    .prepare(
      `CREATE TABLE IF NOT EXISTS demo_links (
        token TEXT PRIMARY KEY,
        name TEXT NOT NULL DEFAULT '',
        allowed_colors TEXT NOT NULL DEFAULT '[]',
        featured TEXT NOT NULL DEFAULT '[]',
        showroom TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'active',
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        created_by INTEGER,
        hits INTEGER NOT NULL DEFAULT 0,
        hits_day TEXT,
        hits_today INTEGER NOT NULL DEFAULT 0,
        last_used_at INTEGER
      )`,
    )
    .run();
}

type Row = {
  token: string;
  name: string | null;
  allowed_colors: string | null;
  featured: string | null;
  showroom: string | null;
  status: string | null;
  created_at: number;
  expires_at: number;
  hits: number | null;
  hits_today: number | null;
  last_used_at: number | null;
};

function parseArr<T>(s: string | null): T[] {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
}

function rowToConfig(r: Row): DemoLinkConfig {
  return {
    token: r.token,
    name: r.name ?? "",
    allowedColors: parseArr<string>(r.allowed_colors),
    featured: parseArr<DemoCar>(r.featured),
    showroom: parseArr<DemoCar>(r.showroom),
    status: r.status === "revoked" ? "revoked" : "active",
    createdAt: Number(r.created_at) || 0,
    expiresAt: Number(r.expires_at) || 0,
  };
}

function sanitizeColors(input: unknown): string[] {
  const arr = Array.isArray(input) ? input : [];
  return Array.from(
    new Set(
      arr
        .map((c) => String(c ?? "").trim().toLowerCase())
        .filter((c) => c && !ALWAYS_ALLOWED_COLORS.has(c)),
    ),
  ).slice(0, 24);
}

export function sanitizeCars(input: unknown): DemoCar[] {
  if (!Array.isArray(input)) return [];
  const out: DemoCar[] = [];
  for (const c of input) {
    if (!c || typeof c !== "object") continue;
    const o = c as Record<string, unknown>;
    const marke = String(o.marke ?? "").trim();
    const modell = String(o.modell ?? "").trim();
    const jahr = Number(o.jahr);
    if (!marke || !modell || !jahr) continue;
    out.push({
      marke,
      modell,
      jahr,
      body: String(o.body ?? "Basis").trim() || "Basis",
      trim: String(o.trim ?? "base").trim() || "base",
    });
  }
  return out.slice(0, 80);
}

export async function createDemoLink(
  env: AuthEnv,
  input: {
    name: string;
    allowedColors: unknown;
    featured: unknown;
    showroom: unknown;
    expiresInDays: number;
    createdBy?: number | null;
  },
): Promise<{ ok: true; link: DemoLinkConfig } | { ok: false; error: string }> {
  const colors = sanitizeColors(input.allowedColors);
  if (!colors.length) return { ok: false, error: "Mindestens eine Farbe wählen." };
  const featured = sanitizeCars(input.featured);
  const showroom = sanitizeCars(input.showroom);
  if (!featured.length && !showroom.length) {
    return { ok: false, error: "Keine Fahrzeuge übergeben." };
  }
  const days = Math.min(365, Math.max(1, Math.floor(Number(input.expiresInDays) || 7)));
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + days * 86400;
  const token = randomToken();
  const name = String(input.name ?? "").slice(0, 120);

  const d = db(env);
  await ensureTable(d);
  await d
    .prepare(
      `INSERT INTO demo_links
        (token, name, allowed_colors, featured, showroom, status, created_at, expires_at, created_by)
       VALUES (?1, ?2, ?3, ?4, ?5, 'active', ?6, ?7, ?8)`,
    )
    .bind(
      token,
      name,
      JSON.stringify(colors),
      JSON.stringify(featured),
      JSON.stringify(showroom),
      now,
      expiresAt,
      input.createdBy ?? null,
    )
    .run();

  return {
    ok: true,
    link: {
      token,
      name,
      allowedColors: colors,
      featured,
      showroom,
      status: "active",
      createdAt: now,
      expiresAt,
    },
  };
}

export type DemoLinkListItem = DemoLinkConfig & {
  hitsToday: number;
  lastUsedAt: number | null;
  expired: boolean;
};

export async function listDemoLinks(env: AuthEnv): Promise<DemoLinkListItem[]> {
  const d = db(env);
  await ensureTable(d);
  const { results } = await d
    .prepare(
      `SELECT token, name, allowed_colors, featured, showroom, status,
              created_at, expires_at, hits, hits_today, last_used_at
       FROM demo_links ORDER BY created_at DESC LIMIT 200`,
    )
    .all<Row>();
  const now = Math.floor(Date.now() / 1000);
  return (results ?? []).map((r) => ({
    ...rowToConfig(r),
    hitsToday: Number(r.hits_today) || 0,
    lastUsedAt: r.last_used_at != null ? Number(r.last_used_at) : null,
    expired: (Number(r.expires_at) || 0) < now,
  }));
}

export async function revokeDemoLink(env: AuthEnv, token: string): Promise<boolean> {
  if (!token) return false;
  const d = db(env);
  await ensureTable(d);
  const res = await d
    .prepare(`UPDATE demo_links SET status = 'revoked' WHERE token = ?1`)
    .bind(token)
    .run();
  return (res.meta?.changes ?? 0) > 0;
}

/** Lädt einen Link für die öffentliche Nutzung — nur wenn aktiv UND nicht abgelaufen. */
export async function getValidDemoLink(
  env: AuthEnv,
  token: string,
): Promise<DemoLinkConfig | null> {
  if (!token || !token.startsWith("dl_")) return null;
  let row: Row | null = null;
  try {
    row = await db(env)
      .prepare(
        `SELECT token, name, allowed_colors, featured, showroom, status,
                created_at, expires_at, hits, hits_today, last_used_at
         FROM demo_links WHERE token = ?1`,
      )
      .bind(token)
      .first<Row>();
  } catch {
    // Tabelle existiert evtl. noch nicht → wie „nicht gefunden".
    return null;
  }
  if (!row) return null;
  const cfg = rowToConfig(row);
  if (cfg.status !== "active") return null;
  if (cfg.expiresAt < Math.floor(Date.now() / 1000)) return null;
  return cfg;
}

export function demoColorAllowed(cfg: DemoLinkConfig, farbe: string): boolean {
  const c = String(farbe ?? "").trim().toLowerCase();
  if (ALWAYS_ALLOWED_COLORS.has(c)) return true;
  return cfg.allowedColors.includes(c);
}

export function demoCarAllowed(
  cfg: DemoLinkConfig,
  car: {
    marke: string;
    modell: string;
    jahr: string | number;
    body: string;
    trim: string;
  },
): boolean {
  const key = demoCarKey(car);
  for (const c of cfg.featured) if (demoCarKey(c) === key) return true;
  for (const c of cfg.showroom) if (demoCarKey(c) === key) return true;
  return false;
}

// ============================================================================
// Bild-URL-Cache + Vorwärmen
// ============================================================================
//
// Messung: Die Kunden-API braucht ~2,5 s, um eine signierte CDN-Bild-URL zu
// liefern — und dieser Aufruf fällt im Bild-Proxy bei JEDEM Cache-MISS an (der
// Edge-Cache ist pro Rechenzentrum getrennt). Die URL ist aber 7 Tage gültig
// und für alle identisch. Darum cachen wir sie GLOBAL in D1 (`demo_image_urls`):
// Der Proxy liest sie dort und spart den langsamen API-Aufruf — über alle
// Standorte und über die Lebensdauer des Edge-Caches hinaus.
//
// Beim Erstellen eines Links werden zusätzlich die wichtigsten „Cover"-Bilder
// vorgewärmt (URL geholt + gespeichert + CDN-Objekt erzeugt: CDN-Erstabruf
// ~4,4 s → danach ~0,9 s), damit schon der ERSTE Besuch des Kunden schnell ist.

const CAR_API_BASE = "https://api.vehicleimagery.com";

/**
 * Größen-UNabhängiger Varianten-Schlüssel für den URL-Cache (die CDN-URL hängt
 * NICHT von der Breite ab — das Verkleinern macht cf.image im Proxy). MUSS in
 * Proxy (Lesen/Schreiben) und Vorwärmen identisch gebildet werden, sonst
 * verfehlen sich die Zugriffe. `transparency` ist effektiv (transparent ODER
 * ground ODER mirroring brauchen die transparente Variante).
 */
export function imageVariantKey(
  v: {
    marke: string;
    modell: string;
    jahr: number | string;
    body: string;
    trim: string;
    view: string;
    farbe: string;
    format: string;
    shadow?: boolean;
    transparent?: boolean;
    ground?: boolean;
    mirroring?: boolean;
  },
  hasMirroringKey: boolean,
): string {
  const transparency = !!(v.transparent || v.ground || v.mirroring);
  return [
    v.marke,
    v.modell,
    v.jahr,
    v.body,
    v.trim,
    v.view,
    v.farbe,
    v.format,
    v.shadow ? "sh" : "",
    transparency ? "tr" : "",
    v.ground ? "gr" : "",
    v.mirroring ? "mi" : "",
    v.mirroring && hasMirroringKey ? "mk" : "",
  ]
    .map((x) => String(x ?? "").trim().toLowerCase())
    .join("|");
}

/** Liest den `expire`-Zeitstempel (Unix-Sekunden) aus einer signierten CDN-URL. */
export function parseCdnExpire(url: string): number {
  try {
    const q = new URL(url).searchParams;
    const e = Number(q.get("expire") || q.get("expires") || 0);
    return Number.isFinite(e) && e > 0 ? Math.floor(e) : 0;
  } catch {
    return 0;
  }
}

async function ensureImageUrlTable(d: D1Database): Promise<void> {
  await d
    .prepare(
      `CREATE TABLE IF NOT EXISTS demo_image_urls (
        vkey TEXT PRIMARY KEY,
        image_url TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      )`,
    )
    .run();
}

/** Gecachte signierte Bild-URL (oder null, wenn fehlend/fast abgelaufen). */
export async function getCachedImageUrl(
  env: AuthEnv,
  vkey: string,
): Promise<string | null> {
  try {
    const row = await db(env)
      .prepare(`SELECT image_url, expires_at FROM demo_image_urls WHERE vkey = ?1`)
      .bind(vkey)
      .first<{ image_url: string; expires_at: number }>();
    if (!row) return null;
    // Puffer: fast abgelaufene Links (≤ 10 Min Restlaufzeit) nicht mehr ausliefern.
    if ((Number(row.expires_at) || 0) < Math.floor(Date.now() / 1000) + 600) {
      return null;
    }
    return row.image_url || null;
  } catch {
    // Tabelle evtl. noch nicht angelegt → wie „nicht gefunden" (Proxy fragt API).
    return null;
  }
}

/** Speichert eine signierte Bild-URL global (best effort). */
export async function putCachedImageUrl(
  env: AuthEnv,
  vkey: string,
  imageUrl: string,
  expiresAt: number,
): Promise<void> {
  try {
    const d = db(env);
    await ensureImageUrlTable(d);
    const exp = expiresAt > 0 ? expiresAt : Math.floor(Date.now() / 1000) + 6 * 86400;
    await d
      .prepare(
        `INSERT INTO demo_image_urls (vkey, image_url, expires_at) VALUES (?1, ?2, ?3)
         ON CONFLICT(vkey) DO UPDATE SET image_url = excluded.image_url, expires_at = excluded.expires_at`,
      )
      .bind(vkey, imageUrl, exp)
      .run();
  } catch {
    /* best effort — Vorwärmen/Cachen darf nie eine Anfrage scheitern lassen. */
  }
}

/** Führt `fn` über `items` mit begrenzter Nebenläufigkeit aus (best effort). */
async function runLimited<T>(
  items: T[],
  limit: number,
  fn: (t: T) => Promise<void>,
): Promise<void> {
  let i = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (i < items.length) {
        const idx = i++;
        try {
          await fn(items[idx]);
        } catch {
          /* best effort */
        }
      }
    },
  );
  await Promise.all(workers);
}

/** Ansichten für die Hero-Rotation (8 Außen + 2 Innen). */
const WARM_VIEWS = [
  "front_left",
  "front",
  "front_right",
  "right",
  "rear_right",
  "rear",
  "rear_left",
  "left",
  "dashboard",
  "center_console",
];

/**
 * Wärmt die wichtigsten „Cover"-Bilder eines neuen Links vor: holt die signierte
 * CDN-URL (spart später den ~2,5 s-API-Aufruf), legt sie in den D1-Cache und
 * fordert das CDN-Bild einmal an (erzeugt das Objekt). Best effort, läuft im
 * Hintergrund (waitUntil) bis zum Zeit-/Subrequest-Budget — alles WebP/Default.
 */
export async function warmDemoLink(env: AuthEnv, cfg: DemoLinkConfig): Promise<void> {
  const apiKey = env.CAR_DB_API_KEY;
  if (!apiKey) return;
  const hasMk = !!env.CAR_DB_MIRRORING_KEY;
  const fmt = "webp";

  type Job = { car: DemoCar; view: string; farbe: string };
  const jobs: Job[] = [];
  const featured = cfg.featured ?? [];
  const showroom = cfg.showroom ?? [];

  // 1) Erstes Hero-Auto: alle Ansichten (Default-Farbe) → Hero-Rotation + Thumbs.
  if (featured[0]) {
    for (const view of WARM_VIEWS) {
      jobs.push({ car: featured[0], view, farbe: "default" });
    }
  }
  // 2) Weitere Hero-Autos: Titelansicht (Default) → Auto-Wechsel ist sofort da.
  for (const car of featured.slice(1)) {
    jobs.push({ car, view: "front_left", farbe: "default" });
  }
  // 3) Showroom: Titelansicht jedes Beispiel-Autos.
  for (const car of showroom) {
    jobs.push({ car, view: "front_left", farbe: "default" });
  }

  // Deckel gegen Subrequest-/Zeitbudget im waitUntil.
  const capped = jobs.slice(0, 26);
  const seg = (s: string | number) => encodeURIComponent(String(s));

  await runLimited(capped, 8, async (j) => {
    const apiUrl =
      `${CAR_API_BASE}/api/${seg(j.car.marke)}/${seg(j.car.modell)}/${seg(j.car.jahr)}/${seg(j.car.body)}/${seg(j.car.trim)}/${seg(j.view)}` +
      `?format=${fmt}&resolution=default&color=${seg(j.farbe)}`;
    let imageUrl = "";
    const r = await fetch(apiUrl, { headers: { "x-api-key": apiKey } });
    if (!r.ok) return;
    const data = (await r.json()) as unknown;
    const o = (Array.isArray(data) ? data[0] : data) as
      | Record<string, unknown>
      | null
      | undefined;
    const iu = o?.image_url;
    if (typeof iu === "string" && iu) imageUrl = iu;
    if (!imageUrl) return;

    const vkey = imageVariantKey(
      {
        marke: j.car.marke,
        modell: j.car.modell,
        jahr: j.car.jahr,
        body: j.car.body,
        trim: j.car.trim,
        view: j.view,
        farbe: j.farbe,
        format: fmt,
      },
      hasMk,
    );
    await putCachedImageUrl(env, vkey, imageUrl, parseCdnExpire(imageUrl));
    // CDN-Objekt erzeugen (warm). Body nicht lesen; Fehler/Timeout egal.
    try {
      await fetch(imageUrl, { cf: { cacheTtl: 86400 } } as RequestInit);
    } catch {
      /* egal — Vorwärmen ist best effort */
    }
  });
}

/**
 * Zählt einen echten Bild-Abruf (Cache-MISS) gegen das Tageslimit.
 * @returns false, wenn das Tageslimit überschritten ist (→ Aufrufer: 429).
 */
export async function recordDemoHit(env: AuthEnv, token: string): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  const now = Math.floor(Date.now() / 1000);
  try {
    const r = await db(env)
      .prepare(
        `UPDATE demo_links
         SET hits = hits + 1,
             hits_today = CASE WHEN hits_day = ?2 THEN hits_today + 1 ELSE 1 END,
             hits_day = ?2,
             last_used_at = ?3
         WHERE token = ?1
         RETURNING hits_today`,
      )
      .bind(token, today, now)
      .first<{ hits_today: number }>();
    return (Number(r?.hits_today ?? 0) || 0) <= DEMO_DAILY_MISS_CAP;
  } catch {
    // Kostenschutz: Bei Zähler-Fehler fail-CLOSED — lieber eine Demo-Anfrage
    // abweisen als den teuren Voll-Key ungebremst laufen lassen.
    return false;
  }
}
