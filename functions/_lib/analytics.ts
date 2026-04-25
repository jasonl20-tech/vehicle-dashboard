/**
 * Cloudflare-Analytics-Engine-Helper für die `key_analytics` Datenquelle.
 *
 * Spalten-Mapping (so wie sie in deinen Beispielzeilen vorkommen):
 *   _sample_interval  – System-Spalte, Sampling-Faktor
 *   timestamp         – System-Spalte, Event-Zeit (UTC)
 *   index1            – API-Key (kurz, z. B. "VI-…", "anonymous", Hash)
 *   blob1             – Request-Pfad ("/api/Audi/A8/2014/Basis/base/front_left")
 *   blob2             – API-Key (vollständige Form/Hash)
 *   blob3             – Marke ("Audi", "BMW", "NA")
 *   blob4             – Modell ("A8", "X5", "NA")
 *   blob5             – Action / View ("front_left", "list_brands", …)
 *   blob6             – Status-Text ("OK", "Unknown Endpoint", …)
 *   blob7             – Environment ("production")
 *   double1           – HTTP-Status-Code (200, 404, …)
 *   double2           – Anwendungsseitiger Counter (idR 1)
 *
 * Wichtig: für die "echte" Anzahl Requests immer
 *   SUM(_sample_interval)
 * benutzen – Analytics Engine sampelt, und der Faktor pro Zeile steht in
 * `_sample_interval`.
 */

import type { AuthEnv } from "./auth";

export const KEY_ANALYTICS_DATASET = "key_analytics";

/** Keys, die NICHT als Kunden zählen sollen. */
export const EXCLUDED_KEYS: ReadonlyArray<string> = [
  "anonymous",
  "e6dd0c88a1486d7aeb2d0e7a6423ac31",
];

export type AeRow = Record<string, unknown>;

export interface AeResponse<T extends AeRow = AeRow> {
  meta: { name: string; type: string }[];
  data: T[];
  rows: number;
  rows_before_limit_at_least?: number;
}

function getToken(env: AuthEnv): string | null {
  return env.CF_API_TOKEN || env.CF_APi_TOKEN || null;
}

/**
 * Führt eine SQL-Query gegen die Analytics-Engine SQL-API aus.
 * Die Query MUSS bereits sicher gebaut sein (alle User-Inputs escaped),
 * dieser Helper macht keine eigene Validierung.
 */
export async function runAeSql<T extends AeRow = AeRow>(
  env: AuthEnv,
  sql: string,
): Promise<AeResponse<T>> {
  const accountId = env.CF_ACCOUNT_ID;
  const token = getToken(env);

  if (!accountId || !token) {
    throw new Error(
      "CF_ACCOUNT_ID oder CF_API_TOKEN fehlt im Pages-Environment. " +
        "Bitte beide Variablen im Cloudflare-Dashboard setzen.",
    );
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(
    accountId,
  )}/analytics_engine/sql`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "text/plain;charset=UTF-8",
      Accept: "application/json",
    },
    body: sql,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Analytics Engine SQL fehlgeschlagen (${res.status}): ${text.slice(
        0,
        500,
      )}\n--- Query ---\n${sql}`,
    );
  }

  // AE liefert standardmäßig JSON nach diesem Schema:
  // { meta: [...], data: [...], rows, rows_before_limit_at_least }
  const json = (await res.json()) as AeResponse<T>;
  return json;
}

// ---------- SQL-Building Helpers ----------

/** Escape eines Strings für SQL-String-Literale. Verdoppelt einfache Quotes. */
export function sqlString(input: string): string {
  return "'" + String(input).replace(/'/g, "''") + "'";
}

/**
 * Akzeptiert:
 *   "YYYY-MM-DD"
 *   "YYYY-MM-DD HH:MM:SS"
 *   ISO mit T und Z (wird normalisiert)
 *
 * Liefert eine Form, die die Analytics Engine als Timestamp parsen kann.
 */
export function sqlDateTime(input: string): string {
  const s = String(input).trim();
  // ISO mit T → tausche T gegen Leerzeichen, kürze auf 'YYYY-MM-DD HH:MM:SS'
  let normalised = s
    .replace("T", " ")
    .replace(/\.\d+$/, "")
    .replace(/Z$/, "")
    .replace(/[+-]\d{2}:?\d{2}$/, "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalised)) {
    normalised += " 00:00:00";
  }
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(normalised)) {
    throw new Error(`Ungültiger Zeitstempel: ${input}`);
  }
  return `toDateTime(${sqlString(normalised)})`;
}

/** Liefert ein WHERE-Snippet mit Zeit-Range + Excluded-Keys. */
export function whereCustomerWindow(
  fromIso: string,
  toIso: string,
  extra?: string,
): string {
  const excluded = EXCLUDED_KEYS.map(sqlString).join(", ");
  const parts = [
    `timestamp >= ${sqlDateTime(fromIso)}`,
    `timestamp <  ${sqlDateTime(toIso)}`,
    `index1 NOT IN (${excluded})`,
    `index1 != ''`,
  ];
  if (extra) parts.push(extra);
  return "WHERE " + parts.join(" AND ");
}

/**
 * Wählt eine sinnvolle Bucket-Größe für die Time-Series anhand der
 * Range-Länge.
 */
export function pickBucket(
  fromIso: string,
  toIso: string,
): { interval: string; sql: string; label: "minute" | "hour" | "day" } {
  const fromMs = Date.parse(fromIso.replace(" ", "T"));
  const toMs = Date.parse(toIso.replace(" ", "T"));
  const span = Math.max(0, toMs - fromMs);
  const HOUR = 60 * 60 * 1000;
  const DAY = 24 * HOUR;
  if (span <= 3 * HOUR) {
    return {
      interval: "5 MINUTE",
      sql: "toStartOfInterval(timestamp, INTERVAL '5' MINUTE)",
      label: "minute",
    };
  }
  if (span <= 2 * DAY) {
    return {
      interval: "1 HOUR",
      sql: "toStartOfInterval(timestamp, INTERVAL '1' HOUR)",
      label: "hour",
    };
  }
  if (span <= 14 * DAY) {
    return {
      interval: "6 HOUR",
      sql: "toStartOfInterval(timestamp, INTERVAL '6' HOUR)",
      label: "hour",
    };
  }
  return {
    interval: "1 DAY",
    sql: "toStartOfInterval(timestamp, INTERVAL '1' DAY)",
    label: "day",
  };
}
