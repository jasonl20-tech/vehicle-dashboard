import type { WorkersAiBinding } from "./workersAiBinding";

/**
 * Session-/Cookie-Helper für Cloudflare Pages Functions.
 *
 * Token-Format: <payloadBase64Url>.<sigBase64Url>
 *   payload = JSON {sub: userId, iat, exp}
 *   sig     = HMAC-SHA256 über payloadBase64Url mit env.SESSION_SECRET
 */

export const SESSION_COOKIE = "vh_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 Tage
export const SETUP_TOKEN_TTL_SECONDS = 60 * 10; // 10 Minuten

export type SessionUser = {
  id: number;
  benutzername: string;
  titel: string | null;
  sicherheitsstufe: number;
  profilbild: string | null;
  bannerfarbe: string | null;
};

export interface AuthEnv {
  user: D1Database;
  SESSION_SECRET?: string;
  /** Cloudflare-Account-ID für Analytics-Engine-SQL-API */
  CF_ACCOUNT_ID?: string;
  /** API-Token mit Account.Analytics:Read */
  CF_API_TOKEN?: string;
  /**
   * Akzeptiere alternative Schreibweise (Tippfehler-Toleranz),
   * Cloudflare unterscheidet Variablennamen case-sensitive.
   */
  CF_APi_TOKEN?: string;
  /** Zweites CF-Konto für Analytics Engine (Dataset z. B. `api_analytics`). */
  CF_ACCOUNT_ID_2?: string;
  CF_API_TOKEN_2?: string;
  CF_APi_TOKEN_2?: string;
  /**
   * Log-Stream: Wert der Spalte `dataset` bei Abfrage wie Kunden-API (`FROM key_analytics … AND dataset = …`).
   * Standard: controll_platform_logs.
   */
  CONTROLLING_AE_DATASET?: string;
  /**
   * Standard: 1 (eigene AE-Tabelle, z. B. `controll_platform_logs`).
   * Auf 0/false/no setzen, falls Logs in `key_analytics`/`api_analytics`
   * landen und nur per Spalte `dataset` getrennt sind.
   */
  CONTROLLING_AE_DEDICATED?: string;
  /** primary = `key_analytics`, secondary = `api_analytics` (Zweitkonto). */
  CONTROLLING_AE_ACCOUNT?: string;
  /**
   * Optional: zweiter Oneauto-API-Key (32 hex), falls abweichend von `ONEAUTO_KEY_ALT`.
   * Ohne Wert: fest definierter Alt-Key + Primär-Key fassen beide Accounts zusammen.
   */
  ONEAUTO_KEY_2?: string;
  /**
   * Bildaustrahlung (`image_url_requests`): `1` = dedizierte AE-Tabelle `FROM <name>`;
   * `0`/leer = `key_analytics` / `api_analytics` mit `AND dataset = …` (siehe `IMAGE_URL_REQUESTS_DATASET`).
   */
  IMAGE_URL_REQUESTS_DEDICATED?: string;
  /**
   * Wenn gesetzt: Modus mit `key_analytics`/`api_analytics` + `dataset = …` nicht abfragen
   * (nur dedicated-Tabelle, falls konfiguriert).
   */
  IMAGE_URL_REQUESTS_FILTER_DISABLE?: string;
  /** Name der AE-Quelle (Tabellen- oder `dataset`-Wert, Standard `image_url_requests`). */
  IMAGE_URL_REQUESTS_DATASET?: string;
  /** Wie `CONTROLLING_AE_ACCOUNT`: `secondary` = nur Zweitkonto, sonst primär. */
  IMAGE_URL_AE_ACCOUNT?: string;
  /**
   * Spalte in `image_url_requests` für die Client-IP: `blob4` (Default in diesem Projekt),
   * oder `blob1` / `blob2` je nach Worker-Schema.
   */
  IMAGE_URL_REQUESTS_IP_BLOB?: string;
  /** Stripe Secret Key (`sk_…`, nur serverseitig). */
  STRIPE_SECRET_KEY?: string;
  /**
   * KV-Binding: Plan-JSON pro Key (z. B. `plan_test`), koppelbar an Payment Links via Metadaten `price_id`.
   * Im Cloudflare-Dashboard: Variable-Name muss exakt `plans` lauten (wie im Code: `env.plans`).
   */
  plans?: KVNamespace;
  /**
   * KV-Binding: Kunden-Keys. Schlüssel = Kunden-Key (z. B. `VI-…`), Wert = JSON
   * mit `status`, `customer.email`, `plan_id`, eingebetteter `plan` (wie unter `plans`),
   * `metadata.created_at`. Binding-Name im Dashboard: `customer_keys` → `env.customer_keys`.
   */
  customer_keys?: KVNamespace;
  /**
   * KV-Binding: System-Prompts pro Ansicht (z. B. `front_right` → JSON mit
   * `prompt`, `aspect_ratio`, …). Binding-Name im Dashboard: `prompts` → `env.prompts`.
   */
  prompts?: KVNamespace;
  /**
   * KV-Binding: globale Sperrliste (ganze Marken, einzelne Marke+Modell). Ein
   * festes Key `_config_blocked_vehicles` (siehe API). Variable `blocked_vehicles`.
   */
  blocked_vehicles?: KVNamespace;
  /**
   * D1: Fahrzeug-/Bild-Metadaten u. a. `vehicleimagery_public_storage`, `vehicleimagery_controlling_storage`.
   * Binding-Name im Dashboard: `vehicledatabase` → `env.vehicledatabase`
   */
  vehicledatabase?: D1Database;
  /**
   * D1: Konfiguration (`settings`-Tabelle, u. a. `controll_buttons`). Binding `configs` → `env.configs`.
   */
  configs?: D1Database;
  /**
   * Öffentliche Bild-CDN-Basis (ohne Slash am Ende), z. B. `https://bildurl.vehicleimagery.com`.
   * Optional: Pages-Variable `IMAGE_CDN_BASE`; sonst Fallback im API-Code.
   */
  IMAGE_CDN_BASE?: string;
  /**
   * Controlling-Bilder (`/api/databases/vehicle-imagery-controlling`): Host für Pfade `v1/…`.
   * Variable `IMAGE_CDN_CONTROLLING_BASE`; Fallback `https://vehicleimagery-controlling.vehicleimagery.com`.
   */
  IMAGE_CDN_CONTROLLING_BASE?: string;
  /**
   * Optional: Geheimnis für signierte Bild-URLs o. ä. (Variable `image_url_secret` im Dashboard).
   * Wird nicht an den Browser ausgeliefert.
   */
  image_url_secret?: string;
  /**
   * D1: Mapping-Tabellen (manufacture/model/color/body/trim). Variable `mapping`.
   */
  mapping?: D1Database;
  /**
   * D1: Webseite (z. B. Tabelle `submissions` für Formular-Einsendungen). Variable `website`.
   * Tabellen `customers` (CRM), `email_templates` und `assets` liegen in derselben Datenbank.
   */
  website?: D1Database;
  /**
   * R2-Bucket für Asset-Speicherung (Bilder, PDFs etc., die in Mails/auf
   * der Webseite verlinkt werden). Binding-Name im Pages-Dashboard:
   * `assets` → `env.assets`. Public-Domain: `assets.vehicleimagery.com`
   * (Custom-Domain auf den Bucket).
   */
  assets?: R2Bucket;
  /**
   * Optional: Basis-URL für öffentliche Asset-Links. Standard:
   * `https://assets.vehicleimagery.com`. Wird vom API zurückgegeben,
   * damit der Browser den Public-Link direkt verwendet.
   */
  ASSETS_PUBLIC_BASE?: string;
  /**
   * Workers AI (Pages: Functions → Bindings → Workers AI).
   * Variable z. B. `workersai` oder wie in der Doku `AI`.
   */
  workersai?: WorkersAiBinding;
  AI?: WorkersAiBinding;
  /**
   * Name eines [AI Gateway](https://developers.cloudflare.com/ai-gateway/)
   * im selben Account. Pflicht für Provider-Modelle (`openai/…`, `anthropic/…`,
   * `google/…` …) bei `env.AI.run()`; optional für reines `@cf/…` (Workers AI).
   * Pages: Environment Variable `AI_GATEWAY_ID`.
   */
  AI_GATEWAY_ID?: string;
  /** Tippfehler-Toleranz */
  AIGATEWAY_ID?: string;
  /**
   * Workers Analytics Engine Dataset: Control-Platform-Klicks
   * (Dashboard-Binding: `controll_analytics` → `env.controll_analytics`).
   */
  controll_analytics?: {
    writeDataPoint(data: {
      blobs?: string[];
      doubles?: number[];
      indexes?: string[];
    }): void;
  };
}

