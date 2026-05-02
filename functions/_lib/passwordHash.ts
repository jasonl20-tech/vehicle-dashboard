/**
 * Passwortspeicher für `user.password`: PBKDF2-HMAC-SHA256 mit zufälligem Salt +
 * gemeinsamen Pepper aus der Umgebung (für mehrere Deployments mit einer D1 gleich haltbar).
 *
 * Format gespeicherter Strings:
 *   v1|<iter>|<salt_hex>|<hash_hex>
 *   (Delimiter `|` ist in Hex-Salzen/Hashes nicht enthalten.)
 *
 * Ältere Datensätze (reines Klartext-Passwort) werden beim nächsten erfolgreichen
 * Login automatisch durch einen Hash ersetzt, sobald `password_secret` (env) konfiguriert ist.
 */

import type { AuthEnv } from "./auth";

const HASH_SCHEME = "v1";
/**
 * Iterationszahl für PBKDF2-HMAC-SHA256.
 *
 * Cloudflare Workers Free-Plan hat 10 ms CPU-Limit pro Request, Paid-Plan
 * standardmäßig 30 s. 210.000 Iterationen sind auf Free-Plans regelmäßig
 * der Grund für „Worker exceeded CPU"-Crashes.
 *
 * 100.000 ist der NIST-Mindestwert (SP 800-132 / SP 800-63B 2017+) und passt
 * sicher in Cloudflare-Limits. Verifikation parst die im Hash gespeicherte
 * Iterationszahl, daher ist der Wert pro Hash flexibel — die Konstante hier
 * gilt nur für **neu** erzeugte Hashes.
 */
const PBKDF2_ITERATIONS = 100_000;
const DERIVED_BITS = 256;
const SALT_BYTES = 16;

const PEPPER_MARKER = "\0vehicleimagery-password-v1\0";

/** Mindestlänge des Pepper gleiche Philosophie wie `SESSION_SECRET` im Projekt */
export const PEPPER_MIN_LEN = 16;

/** Stabiler Vergleichwert wenn `catch` zwischen Modulgrenzen läuft */
export const PASSWORD_SECRET_MISSING_MESSAGE = "password_secret_not_configured";

function coerceTrimmedSecret(val: unknown): string | undefined {
  if (typeof val !== "string") return undefined;
  const t = val.trim().replaceAll("\uFEFF", "");
  return t.length ? t : undefined;
}

/**
 * Normalisiert Workers/Pages-Variablennamen.
 * - `trim()` fängt versehentliche Leerzeichen im Cloudflare-Dashboard ab
 *   (z.B. „password_secret " ≠ „password_secret" ohne Toleranz).
 * - Bindestriche → Underscores, alles lowercase.
 */
function canonicalPasswordSecretKey(localName: string): string {
  return localName.trim().replaceAll("-", "_").toLowerCase();
}

/**
 * Liest Pepper aus `env`: zuerst exakte Felder wie `password_secret`, dann jeder **eigene**
 * Property-Key, der nach Normalisierung `password_secret` entspricht.
 * Workers/Pages können Keys unterschiedlich injizieren; `Reflect.ownKeys` erfasst auch
 * nicht-enumerable Einträge, die `for...in` verpassen kann.
 */
