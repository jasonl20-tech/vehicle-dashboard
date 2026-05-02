import { useEffect, useState } from "react";
import { Link, Outlet } from "react-router-dom";
import { Logo } from "../brand/Logo";
import {
  type ControlPlatformViewsMode,
  CONTROL_PLATFORM_LIVE_MAX_MS,
  CONTROL_PLATFORM_LIVE_MIN_MS,
  CONTROL_PLATFORM_MODE_LABEL,
  CONTROL_PLATFORM_MODES,
  ControlPlatformModeProvider,
  useControlPlatformViewsMode,
} from "../../lib/controlPlatformModeContext";

function clampInterval(n: number): number {
  if (!Number.isFinite(n)) return CONTROL_PLATFORM_LIVE_MIN_MS;
  return Math.min(
    CONTROL_PLATFORM_LIVE_MAX_MS,
    Math.max(CONTROL_PLATFORM_LIVE_MIN_MS, Math.round(n)),
  );
}

function formatIntervalLabel(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  if (ms % 1000 === 0) return `${ms / 1000} s`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function LiveControls() {
  const { liveEnabled, setLiveEnabled, liveIntervalMs, setLiveIntervalMs } =
    useControlPlatformViewsMode();
  const [draft, setDraft] = useState<string>(String(liveIntervalMs));

  // Externe Updates (z. B. Hot-Reload) auf den Draft spiegeln,
  // wenn der Nutzer gerade nicht editiert.
  useEffect(() => {
    setDraft(String(liveIntervalMs));
  }, [liveIntervalMs]);

  const commitDraft = () => {
    const n = Number(draft);
    if (!Number.isFinite(n)) {
      setDraft(String(liveIntervalMs));
      return;
    }
    const clamped = clampInterval(n);
    setLiveIntervalMs(clamped);
    setDraft(String(clamped));
  };

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

      <div
        className={`inline-flex h-6 items-center overflow-hidden rounded border ${
          liveEnabled ? "border-emerald-300 bg-white" : "border-hair bg-white"
        }`}
        title="Aktualisierungsintervall in Millisekunden"
      >
        <label className="sr-only" htmlFor="control-platform-live-ms">
          Aktualisierungsintervall in Millisekunden
        </label>
        <input
          id="control-platform-live-ms"
          type="number"
          inputMode="numeric"
          min={CONTROL_PLATFORM_LIVE_MIN_MS}
          max={CONTROL_PLATFORM_LIVE_MAX_MS}
          step={50}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitDraft();
              (e.target as HTMLInputElement).blur();
            }
          }}
          className="h-full w-[68px] border-0 bg-transparent px-1.5 text-right font-mono text-[11px] tabular-nums text-ink-800 focus:outline-none"
        />
        <span className="select-none border-l border-hair px-1 font-mono text-[10px] text-ink-500">
          ms
        </span>
      </div>
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
