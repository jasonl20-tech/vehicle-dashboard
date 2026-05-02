/**
 * Passwortspeicher für `user.password`: PBKDF2-HMAC-SHA256 mit zufälligem Salt +
 * gemeinsamen Pepper aus der Umgebung (für mehrere Deployments mit einer D1 gleich haltbar).
 *
 * Format gespeicherter Strings:
 *   v1|<iter>|<salt_hex>|<hash_hex>
 *   (Delimiter `|` ist in Hex-Salzen/Hashes nicht enthalten.)
 *
 * Ältere Datensätze (reines Klartext-Passwort) werden beim nächsten erfolgreichen
 * Login automatisch durch einen Hash ersetzt, sobald `PASSWORD_SECRET` konfiguriert ist.
 */

import type { AuthEnv } from "./auth";

const HASH_SCHEME = "v1";
/** OWASP-ish Mindest-Anforderungen; identisch quer über alle Plattformen mit derselben DB. */
const PBKDF2_ITERATIONS = 210_000;
const DERIVED_BITS = 256;
const SALT_BYTES = 16;

const PEPPER_MARKER = "\0vehicleimagery-password-v1\0";

/** Mindestlänge des Pepper gleiche Philosophie wie `SESSION_SECRET` im Projekt */
const PEPPER_MIN_LEN = 16;

function normalizePepper(env: Pick<AuthEnv, "PASSWORD_SECRET" | "password_secret">): string {
  const a =
    typeof env.PASSWORD_SECRET === "string" ? env.PASSWORD_SECRET.trim() : "";
  const b =
    typeof env.password_secret === "string" ? env.password_secret.trim() : "";
  const pepper = (a.length >= PEPPER_MIN_LEN ? a : "") ||
    (b.length >= PEPPER_MIN_LEN ? b : "");
  return pepper;
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
  env: Pick<AuthEnv, "PASSWORD_SECRET" | "password_secret">,
  plaintext: string,
): Promise<string> {
  const pepper = normalizePepper(env);
  if (!pepper) {
    throw new Error("PASSWORD_SECRET_NOT_CONFIGURED");
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
  env: Pick<AuthEnv, "PASSWORD_SECRET" | "password_secret">,
  plaintext: string,
  storedTrimmed: string,
): Promise<StoredPasswordVerification> {
  const trimmed = storedTrimmed.trim();

  const parsed = parseStoredHash(trimmed);
  if (parsed) {
    const pepper = normalizePepper(env);
    if (!pepper) {
      console.warn(
        "[password] PBKDF2-Hash vorhanden, aber PASSWORD_SECRET/password_secret fehlt.",
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
  const pepper = normalizePepper(env);
  return {
    ok: true,
    needsLegacyRehash: Boolean(pepper),
  };
}