function resolvePasswordSecretPepper(env: AuthEnv): string {
  const r = env as unknown as Record<string, unknown>;
  const tryKey = (k: string): string | undefined => coerceTrimmedSecret(r[k]);

  for (const k of ["password_secret", "PASSWORD_SECRET", "passwordSecret"]) {
    const v = tryKey(k);
    if (v && v.length >= PEPPER_MIN_LEN) return v;
  }

  const own = new Set<string>();
  for (const key of Reflect.ownKeys(r)) {
    if (typeof key !== "string") continue;
    const n = canonicalPasswordSecretKey(key);
    own.add(key);
    if (n !== "password_secret") continue;
    // Wichtig: Property-Zugriff muss mit dem **Original-Key** erfolgen, sonst
    // findet das Lookup z.B. „password_secret " (mit Leerzeichen) nicht.
    const v = tryKey(key);
    if (v && v.length >= PEPPER_MIN_LEN) return v;
  }

  for (const k of ["password_secret", "PASSWORD_SECRET"]) {
    const pv = coerceTrimmedSecret(r[k]);
    if (pv !== undefined && pv.length > 0 && pv.length < PEPPER_MIN_LEN) {
      console.warn(
        `[password] Umgebungsvariable »${k}« ist nach trim nur ${pv.length} Zeichen lang (${PEPPER_MIN_LEN} erforderlich).`,
      );
    }
  }

  console.warn(
    "[password] password_secret nicht nutzbar. String-Env-Keys (nur Namen, für Diagnose):",
    [...own.values()]
      .filter((k) => coerceTrimmedSecret(r[k]))
      .filter((k) => /pass|pwd|secret|pepper/i.test(k))
      .sort()
      .join(", ") || "(keine oder nur Non-Strings)",
  );
  return "";
}

/**
 * Diagnose ohne Werte: was sieht Functions wirklich in `env`?
 * - `present`: Schlüssel existiert auf `env`.
 * - `isString`: Wert ist `string` (Cloudflare-Secrets/Variables landen als Strings).
 * - `length`: Länge nach `trim()` + BOM-Strip.
 * - `relevantKeys`: alle eigenen String-Keys, deren Name auf das Schema passt
 *   (z.B. `pass`, `pwd`, `secret`, `pepper`).
 */
export function diagnosePasswordSecret(env: AuthEnv): {
  resolved: { name: string | null; length: number };
  candidates: Array<{ name: string; present: boolean; isString: boolean; length: number }>;
  relevantKeys: string[];
  minRequired: number;
} {
  const r = env as unknown as Record<string, unknown>;
  const probe = (name: string) => {
    const present = Object.prototype.hasOwnProperty.call(r, name);
    const raw = r[name];
    const isString = typeof raw === "string";
    const length = isString ? (raw as string).trim().replaceAll("\uFEFF", "").length : 0;
    return { name, present, isString, length };
  };

  const candidates = ["password_secret", "PASSWORD_SECRET", "passwordSecret"].map(probe);

  const relevantKeys: string[] = [];
  for (const key of Reflect.ownKeys(r)) {
    if (typeof key !== "string") continue;
    const v = r[key];
    if (typeof v !== "string") continue;
    if (/(pass|pwd|secret|pepper)/i.test(key)) relevantKeys.push(key);
  }
  relevantKeys.sort();

  const pepper = resolvePasswordSecretPepper(env);
  let resolvedName: string | null = null;
  if (pepper) {
    for (const key of Reflect.ownKeys(r)) {
      if (typeof key !== "string") continue;
      if (canonicalPasswordSecretKey(key) !== "password_secret") continue;
      const v = coerceTrimmedSecret(r[key]);
      if (v && v.length >= PEPPER_MIN_LEN) {
        resolvedName = key;
        break;
      }
    }
  }
  const resolved = pepper
    ? { name: resolvedName ?? "(unbekannt)", length: pepper.length }
    : { name: null, length: 0 };

  return {
    resolved,
    candidates,
    relevantKeys,
    minRequired: PEPPER_MIN_LEN,
  };
}

function timingSafeEqBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}

/** Voriges Verhalten bei Klartext in der DB — nur für Übergangszeit. */
function legacyPlaintextVerify(input: string, stored: string): boolean {
  if (typeof input !== "string" || typeof stored !== "string") return false;
  if (input.length !== stored.length) return false;
  let result = 0;
  for (let i = 0; i < input.length; i++) {
    result |= input.charCodeAt(i) ^ stored.charCodeAt(i);
  }
  return result === 0;
}

function hexFromBytes(buf: Uint8Array): string {
  let out = "";
  for (let i = 0; i < buf.length; i++) {
    out += buf[i]!.toString(16).padStart(2, "0");
  }
  return out;
}

