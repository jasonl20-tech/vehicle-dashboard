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

/** Zweites Analytics-Engine-Dataset (anderes Konto, gleiches Schema). */
export const API_ANALYTICS_DATASET = "api_analytics";

/** Welches Cloudflare-Konto + Token für `runAeSql` genutzt wird. */
export type AeAccountBinding = "primary" | "secondary";

/** Spezieller Key, der zur Oneauto-Abrechnung gehört (primäres Konto / key_analytics). */
export const ONEAUTO_KEY = "e6dd0c88a1486d7aeb2d0e7a6423ac31";

/**
 * Zweiter Oneauto-Key (z. B. anderes Konto, Dataset api_analytics).
 * Kurz: e6dd0c88…9c76b. Überschreibbar mit env `ONEAUTO_KEY_2`.
 */
export const ONEAUTO_KEY_ALT = "e6dd0c88a1486d7aeb2d0e7a0009c76b";

function parseOneautoKey2FromEnv(env: AuthEnv): string | null {
  const raw = env.ONEAUTO_KEY_2?.trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (!/^[0-9a-f]{32}$/i.test(lower)) return null;
  return lower;
}

/**
 * Alle `index1`-Werte, die logisch Oneauto zählen (beide Cloudflare-Keys, Reports + Oneauto-API-Modus).
 */
export function getOneautoKeys(env: AuthEnv): string[] {
  const fromEnv = parseOneautoKey2FromEnv(env);
  const second =
    fromEnv && fromEnv !== ONEAUTO_KEY ? fromEnv : ONEAUTO_KEY_ALT;
  return [ONEAUTO_KEY, second].filter((k, i, a) => a.indexOf(k) === i);
}

/** Kunden-Modus: filtert anonymous + alle Oneauto-Key-Varianten. */
export function getExcludedForCustomers(env: AuthEnv): string[] {
  return ["anonymous", ...getOneautoKeys(env)];
}

export type AeRow = Record<string, unknown>;

export interface AeResponse<T extends AeRow = AeRow> {
  meta: { name: string; type: string }[];
  data: T[];
  rows: number;
  rows_before_limit_at_least?: number;
}

function getToken(env: AuthEnv): string | null {
  const t = env.CF_API_TOKEN || env.CF_APi_TOKEN;
  return t ? t.trim() : null;
}

function getToken2(env: AuthEnv): string | null {
  const t = env.CF_API_TOKEN_2 || env.CF_APi_TOKEN_2;
  return t ? t.trim() : null;
}

const HEX32_GLOBAL = /[0-9a-f]{32}/i;
const HEX32 = /^[0-9a-f]{32}$/i;
const KNOWN_NOT_AN_ACCOUNT_ID = new Set(["", "your-account-id"]);

function parseAccountIdRaw(raw: string | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/^\/+|\/+$/g, "")
    .trim();
  const m = cleaned.match(HEX32_GLOBAL);
  if (m) return m[0].toLowerCase();
  return cleaned;
}

function getAccountId(env: AuthEnv): string | null {
  return parseAccountIdRaw(env.CF_ACCOUNT_ID);
}

function getAccountId2(env: AuthEnv): string | null {
  return parseAccountIdRaw(env.CF_ACCOUNT_ID_2);
}

export function validateAccountId(
  id: string | null,
  label = "CF_ACCOUNT_ID",
): string | null {
  if (!id) return `${label} ist leer.`;
  if (KNOWN_NOT_AN_ACCOUNT_ID.has(id.toLowerCase())) {
    return `${label} ist offensichtlich ein Platzhalter.`;
  }
  if (!HEX32.test(id)) {
    return `${label} '${id.slice(0, 6)}…' sieht nicht wie eine Cloudflare-Account-ID aus (32 Hex-Zeichen erwartet).`;
  }
  return null;
}

