import { LayoutGrid, LogOut } from "lucide-react";
import { Link, Outlet } from "react-router-dom";
import { Logo } from "../brand/Logo";
import { useAuth } from "../../lib/auth";

/**
 * Eigenständige Hülle für die Control Platform — ohne Dashboard-Sidebar,
 * Command Palette oder andere Bereiche der Hauptkonsole.
 */
export default function ControlPlatformLayout() {
  const { logout } = useAuth();

  return (
    <div className="relative min-h-screen bg-paper text-ink-800">
      <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-white/[0.08] bg-night-900/95 px-4 backdrop-blur-md sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            to="/"
            className="inline-flex min-w-0 items-center gap-2 rounded-md text-white/95 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/70"
            aria-label="Zur Plattform-Auswahl"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-white/10">
              <LayoutGrid className="h-4 w-4 text-night-200" />
            </span>
            <Logo className="hidden h-[18px] w-auto text-white/90 sm:block" />
          </Link>
          <span
            className="hidden h-6 w-px bg-white/15 sm:block"
            aria-hidden
          />
          <span className="truncate text-[13px] font-semibold text-white">
            Control Platform
          </span>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-[12px] font-medium text-night-200 transition hover:border-white/25 hover:bg-white/10 hover:text-white"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Abmelden</span>
        </button>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-[1600px] px-5 py-6 sm:px-10 sm:py-8 lg:px-12 lg:py-10">
        <Outlet />
      </main>
    </div>
  );
}
