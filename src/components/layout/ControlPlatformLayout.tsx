import { Link, Outlet } from "react-router-dom";
import { Logo } from "../brand/Logo";
import {
  type ControlPlatformViewsMode,
  CONTROL_PLATFORM_LIVE_INTERVAL_OPTIONS_MS,
  CONTROL_PLATFORM_MODE_LABEL,
  CONTROL_PLATFORM_MODES,
  ControlPlatformModeProvider,
  useControlPlatformViewsMode,
} from "../../lib/controlPlatformModeContext";

function formatIntervalLabel(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  const s = ms / 1000;
  return Number.isInteger(s) ? `${s} s` : `${s.toFixed(1)} s`;
}

function LiveControls() {
  const { liveEnabled, setLiveEnabled, liveIntervalMs, setLiveIntervalMs } =
    useControlPlatformViewsMode();

  return (
    <div className="ml-auto flex shrink-0 items-center gap-1">
      <button
        type="button"
        onClick={() => setLiveEnabled(!liveEnabled)}
        aria-pressed={liveEnabled}
        title={
          liveEnabled
            ? `Live-Updates aktiv (${formatIntervalLabel(liveIntervalMs)})`
            : "Live-Updates aktivieren"
        }
        className={`inline-flex h-6 items-center gap-1 rounded border px-1.5 text-[11px] font-medium transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-ink-400 ${
          liveEnabled
            ? "border-emerald-500 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
            : "border-hair bg-white text-ink-600 hover:bg-ink-50"
        }`}
      >
        <span
          aria-hidden
          className={`inline-block h-1.5 w-1.5 rounded-full ${
            liveEnabled
              ? "bg-emerald-500 animate-pulse"
              : "bg-ink-300"
          }`}
        />
        Live
      </button>

      <label className="sr-only" htmlFor="control-platform-live-interval">
        Aktualisierungsintervall
      </label>
      <select
        id="control-platform-live-interval"
        aria-label="Aktualisierungsintervall"
        title="Wie oft die Status-Daten aktualisiert werden"
        value={liveIntervalMs}
        onChange={(e) => setLiveIntervalMs(Number(e.target.value))}
        className={`h-6 border bg-white py-0 pr-6 pl-1.5 text-[11px] tabular-nums focus:outline-none ${
          liveEnabled
            ? "border-emerald-300 text-ink-800 focus:border-emerald-500"
            : "border-hair text-ink-600 focus:border-ink-600"
        }`}
      >
        {CONTROL_PLATFORM_LIVE_INTERVAL_OPTIONS_MS.map((ms) => (
          <option key={ms} value={ms}>
            {formatIntervalLabel(ms)}
          </option>
        ))}
      </select>
    </div>
  );
}

function ControlChrome() {
  const { viewsMode, setViewsMode } = useControlPlatformViewsMode();

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-paper text-ink-800">
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

        <LiveControls />
      </header>

      <main className="flex min-h-0 min-w-0 flex-1 p-1">
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