function hexToBytes(hex: string): Uint8Array | null {
  if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length % 2 !== 0) return null;
  const u = new Uint8Array(hex.length / 2);
  for (let i = 0; i < u.length; i++) {
    u[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return u;
}

function encodeUtf8PwdMaterial(pepper: string, plain: string): Uint8Array {
  return new TextEncoder().encode(pepper + PEPPER_MARKER + plain);
}

async function deriveV1(params: {
  pepper: string;
  passwordUtf8Plain: string;
  salt: Uint8Array;
  iterations: number;
}): Promise<Uint8Array> {
  const { pepper, passwordUtf8Plain, salt, iterations } = params;
  const raw = encodeUtf8PwdMaterial(pepper, passwordUtf8Plain);
  const keyMat = await crypto.subtle.importKey(
    "raw",
    raw,
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256",
    },
    keyMat,
    DERIVED_BITS,
  );
  return new Uint8Array(bits);
}

function parseStoredHash(stored: string): null | {
  iterations: number;
  salt: Uint8Array;
  hash: Uint8Array;
} {
  const parts = stored.split("|");
  if (parts.length !== 4 || parts[0] !== HASH_SCHEME) return null;
  const iterations = Number(parts[1]);
  if (!Number.isFinite(iterations) || iterations < 1_000 || iterations > 10_000_000) {
    return null;
  }
  const salt = hexToBytes(parts[2] ?? "");
  const hash = hexToBytes(parts[3] ?? "");
  if (
    salt === null ||
    hash === null ||
    salt.length !== SALT_BYTES ||
    hash.length !== DERIVED_BITS / 8
  ) {
    return null;
  }
  return { iterations, salt, hash };
}

/**
 * Nimmt einen Klartext-Login und berechnet den Zeichenketten für `user.password`.
 * @throws Error wenn kein gültiges Pepper gesetzt ist
 */
export async function hashPasswordForStorage(
  env: AuthEnv,
  plaintext: string,
): Promise<string> {
  const pepper = resolvePasswordSecretPepper(env);
  if (!pepper) {
    throw new Error(PASSWORD_SECRET_MISSING_MESSAGE);
  }
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const dk = await deriveV1({
    pepper,
    passwordUtf8Plain: plaintext,
    salt,
    iterations: PBKDF2_ITERATIONS,
  });
  return [
    HASH_SCHEME,
    String(PBKDF2_ITERATIONS),
    hexFromBytes(salt),
    hexFromBytes(dk),
  ].join("|");
}

export type StoredPasswordVerification = {
  ok: boolean;
  /** Bei früherem Klartext: nach erfolgreichem Vergleich neu hashen und speichern */
  needsLegacyRehash: boolean;
};

/**
 * Vergleicht User-Eingabe mit DB-Wert. Unterstützt `v1|…|` und Legacy-Klartext.
 */
export async function verifyStoredPassword(
  env: AuthEnv,
  plaintext: string,
  storedTrimmed: string,
): Promise<StoredPasswordVerification> {
  const trimmed = storedTrimmed.trim();

  const parsed = parseStoredHash(trimmed);
  if (parsed) {
    const pepper = resolvePasswordSecretPepper(env);
    if (!pepper) {
      console.warn(
        "[password] PBKDF2-Hash vorhanden, aber password_secret (mind. 16 Zeichen, env) wird nicht gefunden.",
      );
      return { ok: false, needsLegacyRehash: false };
    }
    const dk = await deriveV1({
      pepper,
      passwordUtf8Plain: plaintext,
      salt: parsed.salt,
      iterations: parsed.iterations,
    });
    const ok = timingSafeEqBytes(dk, parsed.hash);
    return { ok, needsLegacyRehash: false };
  }

  const legacyOk = legacyPlaintextVerify(plaintext, trimmed);
  if (!legacyOk) {
    return { ok: false, needsLegacyRehash: false };
  }
  const pepper = resolvePasswordSecretPepper(env);
  return {
    ok: true,
    needsLegacyRehash: Boolean(pepper),
  };
}
