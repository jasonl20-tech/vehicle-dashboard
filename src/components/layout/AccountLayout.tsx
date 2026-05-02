import { ArrowLeft, LogOut } from "lucide-react";
import { Link, Outlet } from "react-router-dom";
import { Logo } from "../brand/Logo";
import { useAuth } from "../../lib/auth";

/**
 * Eigenständige Hülle für persönliche Account-Einstellungen.
 *
 * Bewusst NICHT unter `/dashboard` — die Navigation der Konsole steht hier
 * nicht zur Verfügung, der User soll sich auf Sicherheits- und Account-
 * relevante Einstellungen konzentrieren können. Zugriff: jeder eingeloggte
 * Nutzer (siehe `ProtectedRoute` Whitelist `SPA_ROUTE_NO_ACL`).
 */
export default function AccountLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-paper text-ink-900">
      <header className="border-b border-hair bg-paper">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4 sm:px-8">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-[12px] text-ink-500 transition-colors hover:text-ink-900"
              aria-label="Zur Plattform"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Plattform</span>
            </Link>
            <span aria-hidden className="h-4 w-px bg-hair" />
            <Link to="/account" className="inline-flex items-center" aria-label="Account">
              <Logo className="h-[16px] w-auto text-ink-900/80" />
            </Link>
            <span className="hidden text-[11px] uppercase tracking-[0.2em] text-ink-400 sm:inline">
              Account
            </span>
          </div>
          {user && (
            <div className="flex items-center gap-3">
              <span className="hidden text-[12px] text-ink-500 sm:inline">
                {user.benutzername}
              </span>
              <button
                type="button"
                onClick={() => void logout()}
                className="inline-flex items-center gap-2 rounded-md border border-hair bg-white px-2.5 py-1.5 text-[12px] font-medium text-ink-800 transition-colors hover:bg-night-900/[0.04]"
              >
                <LogOut className="h-3.5 w-3.5" /> Abmelden
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-6 py-10 sm:px-8 sm:py-14">
        <Outlet />
      </main>
    </div>
  );
}
