/**
 * Frontend: gleiche Regeln wie functions/_lib/routeAccess.ts
 * (`sicherheitsstufen`, `*` und `/prefix/*`).
 */

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