/** Dataset + optionale Fehlermeldung, wenn Creds für das Binding fehlen. */
export function resolveAnalyticsBinding(
  env: AuthEnv,
  binding: AeAccountBinding,
): { dataset: string; error: string | null } {
  if (binding === "primary") {
    const acc = getAccountId(env);
    const tok = getToken(env);
    if (!acc || !tok) {
      return {
        dataset: KEY_ANALYTICS_DATASET,
        error:
          "CF_ACCOUNT_ID und CF_API_TOKEN müssen im Pages-Environment gesetzt sein.",
      };
    }
    const ve = validateAccountId(acc, "CF_ACCOUNT_ID");
    if (ve) return { dataset: KEY_ANALYTICS_DATASET, error: ve };
    return { dataset: KEY_ANALYTICS_DATASET, error: null };
  }
  const acc = getAccountId2(env);
  const tok = getToken2(env);
  if (!acc || !tok) {
    return {
      dataset: API_ANALYTICS_DATASET,
      error:
        "Für binding=secondary müssen CF_ACCOUNT_ID_2 und CF_API_TOKEN_2 im Pages-Environment gesetzt sein.",
    };
  }
  const ve = validateAccountId(acc, "CF_ACCOUNT_ID_2");
  if (ve) return { dataset: API_ANALYTICS_DATASET, error: ve };
  return { dataset: API_ANALYTICS_DATASET, error: null };
}

/** Eine angeschlossene Quelle (Konto + Dataset) für gemergte Statistiken. */
export type AnalyticsSource = {
  dataset: string;
  binding: AeAccountBinding;
};

/**
 * Liefert alle Analytics-Quellen, die verfügbar sind: immer primäres
 * Konto (key_analytics), optional zweites (api_analytics) bei gesetzten
 * CF_*_2-Variablen.
 */
export function getMergedAnalyticsSources(env: AuthEnv): {
  sources: AnalyticsSource[];
  error: string | null;
} {
  const p = resolveAnalyticsBinding(env, "primary");
  if (p.error) {
    return { sources: [], error: p.error };
  }
  const sources: AnalyticsSource[] = [
    { dataset: p.dataset, binding: "primary" },
  ];
  const s = resolveAnalyticsBinding(env, "secondary");
  if (!s.error) {
    sources.push({ dataset: s.dataset, binding: "secondary" });
  }
  return { sources, error: null };
}

