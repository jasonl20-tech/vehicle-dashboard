import {
  getCurrentUser,
  jsonResponse,
  type AuthEnv,
} from "../_lib/auth";
import {
  fetchPathsForSecurityLevel,
  normalizePathname,
  pathMatchesPfadliste,
} from "../_lib/routeAccess";

/** Keine Session oder kein Zugriffs-Check für diese Routen erforderlich. */
const PRE_SESSION_PATH = new Set<string>([
  "/api/login",
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

  if (AUTH_NO_ROUTE_ACL.has(pathname)) {
    return next();
  }

  try {
    const pfade = await fetchPathsForSecurityLevel(env, user.sicherheitsstufe);
    if (pathMatchesPfadliste(pathname, pfade)) {
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
