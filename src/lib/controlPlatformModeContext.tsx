import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export const CONTROL_PLATFORM_MODES = [
  "korrektur",
  "transparenz",
  "skalierung",
  "schatten",
] as const;

export type ControlPlatformViewsMode = (typeof CONTROL_PLATFORM_MODES)[number];

export const CONTROL_PLATFORM_MODE_LABEL: Record<
  ControlPlatformViewsMode,
  string
> = {
  korrektur: "Korrektur",
  transparenz: "Transparenz",
  skalierung: "Skalierung",
  schatten: "Schatten",
};

/** Untergrenze für das Live-Polling-Intervall (Millisekunden). */
export const CONTROL_PLATFORM_LIVE_MIN_MS = 50;
/** Obergrenze, oberhalb derer Live nicht mehr sinnvoll ist. */
export const CONTROL_PLATFORM_LIVE_MAX_MS = 600_000;
/** Default-Intervall, wenn der Nutzer nichts gesetzt hat. */
export const CONTROL_PLATFORM_LIVE_DEFAULT_MS = 1000;

const LIVE_ENABLED_STORAGE_KEY = "controlPlatform.live.enabled";
const LIVE_INTERVAL_STORAGE_KEY = "controlPlatform.live.intervalMs";

function clampInterval(n: number): number {
  if (!Number.isFinite(n)) return CONTROL_PLATFORM_LIVE_DEFAULT_MS;
  return Math.min(
    CONTROL_PLATFORM_LIVE_MAX_MS,
    Math.max(CONTROL_PLATFORM_LIVE_MIN_MS, Math.round(n)),
  );
}

function readBoolFromStorage(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  try {
    const v = window.localStorage.getItem(key);
    if (v === "1" || v === "true") return true;
    if (v === "0" || v === "false") return false;
  } catch {
    /* noop */
  }
  return fallback;
}

function readIntervalFromStorage(): number {
  if (typeof window === "undefined") return CONTROL_PLATFORM_LIVE_DEFAULT_MS;
  try {
    const v = window.localStorage.getItem(LIVE_INTERVAL_STORAGE_KEY);
    if (v == null) return CONTROL_PLATFORM_LIVE_DEFAULT_MS;
    const n = Number(v);
    if (!Number.isFinite(n)) return CONTROL_PLATFORM_LIVE_DEFAULT_MS;
    return clampInterval(n);
  } catch {
    return CONTROL_PLATFORM_LIVE_DEFAULT_MS;
  }
}

type Ctx = {
  viewsMode: ControlPlatformViewsMode;
  setViewsMode: (m: ControlPlatformViewsMode) => void;
  /** Live-Polling aktiv? */
  liveEnabled: boolean;
  setLiveEnabled: (b: boolean) => void;
  /** Polling-Intervall in Millisekunden (geclamped auf [min, max]). */
  liveIntervalMs: number;
  setLiveIntervalMs: (ms: number) => void;
};

const ControlPlatformModeContext = createContext<Ctx | null>(null);

export function ControlPlatformModeProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [viewsMode, setViewsMode] =
    useState<ControlPlatformViewsMode>("korrektur");

  const [liveEnabled, setLiveEnabledState] = useState<boolean>(() =>
    readBoolFromStorage(LIVE_ENABLED_STORAGE_KEY, false),
  );
  const [liveIntervalMs, setLiveIntervalMsState] = useState<number>(() =>
    readIntervalFromStorage(),
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        LIVE_ENABLED_STORAGE_KEY,
        liveEnabled ? "1" : "0",
      );
    } catch {
      /* noop */
    }
  }, [liveEnabled]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        LIVE_INTERVAL_STORAGE_KEY,
        String(liveIntervalMs),
      );
    } catch {
      /* noop */
    }
  }, [liveIntervalMs]);

  const setMode = useCallback((m: ControlPlatformViewsMode) => {
    setViewsMode(m);
  }, []);

  const setLiveEnabled = useCallback((b: boolean) => {
    setLiveEnabledState(b);
  }, []);

  const setLiveIntervalMs = useCallback((ms: number) => {
    setLiveIntervalMsState(clampInterval(ms));
  }, []);

  const v = useMemo<Ctx>(
    () => ({
      viewsMode,
      setViewsMode: setMode,
      liveEnabled,
      setLiveEnabled,
      liveIntervalMs,
      setLiveIntervalMs,
    }),
    [
      viewsMode,
      setMode,
      liveEnabled,
      setLiveEnabled,
      liveIntervalMs,
      setLiveIntervalMs,
    ],
  );

  return (
    <ControlPlatformModeContext.Provider value={v}>
      {children}
    </ControlPlatformModeContext.Provider>
  );
}

export function useControlPlatformViewsMode(): Ctx {
  const x = useContext(ControlPlatformModeContext);
  if (!x) {
    throw new Error("useControlPlatformViewsMode ohne Provider");
  }
  return x;
}
