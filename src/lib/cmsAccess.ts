import { normalizePathname, pathMatchesPfadliste } from "./routeAccess";

export const CMS_ROOT = "/cms" as const;

/**
 * Alle CMS-Medien liegen im R2-Bucket `env.assets` unter diesem Prefix
 * (Keys wie `cms/…`, öffentlich unter der Asset-Domain).
 */
export const CMS_ASSETS_FOLDER = "cms" as const;

/** Medien-Detail (Metadaten + große Vorschau): `/cms/media/asset?key=…` */
export function cmsMediaAssetEditUrl(r2Key: string): string {
  const q = new URLSearchParams({ key: r2Key });
  return `${CMS_ROOT}/media/asset?${q.toString()}`;
}

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
