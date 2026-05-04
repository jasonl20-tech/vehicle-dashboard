import { normalizePathname, pathMatchesPfadliste } from "./routeAccess";

export const CMS_ROOT = "/cms" as const;

/**
 * CMS ist für Nutzer mit Dashboard-Zugriff nutzbar (analog sichtbar wie
 * Content-Bereiche in der Konsole), zusätzlich bei expliziter `/cms`-Zeile.
 */
export function mayAccessCms(pfade: readonly string[]): boolean {
  if (pathMatchesPfadliste(CMS_ROOT, pfade)) return true;
  return pathMatchesPfadliste("/dashboard", pfade);
}

export function isCmsPath(pathname: string): boolean {
  const p = normalizePathname(pathname);
  return p === CMS_ROOT || p.startsWith(`${CMS_ROOT}/`);
}
