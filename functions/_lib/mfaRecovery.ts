import type { AuthEnv } from "./auth";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function normalizeRecoveryInput(code: string): string | null {
  const s = code.replace(/\s|-/g, "").toUpperCase();
  if (!s.length || s.length > 64) return null;
  for (let i = 0; i < s.length; i++) {
    if (CODE_ALPHABET.indexOf(s[i]) < 0) return null;
  }
  return s;
}

async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function pepperedRecoveryHash(
  env: Pick<AuthEnv, "SESSION_SECRET">,
  userId: number,
  normalizedPlain: string,
): Promise<string> {
  let pepper = "";
  if (env.SESSION_SECRET && env.SESSION_SECRET.length >= 16) {
    pepper = env.SESSION_SECRET;
  }
  const input = `${pepper}\0recovery-v1\0${userId}\0${normalizedPlain}`;
  return sha256Hex(new TextEncoder().encode(input));
}

export function timingSafeHexEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let ok = 0;
  for (let i = 0; i < a.length; i++) {
    ok |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return ok === 0;
}

export function generateRecoveryCodesPlain(count = 10): string[] {
  const out: string[] = [];
  for (let c = 0; c < count; c++) {
    let raw = "";
    for (let i = 0; i < 8; i++) {
      const idx = crypto.getRandomValues(new Uint8Array(1))[0]!
        % CODE_ALPHABET.length;
      raw += CODE_ALPHABET[idx];
    }
    out.push(`${raw.slice(0, 4)}-${raw.slice(4)}`);
  }
  return out;
}

export async function hashesForRecoveryCodes(
  env: AuthEnv,
  userId: number,
  plaintextCodes: readonly string[],
): Promise<string[]> {
  const hashes: string[] = [];
  for (const pc of plaintextCodes) {
    const norm = normalizeRecoveryInput(pc);
    if (!norm) throw new Error("invalid recovery plaintext");
    hashes.push(await pepperedRecoveryHash(env, userId, norm));
  }
  return hashes;
}

/** Prüft `code`; bei Treffer entfernen und neues JSON-Array zurückgeben, sonst `null`. */
export async function tryConsumeRecoveryHash(
  env: AuthEnv,
  userId: number,
  storedJson: string | null,
  submittedCode: string,
): Promise<string | null> {
  let list: unknown;
  try {
    list = storedJson?.trim()?.length ? JSON.parse(storedJson) : [];
  } catch {
    return null;
  }
  if (!Array.isArray(list)) return null;
  const hashes = list.filter((x) => typeof x === "string") as string[];

  const norm = normalizeRecoveryInput(submittedCode);
  if (!norm) return null;
  const want = await pepperedRecoveryHash(env, userId, norm);

  let idx = -1;
  for (let i = 0; i < hashes.length; i++) {
    if (timingSafeHexEqual(hashes[i]!, want)) {
      idx = i;
      break;
    }
  }
  if (idx < 0) return null;

  const nextList = hashes.filter((_, i) => i !== idx);
  return JSON.stringify(nextList);
}
