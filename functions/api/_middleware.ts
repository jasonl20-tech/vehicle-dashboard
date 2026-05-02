import {
  getCurrentUser,
  jsonResponse,
  type AuthEnv,
} from "../_lib/auth";
import {
  fetchPathsForSecurityLevel,
  normalizePathname,
  pathMatchesPfadliste,
  pathnameAllowedBySpaRouteApiBundle,
} from "../_lib/routeAccess";

/** Keine Session oder kein Zugriffs-Check für diese Routen erforderlich. */
const PRE_SESSION_PATH = new Set<string>([
  "/api/login",
  "/api/login-totp",
  "/api/setup-password",
  "/api/logout",
]);

/** Nur Session, keine Routen-Pflicht (lädt u. a. erlaubte Pfade fürs Frontend). */
const AUTH_NO_ROUTE_ACL = new Set<string>(["/api/me"]);

export async function onRequest(context: {
  request: Request;
  next: () => Promise<Response>;
  env: AuthEnv;
}) {
  const { request, env, next } = context;
  const pathname = normalizePathname(new URL(request.url).pathname);

  if (request.method === "OPTIONS") {
    return next();
  }

  if (PRE_SESSION_PATH.has(pathname)) {
    return next();
  }

  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }

  // 2FA wird erzwungen, ist aber noch nicht eingerichtet:
  // alle APIs außer MFA-Enrollment, Session-Info und Logout sperren.
  const mfaForcedSetup = user.mfa.requireTotp && !user.mfa.totpEnabled;
  if (mfaForcedSetup) {
    if (
      pathname.startsWith("/api/mfa") ||
      pathname === "/api/me" ||
      pathname === "/api/logout"
    ) {
      return next();
    }
    return jsonResponse(
      {
        error:
          "Zwei-Faktor ist Pflicht für dieses Konto. Bitte zuerst Authenticator einrichten.",
        mfaSetupRequired: true,
      },
      { status: 403 },
    );
  }

  if (pathname.startsWith("/api/mfa")) {
    return next();
  }

  if (AUTH_NO_ROUTE_ACL.has(pathname)) {
    return next();
  }

  try {
    const pfade = await fetchPathsForSecurityLevel(env, user.sicherheitsstufe);
    if (pathMatchesPfadliste(pathname, pfade)) {
      return next();
    }
    // SPA unter `/dashboard/…` bzw. `/control-platform/…` ohne jede Daten-API
    // einzeln in D1 → leere Screens. Hier: automatische Zuordnung SPA → APIs.
    if (pathnameAllowedBySpaRouteApiBundle(pathname, pfade)) {
      return next();
    }
  } catch {
    return jsonResponse(
      { error: "Berechtigungsdaten sind derzeit nicht verfügbar" },
      { status: 503 },
    );
  }

  return jsonResponse(
    { error: "Kein Zugriff auf diese API-Route" },
    { status: 403 },
  );
}
