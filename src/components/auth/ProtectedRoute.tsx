import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import {
  DEVELOPER_HUB_PATH,
  mayAccessDeveloperHub,
} from "../../lib/developerOverviewLinks";
import { normalizePathname, pathMatchesPfadliste } from "../../lib/routeAccess";

/**
 * Plattform-Start und persönliche Account-Settings – immer nach Login ohne
 * gesonderte Routen-Zeile in D1 erreichbar. Damit kann jeder eingeloggte
 * Nutzer mindestens ausloggen und sein Konto / 2FA einrichten.
 */
const SPA_ROUTE_NO_ACL = new Set<string>(["/", "/account"]);

export default function ProtectedRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, erlaubtePfade } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-paper">
        <div className="flex items-center gap-2 text-[12px] uppercase tracking-[0.18em] text-ink-400">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500" />
          Lade Sitzung
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        state={{ from: `${location.pathname}${location.search}` }}
        replace
      />
    );
  }

  const pathNorm = normalizePathname(location.pathname);
  const accountAllowed =
    pathNorm === "/account" || pathNorm.startsWith("/account/");
  const developerHubAllowed =
    pathNorm === normalizePathname(DEVELOPER_HUB_PATH) &&
    mayAccessDeveloperHub(erlaubtePfade);
  if (
    !SPA_ROUTE_NO_ACL.has(pathNorm) &&
    !accountAllowed &&
    !developerHubAllowed &&
    !pathMatchesPfadliste(pathNorm, erlaubtePfade)
  ) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