// ---------- base64url helpers ----------

function base64UrlEncode(input: ArrayBuffer | Uint8Array): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let str = "";
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(input: string): Uint8Array {
  let s = input.replaceAll("-", "+").replaceAll("_", "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ---------- HMAC ----------

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function getSecret(env: AuthEnv): string {
  if (env.SESSION_SECRET && env.SESSION_SECRET.length >= 16) {
    return env.SESSION_SECRET;
  }
  console.warn(
    "[auth] SESSION_SECRET fehlt oder ist zu kurz (<16 Zeichen). Nutze Dev-Default. " +
      "BITTE im Pages-Dashboard als Environment Variable setzen!",
  );
  return "dev-secret-change-me-please-now";
}

// ---------- Token ----------

export async function createSessionToken(
  env: AuthEnv,
  userId: number,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload = { sub: userId, iat: now, exp: now + SESSION_TTL_SECONDS };
  const payloadB64 = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  const key = await importKey(getSecret(env));
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payloadB64),
  );
  return `${payloadB64}.${base64UrlEncode(sig)}`;
}

export async function verifySessionToken(
  env: AuthEnv,
  token: string,
): Promise<{ sub: number; exp: number } | null> {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  try {
    const key = await importKey(getSecret(env));
    const ok = await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlDecode(sigB64),
      new TextEncoder().encode(payloadB64),
    );
    if (!ok) return null;
    const json = JSON.parse(
      new TextDecoder().decode(base64UrlDecode(payloadB64)),
    );
    if (typeof json?.exp !== "number" || typeof json?.sub !== "number") {
      return null;
    }
    if (json.exp < Math.floor(Date.now() / 1000)) return null;
    return { sub: json.sub, exp: json.exp };
  } catch {
    return null;
  }
}

