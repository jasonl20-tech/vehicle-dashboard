import { Link, Outlet } from "react-router-dom";
import { Logo } from "../brand/Logo";
import {
  type ControlPlatformViewsMode,
  CONTROL_PLATFORM_MODE_LABEL,
  CONTROL_PLATFORM_MODES,
  ControlPlatformModeProvider,
  useControlPlatformViewsMode,
} from "../../lib/controlPlatformModeContext";

function ControlChrome() {
  const { viewsMode, setViewsMode } = useControlPlatformViewsMode();

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink-800">
      <header className="flex h-9 shrink-0 items-center gap-2 border-b border-hair bg-paper px-2 py-1">
        <Link
          to="/"
          className="inline-flex min-w-0 shrink-0 items-center focus:outline-none focus-visible:ring-1 focus-visible:ring-ink-400"
          aria-label="Zurück zur Plattform"
        >
          <Logo className="h-[16px] w-auto text-ink-900" />
        </Link>

        <label className="sr-only" htmlFor="control-platform-views-mode">
          Modus
        </label>
        <select
          id="control-platform-views-mode"
          aria-label="Modus"
          value={viewsMode}
          onChange={(e) =>
            setViewsMode(e.target.value as ControlPlatformViewsMode)
          }
          className="max-w-[min(100vw-7rem,200px)] border border-hair bg-white py-0.5 pr-7 pl-1.5 text-[11px] text-ink-800 focus:border-ink-600 focus:outline-none"
        >
          {CONTROL_PLATFORM_MODES.map((m) => (
            <option key={m} value={m}>
              {CONTROL_PLATFORM_MODE_LABEL[m]}
            </option>
          ))}
        </select>
      </header>

      <main className="min-h-0 min-w-0 flex-1 p-1">
        <Outlet />
      </main>
    </div>
  );
}

/** Eigenständige Hülle — ohne Dashboard-Navigation. Moduswahl steuert Liste + Ansichten. */
export default function ControlPlatformLayout() {
  return (
    <ControlPlatformModeProvider>
      <ControlChrome />
    </ControlPlatformModeProvider>
  );
}
