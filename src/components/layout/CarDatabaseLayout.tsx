import { LogOut } from "lucide-react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { Logo } from "../brand/Logo";
import { useAuth } from "../../lib/auth";

const navCls = ({ isActive }: { isActive: boolean }) =>
  `inline-flex h-8 items-center rounded-full px-3 text-[12px] transition-colors ${
    isActive
      ? "bg-ink-900 text-white"
      : "text-ink-500 hover:bg-ink-50 hover:text-ink-900"
  }`;

/**
 * Eigenständige Hülle für die „Car Database" — ohne Dashboard-Navigation.
 * Top-Level-Bereich wie Control Platform (vom Hauptbildschirm aus erreichbar).
 */
export default function CarDatabaseLayout() {
  const { logout } = useAuth();

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-paper text-ink-900">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-hair bg-paper px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            to="/"
            aria-label="Zurück zur Übersicht"
            className="inline-flex items-center focus:outline-none focus-visible:ring-1 focus-visible:ring-ink-400"
          >
            <Logo className="h-4 w-auto text-ink-900" />
          </Link>
          <span className="truncate text-[11px] uppercase tracking-[0.18em] text-ink-400">
            Car Database
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <NavLink to="/car-database" end className={navCls}>
            Übersicht
          </NavLink>
          <NavLink to="/car-database/eintraege" className={navCls}>
            Datenbank
          </NavLink>
          <button
            type="button"
            onClick={() => void logout()}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-hair bg-white px-3 text-[12px] font-medium text-ink-600 transition hover:border-ink-200 hover:text-ink-900"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Abmelden</span>
          </button>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
