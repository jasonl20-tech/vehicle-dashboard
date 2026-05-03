import { ArrowLeft, LineChart, LogOut } from "lucide-react";
import { Link } from "react-router-dom";
import { Logo } from "../components/brand/Logo";
import { useAuth } from "../lib/auth";

/**
 * Top-Level-Bereich User Analytics (/user-analytics).
 * Inhalt folgt; Zugriff über sicherheitsstufen-Pfad wie andere Plattform-Kacheln.
 */
export default function UserAnalyticsPage() {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink-900">
      <header className="shrink-0 border-b border-hair bg-paper">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-[12px] text-ink-500 transition-colors hover:text-ink-900"
            >
              <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
              Plattform
            </Link>
            <span aria-hidden className="h-4 w-px shrink-0 bg-hair" />
            <Link to="/" className="inline-flex min-w-0 items-center gap-2">
              <Logo className="h-[15px] w-auto shrink-0 text-ink-900/80" />
              <span className="hidden truncate text-[11px] uppercase tracking-[0.18em] text-ink-400 sm:inline">
                User Analytics
              </span>
            </Link>
          </div>
          {user && (
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="hidden max-w-[140px] truncate text-[12px] text-ink-500 sm:inline">
                {user.benutzername}
              </span>
              <button
                type="button"
                onClick={() => void logout()}
                className="inline-flex items-center gap-2 rounded-md border border-hair bg-white px-2.5 py-1.5 text-[12px] font-medium text-ink-800 transition-colors hover:bg-night-900/[0.04]"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Abmelden</span>
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-ink-900 text-white">
            <LineChart className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-400">
              Plattform
            </p>
            <h1 className="mt-1 font-display text-[28px] font-semibold tracking-tightish text-ink-900 sm:text-[34px]">
              User Analytics
            </h1>
            <p className="mt-4 max-w-xl text-[13px] leading-relaxed text-ink-600">
              Hier entsteht die Auswertung von Nutzeraktivität und
              Nutzungsmetriken. Der Bereich ist vorbereitet — konkrete
              Dashboards und Datenquellen können Schritt für Schritt
              angebunden werden.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
