/**
 * Routen-/Pfad-Rechte nach Tabelle `sicherheitsstufen` (sicherheitsstufe_id, pfad).
 * - "*" erlaubt alle Pfade
 * - "/prefix/*" erlaubt exakt "/prefix" und alles unter /prefix/…
 */

import type { AuthEnv } from "./auth";

export function normalizePathname(raw: string): string {
  let p = raw.trim();
  if (!p.startsWith("/")) p = `/${p}`;
  if (p.length > 1) p = p.replace(/\/+$/, "");
  return p || "/";
}

export function pathMatchesPfadliste(
  pathname: string,
  pfade: readonly string[],
): boolean {
  const path = normalizePathname(pathname).toLowerCase();
  for (const entry of pfade) {
    const trimmed = typeof entry === "string" ? entry.trim() : "";
    if (!trimmed || trimmed === "*") return true;
    const pat = trimmed.toLowerCase();
    if (pat.endsWith("/*")) {
      const prefix = normalizePathname(trimmed.slice(0, -2)).toLowerCase();
      if (path === prefix || path.startsWith(`${prefix}/`)) return true;
      continue;
    }
    if (normalizePathname(trimmed).toLowerCase() === path) return true;
  }
  return false;
}

/**
 * Whitelist-Modus: Liefert ausschließlich die in `sicherheitsstufen` für diese
 * Stufe hinterlegten Pfade. Keine Einträge = keinerlei Routen freigegeben
 * (Plattform-Start `/` ist clientseitig in `ProtectedRoute` separat erlaubt).
 */
export async function fetchPathsForSecurityLevel(
  env: Pick<AuthEnv, "user">,
  sicherheitsstufeId: number,
): Promise<string[]> {
  const stmt = env.user.prepare(
    "SELECT pfad FROM sicherheitsstufen WHERE sicherheitsstufe_id = ?",
  ).bind(sicherheitsstufeId);
  try {
    const { results } = await stmt.all<{ pfad: string }>();
    return results
      .map((r) => (typeof r.pfad === "string" ? r.pfad.trim() : ""))
      .filter(Boolean);
  } catch (e) {
    console.error("[routeAccess] fetchPathsForSecurityLevel:", e);
    throw e;
  }
}
