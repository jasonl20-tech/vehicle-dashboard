import { BarChart3, LayoutGrid, LogOut, Sparkles, Table2 } from "lucide-react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { Logo } from "../brand/Logo";
import { useAuth } from "../../lib/auth";

/**
 * Eigenständige Hülle für die „Car Database" mit Sidebar-Navigation zu den
 * Unterseiten (Übersicht / Datenbank / Galerie). Top-Level-Bereich wie Control
 * Platform. Desktop: feste Sidebar links; mobil: Tab-Leiste oben.
 */
const NAV = [
  { to: "/car-database", label: "Übersicht", icon: BarChart3, end: true },
  { to: "/car-database/eintraege", label: "Datenbank", icon: Table2, end: false },
  { to: "/car-database/galerie", label: "Galerie", icon: LayoutGrid, end: false },
  { to: "/car-database/demo", label: "Demo", icon: Sparkles, end: false },
];

const linkCls = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2 rounded-md px-2.5 py-2 text-[13px] transition-colors ${
    isActive
      ? "bg-ink-900 text-white"
      : "text-ink-600 hover:bg-ink-100 hover:text-ink-900"
  }`;

const tabCls = ({ isActive }: { isActive: boolean }) =>
  `inline-flex h-8 shrink-0 items-center rounded-full px-3 text-[12px] transition-colors ${
    isActive
      ? "bg-ink-900 text-white"
      : "text-ink-500 hover:bg-ink-50 hover:text-ink-900"
  }`;

export default function CarDatabaseLayout() {
  const { logout } = useAuth();

  return (
    <div className="flex h-screen overflow-hidden bg-paper text-ink-900">
      {/* Sidebar (Desktop) */}
      <aside className="hidden w-52 shrink-0 flex-col border-r border-hair bg-paper md:flex">
        <div className="flex h-14 items-center border-b border-hair px-4">
          <Link
            to="/"
            aria-label="Zurück zum Hauptbildschirm"
            className="inline-flex items-center focus:outline-none focus-visible:ring-1 focus-visible:ring-ink-400"
          >
            <Logo className="h-4 w-auto text-ink-900" />
          </Link>
        </div>
        <div className="px-3 pb-1 pt-3 text-[10px] uppercase tracking-[0.18em] text-ink-400">
          Car Database
        </div>
        <nav className="flex flex-col gap-0.5 px-2">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={linkCls}>
              <n.icon className="h-4 w-4 shrink-0" />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto border-t border-hair p-3">
          <button
            type="button"
            onClick={() => void logout()}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-hair bg-white px-3 py-2 text-[12px] font-medium text-ink-600 transition hover:border-ink-200 hover:text-ink-900"
          >
            <LogOut className="h-3.5 w-3.5" />
            Abmelden
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar (Mobile) */}
        <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-hair bg-paper px-3 md:hidden">
          <Link to="/" className="inline-flex shrink-0 items-center">
            <Logo className="h-4 w-auto text-ink-900" />
          </Link>
          <nav className="flex items-center gap-1 overflow-x-auto">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={tabCls}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <button
            type="button"
            onClick={() => void logout()}
            aria-label="Abmelden"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-hair bg-white text-ink-600 hover:text-ink-900"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