// ---------- Setup-Token (für initiales Passwort-Setzen) ----------
//
// Eigener Token mit `intent: "pw-setup"` damit ein normales Session-Cookie
// nicht versehentlich als Setup-Token akzeptiert wird (und umgekehrt).

export async function createSetupToken(
  env: AuthEnv,
  userId: number,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: userId,
    iat: now,
    exp: now + SETUP_TOKEN_TTL_SECONDS,
    intent: "pw-setup",
  };
  const payloadB64 = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  const key = await importKey(getSecret(env));
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payloadB64),
  );
  return `${payloadB64}.${base64UrlEncode(sig)}`;
}

export async function verifySetupToken(
  env: AuthEnv,
  token: string,
): Promise<{ sub: number } | null> {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  try {
    const key = await importKey(getSecret(env));
    const ok = await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlDecode(sigB64),
      new TextEncoder().encode(payloadB64),
    );
    if (!ok) return null;
    const json = JSON.parse(
      new TextDecoder().decode(base64UrlDecode(payloadB64)),
    );
    if (
      json?.intent !== "pw-setup" ||
      typeof json?.exp !== "number" ||
      typeof json?.sub !== "number"
    ) {
      return null;
    }
    if (json.exp < Math.floor(Date.now() / 1000)) return null;
    return { sub: json.sub };
  } catch {
    return null;
  }
}

// ---------- Cookie ----------

export function buildSessionCookie(token: string): string {
  return [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ].join("; ");
}

export function clearSessionCookie(): string {
  return [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Max-Age=0",
  ].join("; ");
}

export function readSessionCookie(req: Request): string | null {
  const header = req.headers.get("Cookie");
  if (!header) return null;
  for (const raw of header.split(";")) {
    const part = raw.trim();
    if (part.startsWith(`${SESSION_COOKIE}=`)) {
      return part.slice(SESSION_COOKIE.length + 1);
    }
  }
  return null;
}

// ---------- Passwort-Vergleich ----------
//
// Sicherheitshinweis: Aktuell wird das Passwort als Klartext mit dem DB-Wert
// verglichen, weil deine `user.password`-Spalte aktuell Klartext speichert.
// Sobald du auf Hashes (z.B. PBKDF2 oder bcrypt) umstellst, hier anpassen.
//
// Constant-time-Vergleich, damit Timing-Attacken weniger Aussage haben.
export function verifyPassword(input: string, stored: string): boolean {
  if (typeof input !== "string" || typeof stored !== "string") return false;
  if (input.length !== stored.length) return false;
  let result = 0;
  for (let i = 0; i < input.length; i++) {
    result |= input.charCodeAt(i) ^ stored.charCodeAt(i);
  }
  return result === 0;
}

// ---------- Aktuellen User aus Cookie laden ----------

export async function getCurrentUser(
  env: AuthEnv,
  req: Request,
): Promise<SessionUser | null> {
  const token = readSessionCookie(req);
  if (!token) return null;
  const session = await verifySessionToken(env, token);
  if (!session) return null;

  const row = await env.user
    .prepare(
      "SELECT id, benutzername, titel, sicherheitsstufe, profilbild, bannerfarbe, active FROM user WHERE id = ?1",
    )
    .bind(session.sub)
    .first<{
      id: number;
      benutzername: string;
      titel: string | null;
      sicherheitsstufe: number | null;
      profilbild: string | null;
      bannerfarbe: string | null;
      active: number;
    }>();

  if (!row || row.active !== 1) return null;

  return {
    id: row.id,
    benutzername: row.benutzername,
    titel: row.titel,
    sicherheitsstufe: row.sicherheitsstufe ?? 0,
    profilbild: row.profilbild,
    bannerfarbe: row.bannerfarbe,
  };
}

export function jsonResponse(
  data: unknown,
  init: ResponseInit = {},
): Response {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(data), { ...init, headers });
}
