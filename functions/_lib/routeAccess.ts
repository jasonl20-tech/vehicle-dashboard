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

/** Steht eine erlaubte SPA-Route unter `spaRoot` (inkl. exakt `/dashboard`) — ohne Glob `*` aufzublasen (der hat ohnehin schon Zugriff). */
export function pfadlisteTouchesSpaSubtree(
  spaRoot: string,
  pfade: readonly string[],
): boolean {
  const root = normalizePathname(spaRoot).toLowerCase();
  const asChild = `${root}/`;

  for (const raw of pfade) {
    const trimmed = typeof raw === "string" ? raw.trim() : "";
    if (!trimmed || trimmed === "*") continue;

    let baseNorm: string;
    if (trimmed.toLowerCase().endsWith("/*")) {
      baseNorm = normalizePathname(trimmed.slice(0, -2)).toLowerCase();
    } else {
      baseNorm = normalizePathname(trimmed).toLowerCase();
    }

    if (baseNorm === root || baseNorm.startsWith(asChild)) return true;
  }
  return false;
}

/** Trifft `pathname` einen der Präfixe (exakt oder Unterpfad)? */
export function pathnameMatchesAnyApiPrefix(
  pathname: string,
  prefixes: readonly string[],
): boolean {
  const path = normalizePathname(pathname).toLowerCase();
  for (const prefixRaw of prefixes) {
    const prefix = normalizePathname(prefixRaw).toLowerCase();
    if (path === prefix || path.startsWith(`${prefix}/`)) return true;
  }
  return false;
}

/**
 * API-Routen, die zur SPA „Control Platform" gehören.
 * Bei freigegebenem `/control-platform`-Unterbaum in `sicherheitsstufen` nicht
 * manuell ergänzen nötig.
 */
export const CONTROL_PLATFORM_API_PATH_PREFIXES: readonly string[] = [
  "/api/databases/vehicle-imagery-controlling",
  "/api/databases/vehicle-imagery-status",
  "/api/configs/active-controll-mode",
  "/api/configs/controll-buttons",
  "/api/configs/controll-status",
  "/api/configs/first-views",
  "/api/configs/inside-views",
  "/api/intern-analytics/controll-platform-action",
  "/api/system/seed-missing-view-regen-status",
];

/**
 * API-Routen des Dashboard-Bereichs (`/dashboard/…`): alle im Repo vorkommenden
 * Pages-Function-Pfade unter `functions/api/` die von Dashboard-Views genutzt
 * werden können. Bei **mindestens einer** SPA-Zeile unter `/dashboard/…`
 * werden diese APIs automatisch freigeschaltet (Angelegte Daten-Zeilen wie
 * `/api/overview/*` bleiben optional und sind dann redundant).
 *
 * Hinweis: `/account` liegt **nicht** unter `/dashboard` und löst diese Liste
 * daher nicht aus (MFA-APIs ohnehin ausgenommen durch die Middleware).
 */
export const DASHBOARD_API_PATH_PREFIXES: readonly string[] = [
  "/api/analytics/customer-keys",
  "/api/analytics/oneauto-reports",
  "/api/analytics/_diag",
  "/api/assets",
  "/api/billing/payment-links",
  "/api/billing/payment-link",
  "/api/billing/payment-link-archive",
  "/api/billing/plans",
  "/api/billing/stripe-prices",
  "/api/configs/active-controll-mode",
  "/api/configs/controll-buttons",
  "/api/configs/controll-status",
  "/api/configs/first-views",
  "/api/configs/inside-views",
  "/api/configs/generation-views",
  "/api/configs/google-image-search",
  "/api/configs/preview-images",
  "/api/crm/customers",
  "/api/customers/keys",
  "/api/databases/vehicle-imagery",
  "/api/databases/vehicle-imagery-status",
  "/api/emails/jobs",
  "/api/emails/templates",
  "/api/emails/template-ai",
  "/api/emails/timeline",
  "/api/emails/tracking",
  "/api/intern-analytics/controll-jobs",
  "/api/intern-analytics/controll-platform-action",
  "/api/intern-analytics/controlling",
  "/api/intern-analytics/image-url-requests-customer-arcs",
  "/api/intern-analytics/image-url-requests-geo",
  "/api/intern-analytics/image-url-requests-ip-breakdown",
  "/api/intern-analytics/diag",
  "/api/mapping",
  "/api/overview/stats",
  "/api/system/blocked-vehicles",
  "/api/system/prompts",
  "/api/system/seed-missing-view-regen-status",
  "/api/vehicle-imagery/catalog",
  "/api/website/newsletter",
  "/api/website/submissions",
  "/api/website/submissions-by-country",
  "/api/website/trial-submissions",
];

/**
 * Admin-Oberfläche (`/admin-settings`): `settings`-Tabelle im D1 `configs`.
 * Aktiv, sobald `/admin-settings` oder `/admin-settings/*` in `sicherheitsstufen`
 * freigegeben ist (analog zu den anderen SPA-Wurzeln).
 */
export const ADMIN_SETTINGS_API_PATH_PREFIXES: readonly string[] = [
  "/api/admin/settings",
];

/**
 * User-Analytics (`/user-analytics`): wertet `controll_platform_logs` AE
 * pro Plattform-User aus.
 */
export const USER_ANALYTICS_API_PATH_PREFIXES: readonly string[] = [
  "/api/intern-analytics/user-analytics",
];

/** Intern: Kombination SPA-Wurzel + zugehörige API-Prefixe. */
const SPA_ROUTE_API_BUNDLES: ReadonlyArray<{
  spaRoot:
    | "/dashboard"
    | "/control-platform"
    | "/admin-settings"
    | "/user-analytics";
  apiPrefixes: readonly string[];
}> = [
  { spaRoot: "/control-platform", apiPrefixes: CONTROL_PLATFORM_API_PATH_PREFIXES },
  { spaRoot: "/dashboard", apiPrefixes: DASHBOARD_API_PATH_PREFIXES },
  {
    spaRoot: "/admin-settings",
    apiPrefixes: ADMIN_SETTINGS_API_PATH_PREFIXES,
  },
  {
    spaRoot: "/user-analytics",
    apiPrefixes: USER_ANALYTICS_API_PATH_PREFIXES,
  },
];

/**
 * Wenn die Pfadliste mindestens eine SPA-Route unter einer bekannten Wurzel
 * freischaltet (`/dashboard/…`, `/control-platform/…`, `/admin-settings`), werden die dort
 * definierten API-Prefixes automatisch ebenfalls durchgelassen.
 */
export function pathnameAllowedBySpaRouteApiBundle(
  pathname: string,
  pfade: readonly string[],
): boolean {
  const path = normalizePathname(pathname).toLowerCase();
  if (!path.startsWith("/api/")) return false;

  for (const bundle of SPA_ROUTE_API_BUNDLES) {
    if (!pfadlisteTouchesSpaSubtree(bundle.spaRoot, pfade)) continue;
    if (pathnameMatchesAnyApiPrefix(pathname, bundle.apiPrefixes)) return true;
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