/** Analytics-Engine-JSON: Zahlen sicher als number (kein String-+). */
export function aeNumber(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export type RunAeSqlOptions = {
  /** Standard: primäres Konto (key_analytics). Secondary: Konto 2 (api_analytics). */
  binding?: AeAccountBinding;
};

/**
 * Führt eine SQL-Query gegen die Analytics-Engine SQL-API aus.
 * Die Query MUSS bereits sicher gebaut sein (alle User-Inputs escaped),
 * dieser Helper macht keine eigene Validierung.
 */
export interface AeSqlError extends Error {
  status?: number;
  cfRay?: string | null;
  body?: string;
  url?: string;
  hint?: string;
  sql?: string;
}

function maskId(id: string): string {
  if (id.length <= 8) return "***";
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

export async function runAeSql<T extends AeRow = AeRow>(
  env: AuthEnv,
  sql: string,
  options?: RunAeSqlOptions,
): Promise<AeResponse<T>> {
  const binding = options?.binding ?? "primary";
  const accountId =
    binding === "secondary" ? getAccountId2(env) : getAccountId(env);
  const token = binding === "secondary" ? getToken2(env) : getToken(env);
  const idLabel =
    binding === "secondary" ? "CF_ACCOUNT_ID_2" : "CF_ACCOUNT_ID";
  const tokLabel =
    binding === "secondary" ? "CF_API_TOKEN_2" : "CF_API_TOKEN";

  if (!accountId || !token) {
    throw new Error(
      binding === "secondary"
        ? `${idLabel} oder ${tokLabel} fehlt im Pages-Environment. ` +
            "Beide im Cloudflare-Dashboard setzen (Zweitkonto für api_analytics)."
        : "CF_ACCOUNT_ID oder CF_API_TOKEN fehlt im Pages-Environment. " +
            "Bitte beide Variablen im Cloudflare-Dashboard setzen.",
    );
  }

  const accErr = validateAccountId(accountId, idLabel);
  if (accErr) {
    const err = new Error(accErr) as AeSqlError;
    err.hint =
      "Die Account-ID findest du im Cloudflare-Dashboard rechts in der Sidebar als 32-stelliger Hex-String.";
    throw err;
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(
    accountId,
  )}/analytics_engine/sql`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "text/plain;charset=UTF-8",
        Accept: "application/json",
      },
      body: sql,
    });
  } catch (e) {
    const err = new Error(
      `Analytics Engine SQL: Netzwerkfehler – ${(e as Error).message}`,
    ) as AeSqlError;
    err.url = url;
    err.sql = sql;
    throw err;
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const cfRay = res.headers.get("cf-ray");
    let hint = "";
    if (res.status === 404) {
      hint =
        "404 von api.cloudflare.com bedeutet meistens: " +
        "(1) CF_ACCOUNT_ID gehört nicht zu diesem API-Token, " +
        "(2) der Token hat keine Permission 'Account → Account Analytics → Read' für diesen Account, " +
        "oder (3) Analytics Engine ist auf diesem Account nicht aktiv (Workers Paid nötig).";
    } else if (res.status === 401 || res.status === 403) {
      hint =
        "Auth-Fehler: API-Token ungültig, abgelaufen oder ohne Analytics-Permission.";
    } else if (res.status === 400) {
      hint =
        "SQL- oder Schema-Fehler. Prüfe Spaltennamen, Quoting und Funktionen.";
    }
    const err = new Error(
      `Analytics Engine SQL fehlgeschlagen (${res.status}${
        cfRay ? `, CF-Ray ${cfRay}` : ""
      })` +
        (text ? `: ${text.slice(0, 500)}` : " [leerer Response-Body]") +
        (hint ? `\nHinweis: ${hint}` : "") +
        `\nAccount: ${maskId(accountId)}` +
        `\nURL: ${url}` +
        `\n--- Query ---\n${sql}`,
    ) as AeSqlError;
    err.status = res.status;
    err.cfRay = cfRay;
    err.body = text;
    err.url = url;
    err.sql = sql;
    err.hint = hint;
    throw err;
  }

  const json = (await res.json()) as AeResponse<T>;
  return json;
}

export type DiagnoseAeOptions = { binding?: AeAccountBinding };

/** Sicherer Diagnose-Helper – ruft eine triviale Query und liefert
 *  detaillierte Infos für das Debugging zurück (ohne Token). */
export async function diagnoseAe(
  env: AuthEnv,
  options?: DiagnoseAeOptions,
): Promise<{
  ok: boolean;
  binding: AeAccountBinding;
  dataset: string;
  accountId: {
    present: boolean;
    masked: string | null;
    valid: boolean;
    error: string | null;
  };
  token: { present: boolean; length: number };
  endpoint: string | null;
  test?: {
    status: number;
    cfRay: string | null;
    bodyPreview: string;
    rowsReturned?: number;
  };
  hint?: string;
  error?: string;
}> {
  const binding: AeAccountBinding = options?.binding ?? "primary";
  const idLabel = binding === "secondary" ? "CF_ACCOUNT_ID_2" : "CF_ACCOUNT_ID";
  const tokLabel = binding === "secondary" ? "CF_API_TOKEN_2" : "CF_API_TOKEN";
  const dataset =
    binding === "secondary" ? API_ANALYTICS_DATASET : KEY_ANALYTICS_DATASET;

  const accountId =
    binding === "secondary" ? getAccountId2(env) : getAccountId(env);
  const token = binding === "secondary" ? getToken2(env) : getToken(env);
  const accErr = validateAccountId(accountId, idLabel);

  const result = {
    ok: false,
    binding,
    dataset,
    accountId: {
      present: !!accountId,
      masked: accountId ? maskId(accountId) : null,
      valid: !accErr,
      error: accErr,
    },
    token: { present: !!token, length: token ? token.length : 0 },
    endpoint: accountId
      ? `https://api.cloudflare.com/client/v4/accounts/${maskId(accountId)}/analytics_engine/sql`
      : null,
  };

  if (!accountId || !token) {
    result.error = `${idLabel} oder ${tokLabel} fehlt.`;
    return result;
  }
  if (accErr) {
    result.error = accErr;
    return result;
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(
    accountId,
  )}/analytics_engine/sql`;
  const sql = `SELECT 1 AS one FROM ${dataset} LIMIT 1 FORMAT JSON`;
  const datasetHint =
    binding === "secondary"
      ? "Dataset existiert evtl. nicht – heißt er wirklich 'api_analytics'?"
      : "Dataset existiert evtl. nicht – heißt er wirklich 'key_analytics'?";

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "text/plain;charset=UTF-8",
        Accept: "application/json",
      },
      body: sql,
    });
    const text = await res.text().catch(() => "");
    result.test = {
      status: res.status,
      cfRay: res.headers.get("cf-ray"),
      bodyPreview: text.slice(0, 600),
    };
    if (res.ok) {
      try {
        const j = JSON.parse(text) as AeResponse;
        result.test.rowsReturned = j.rows;
      } catch {
        // ignore
      }
      result.ok = true;
    } else {
      if (res.status === 404) {
        result.hint =
          "404 → Account-ID gehört nicht zum Token, Token hat keine 'Account Analytics: Read'-Permission, oder AE ist nicht aktiv (Workers Paid nötig).";
      } else if (res.status === 401 || res.status === 403) {
        result.hint = "Token ungültig oder ohne Analytics-Permission.";
      } else if (res.status === 400) {
        result.hint = datasetHint;
      }
    }
  } catch (e) {
    result.error = `Fetch fehlgeschlagen: ${(e as Error).message}`;
  }
  return result;
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

/** Liefert ein WHERE-Snippet mit Zeit-Range + Excluded-Keys (Kunden-Modus). */
export function whereCustomerWindow(
  env: AuthEnv,
  fromIso: string,
  toIso: string,
  extra?: string,
): string {
  const excluded = getExcludedForCustomers(env).map(sqlString).join(", ");
  const parts = [
    `timestamp >= ${sqlDateTime(fromIso)}`,
    `timestamp <  ${sqlDateTime(toIso)}`,
    `index1 NOT IN (${excluded})`,
    `index1 != ''`,
  ];
  if (extra) parts.push(extra);
  return "WHERE " + parts.join(" AND ");
}

/** WHERE-Snippet, das alle Oneauto-Key-Instanzen (Konto 1 + 2) einschließt. */
export function whereOneautoWindow(
  env: AuthEnv,
  fromIso: string,
  toIso: string,
  extra?: string,
): string {
  const inList = getOneautoKeys(env).map(sqlString).join(", ");
  const parts = [
    `timestamp >= ${sqlDateTime(fromIso)}`,
    `timestamp <  ${sqlDateTime(toIso)}`,
    `index1 IN (${inList})`,
  ];
  if (extra) parts.push(extra);
  return "WHERE " + parts.join(" AND ");
}

export type AnalyticsMode = "customers" | "oneauto";

export function whereForMode(
  env: AuthEnv,
  mode: AnalyticsMode,
  fromIso: string,
  toIso: string,
  extra?: string,
): string {
  return mode === "oneauto"
    ? whereOneautoWindow(env, fromIso, toIso, extra)
    : whereCustomerWindow(env, fromIso, toIso, extra);
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
