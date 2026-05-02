/**
 * TOTP (RFC 6238) mit HMAC-SHA1, Period 30s, 6-stelliger Code.
 * Secret als Base32-String (wie üblich bei Authenticator-Apps).
 */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function encodeBase32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

/** Base32 ohne Padding/Leerzeichen; case-insensitive. */
export function decodeBase32(encoded: string): Uint8Array {
  const s = encoded.toUpperCase().replace(/[= ]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(s[i]);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

/** 160 Bit wie gängige Authenticator-Einträge (~20 Bytes). */
export async function generateTotpSecret(): Promise<string> {
  const buf = new Uint8Array(20);
  crypto.getRandomValues(buf);
  return encodeBase32(buf);
}

function truncateToHotp(fullMac: Uint8Array): number {
  const offset = fullMac[fullMac.length - 1] & 0x0f;
  return (
    ((fullMac[offset] & 0x7f) << 24) |
    ((fullMac[offset + 1] & 0xff) << 16) |
    ((fullMac[offset + 2] & 0xff) << 8) |
    (fullMac[offset + 3] & 0xff)
  );
}

async function hotpCounter(
  keyBytes: Uint8Array,
  counter: bigint,
): Promise<number> {
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  view.setBigUint64(0, counter, false);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );

  const mac = await crypto.subtle.sign("HMAC", cryptoKey, buf);
  const full = new Uint8Array(mac);

  const num = truncateToHotp(full);
  return num % 1_000_000;
}

function formatCode(code: number): string {
  return code.toString().padStart(6, "0");
}

export async function totpVerify(
  secretBase32: string,
  digitsCode: string,
  windowSteps = 1,
): Promise<boolean> {
  const trimmed = digitsCode.replace(/\s/g, "").trim();
  if (!/^\d{6}$/.test(trimmed)) return false;
  let keyBytes: Uint8Array;
  try {
    keyBytes = decodeBase32(secretBase32);
  } catch {
    return false;
  }

  const t = BigInt(Math.floor(Date.now() / 1000 / 30));

  const target = trimmed;
  for (let d = -windowSteps; d <= windowSteps; d++) {
    const ctr = t + BigInt(d);
    const code = await hotpCounter(keyBytes, ctr);
    if (formatCode(code) === target) return true;
  }
  return false;
}

export function buildOtpauthUri(params: {
  issuer: string;
  accountLabel: string;
  secretBase32: string;
}): string {
  const label = encodeURIComponent(`${params.issuer}:${params.accountLabel}`);
  const query = new URLSearchParams({
    secret: params.secretBase32,
    issuer: params.issuer,
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  });
  return `otpauth://totp/${label}?${query.toString()}`;
}
