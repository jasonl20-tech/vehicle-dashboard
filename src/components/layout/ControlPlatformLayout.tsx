import { useEffect, useMemo } from "react";
import { Link, Outlet } from "react-router-dom";
import { Logo } from "../brand/Logo";
import {
  ACTIVE_CONTROLL_MODE_SETTINGS_PATH,
  type ActiveControllModeApiResponse,
  activeViewsModes,
  DEFAULT_ACTIVE_CONTROLL_MODE_CONFIG,
  isViewsModeActive,
} from "../../lib/activeControllModeConfig";
import type { ControlPlatformImageDeliveryMode } from "../../lib/controlPlatformImageDelivery";
import {
  CONTROL_PLATFORM_PERFORMANCE_FORMAT,
  CONTROL_PLATFORM_PERFORMANCE_QUALITY,
} from "../../lib/controlPlatformImageDelivery";
import {
  type ControlPlatformViewsMode,
  CONTROL_PLATFORM_LIVE_INTERVAL_OPTIONS_MS,
  CONTROL_PLATFORM_MODE_LABEL,
  CONTROL_PLATFORM_MODES,
  ControlPlatformModeProvider,
  useControlPlatformViewsMode,
} from "../../lib/controlPlatformModeContext";
import { useApi } from "../../lib/customerApi";

function formatIntervalLabel(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  const s = ms / 1000;
  return Number.isInteger(s) ? `${s} s` : `${s.toFixed(1)} s`;
}

const IMAGE_DELIVERY_LABEL: Record<ControlPlatformImageDeliveryMode, string> =
  {
    normal: "Bilder: Normal",
    performance: "Bilder: Performance",
    custom: "Bilder: Benutzerdef.",
  };

const IMAGE_DELIVERY_ORDER: ControlPlatformImageDeliveryMode[] = [
  "normal",
  "performance",
  "custom",
];

function ImageDeliveryControls() {
  const {
    imageDeliveryMode,
    setImageDeliveryMode,
    imageDeliveryCustomFormat,
    setImageDeliveryCustomFormat,
    imageDeliveryCustomQuality,
    setImageDeliveryCustomQuality,
  } = useControlPlatformViewsMode();

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-1 gap-y-0.5 border-l border-hair pl-2">
      <label className="sr-only" htmlFor="control-platform-image-delivery">
        Bilddarstellung
      </label>
      <select
        id="control-platform-image-delivery"
        aria-label="Bilddarstellung"
        title={
          imageDeliveryMode === "performance"
            ? `Transcoded: ${CONTROL_PLATFORM_PERFORMANCE_FORMAT}, Qualität ${CONTROL_PLATFORM_PERFORMANCE_QUALITY}`
            : "Original-CDN vs. resimages mit f/q"
        }
        value={imageDeliveryMode}
        onChange={(e) =>
          setImageDeliveryMode(e.target.value as ControlPlatformImageDeliveryMode)
        }
        className="h-6 max-w-[10.5rem] border border-hair bg-white py-0 pr-6 pl-1 text-[11px] text-ink-800 focus:border-ink-600 focus:outline-none"
      >
        {IMAGE_DELIVERY_ORDER.map((m) => (
          <option key={m} value={m}>
            {IMAGE_DELIVERY_LABEL[m]}
          </option>
        ))}
      </select>

      {imageDeliveryMode === "custom" ?
        <>
          <label className="sr-only" htmlFor="control-platform-image-delivery-f">
            Ausgabeformat
          </label>
          <select
            id="control-platform-image-delivery-f"
            aria-label="Transcoding-Format"
            title="Ausgabeformat (f)"
            value={imageDeliveryCustomFormat}
            onChange={(e) =>
              setImageDeliveryCustomFormat(
                e.target.value === "avif" ? "avif" : "webp",
              )
            }
            className="h-6 w-[4.25rem] border border-hair bg-white py-0 pl-1 text-[11px] text-ink-800 focus:border-ink-600 focus:outline-none"
          >
            <option value="webp">WebP</option>
            <option value="avif">AVIF</option>
          </select>
          <label
            className="flex items-center gap-1 text-[10px] tabular-nums text-ink-600"
            htmlFor="control-platform-image-delivery-q"
            title="Qualität (q)"
          >
            <span className="hidden sm:inline">q</span>
            <input
              id="control-platform-image-delivery-q"
              type="range"
              min={1}
              max={100}
              value={imageDeliveryCustomQuality}
              onChange={(e) =>
                setImageDeliveryCustomQuality(Number(e.target.value))
              }
              className="h-4 w-[72px] max-w-[min(18vw,7rem)] accent-ink-700"
            />
            <span className="min-w-[1.5rem]">{imageDeliveryCustomQuality}</span>
          </label>
        </>
      : null}
    </div>
  );
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

  // `settings.active_controll_mode` aus D1 laden — kein Live-Polling nötig,
  // einmal pro Session reicht. Wenn der Endpoint (noch) keine Daten
  // liefert, verhalten wir uns wie bisher und zeigen alle Modi an.
  const activeModeApi = useApi<ActiveControllModeApiResponse>(
    ACTIVE_CONTROLL_MODE_SETTINGS_PATH,
  );
  const activeModeConfig =
    activeModeApi.data?.modes ?? DEFAULT_ACTIVE_CONTROLL_MODE_CONFIG;

  const visibleModes = useMemo(
    () => activeViewsModes(activeModeConfig),
    [activeModeConfig],
  );

  // Falls der aktuelle Modus deaktiviert wurde, automatisch auf den
  // ersten verfügbaren wechseln. Wenn alle Modi deaktiviert sind, lassen
  // wir den vorhandenen Wert stehen (nichts sinnvolles, aber kein Crash).
  useEffect(() => {
    if (visibleModes.length === 0) return;
    if (!isViewsModeActive(activeModeConfig, viewsMode)) {
      setViewsMode(visibleModes[0]);
    }
  }, [activeModeConfig, viewsMode, visibleModes, setViewsMode]);

  // Während die Konfig noch lädt wären alle Optionen aktiv; das lassen
  // wir bewusst so, damit der Select nie leer ist. Sobald die Daten da
  // sind, filtern wir.
  const renderedModes =
    visibleModes.length > 0 ? visibleModes : CONTROL_PLATFORM_MODES;

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
          {renderedModes.map((m) => (
            <option key={m} value={m}>
              {CONTROL_PLATFORM_MODE_LABEL[m]}
            </option>
          ))}
        </select>

        <ImageDeliveryControls />

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
