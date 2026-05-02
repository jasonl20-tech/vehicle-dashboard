/**
 * Frontend-Match-Regeln (Spiegel von functions/_lib/routeAccess.ts):
 *
 *   *            → alles erlaubt
 *   /a/b         → exakter Pfad
 *   /a/b/*       → /a/b und alles unter /a/b/…
 *
 * Zusätzlich (nur Frontend, NICHT in der API): „Transit"-Regel.
 *   Hat ein User /kunden/anfragen, ist /kunden automatisch erreichbar
 *   (sonst blockt ProtectedRoute Index-Redirects wie /kunden → /kunden/anfragen).
 */

export function normalizePathname(raw: string): string {
  let p = raw.trim();
  if (!p.startsWith("/")) p = `/${p}`;
  if (p.length > 1) p = p.replace(/\/+$/, "");
  return p || "/";
}

/** Direkter Match: *, exakt, /prefix/*. */
function directMatch(path: string, pfade: readonly string[]): boolean {
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

/** Transit: ein erlaubter Pfad liegt unterhalb von `path`. */
function transitMatch(path: string, pfade: readonly string[]): boolean {
  for (const entry of pfade) {
    const trimmed = typeof entry === "string" ? entry.trim() : "";
    if (!trimmed || trimmed === "*") continue;
    const target = trimmed.endsWith("/*") ? trimmed.slice(0, -2) : trimmed;
    const allowed = normalizePathname(target).toLowerCase();
    if (allowed.startsWith(`${path}/`)) return true;
  }
  return false;
}

export function pathMatchesPfadliste(
  pathname: string,
  pfade: readonly string[],
): boolean {
  const path = normalizePathname(pathname).toLowerCase();
  return directMatch(path, pfade) || transitMatch(path, pfade);
}

/**
 * Wie `pathMatchesPfadliste`, aber ohne Transit – sinnvoll für Sidebar/Tile-
 * Filter, damit nur tatsächlich nutzbare Ziele in der Navigation auftauchen.
 */
export function pathDirectlyAllowed(
  pathname: string,
  pfade: readonly string[],
): boolean {
  return directMatch(normalizePathname(pathname).toLowerCase(), pfade);
}
