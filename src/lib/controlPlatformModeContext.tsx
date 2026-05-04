import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type {
  ControlPlatformImageDeliveryMode,
  ControlPlatformTranscodeFormat,
} from "./controlPlatformImageDelivery";

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

/**
 * Erlaubte Polling-Intervalle (in Millisekunden) – die Auswahl ist auf
 * eine kleine, sinnvolle Whitelist beschränkt, damit der Server nicht
 * unnötig hart angefragt wird.
 */
export const CONTROL_PLATFORM_LIVE_INTERVAL_OPTIONS_MS = [
  1_000, 3_000, 5_000, 10_000, 20_000, 30_000, 60_000,
] as const;

export type ControlPlatformLiveIntervalMs =
  (typeof CONTROL_PLATFORM_LIVE_INTERVAL_OPTIONS_MS)[number];

/** Default-Intervall, wenn der Nutzer nichts gesetzt hat. */
export const CONTROL_PLATFORM_LIVE_DEFAULT_MS: ControlPlatformLiveIntervalMs =
  1_000;

const LIVE_ENABLED_STORAGE_KEY = "controlPlatform.live.enabled";
const LIVE_INTERVAL_STORAGE_KEY = "controlPlatform.live.intervalMs";

const IMAGE_DELIVERY_MODE_STORAGE_KEY = "controlPlatform.imageDelivery.mode";
const IMAGE_DELIVERY_CUSTOM_F_STORAGE_KEY =
  "controlPlatform.imageDelivery.customFormat";
const IMAGE_DELIVERY_CUSTOM_Q_STORAGE_KEY =
  "controlPlatform.imageDelivery.customQuality";

const DEFAULT_CUSTOM_IMAGE_QUALITY = 75;

function readDeliveryModeFromStorage(): ControlPlatformImageDeliveryMode {
  if (typeof window === "undefined") return "normal";
  try {
    const v = window.localStorage.getItem(IMAGE_DELIVERY_MODE_STORAGE_KEY);
    if (v === "performance" || v === "custom") return v;
  } catch {
    /* noop */
  }
  return "normal";
}

function readCustomFormatFromStorage(): ControlPlatformTranscodeFormat {
  if (typeof window === "undefined") return "webp";
  try {
    const v = window.localStorage.getItem(IMAGE_DELIVERY_CUSTOM_F_STORAGE_KEY);
    if (v === "avif" || v === "webp") return v;
  } catch {
    /* noop */
  }
  return "webp";
}

function readCustomQualityFromStorage(): number {
  if (typeof window === "undefined") return DEFAULT_CUSTOM_IMAGE_QUALITY;
  try {
    const v = window.localStorage.getItem(IMAGE_DELIVERY_CUSTOM_Q_STORAGE_KEY);
    if (v == null) return DEFAULT_CUSTOM_IMAGE_QUALITY;
    const n = Number(v);
    if (!Number.isFinite(n)) return DEFAULT_CUSTOM_IMAGE_QUALITY;
    return Math.min(100, Math.max(1, Math.round(n)));
  } catch {
    return DEFAULT_CUSTOM_IMAGE_QUALITY;
  }
}

/** Snappt einen beliebigen Wert auf den nächsten erlaubten Options-Wert. */
function snapInterval(n: number): ControlPlatformLiveIntervalMs {
  if (!Number.isFinite(n)) return CONTROL_PLATFORM_LIVE_DEFAULT_MS;
  let best: ControlPlatformLiveIntervalMs =
    CONTROL_PLATFORM_LIVE_DEFAULT_MS;
  let bestDiff = Number.POSITIVE_INFINITY;
  for (const opt of CONTROL_PLATFORM_LIVE_INTERVAL_OPTIONS_MS) {
    const d = Math.abs(opt - n);
    if (d < bestDiff) {
      bestDiff = d;
      best = opt;
    }
  }
  return best;
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

function readIntervalFromStorage(): ControlPlatformLiveIntervalMs {
  if (typeof window === "undefined") return CONTROL_PLATFORM_LIVE_DEFAULT_MS;
  try {
    const v = window.localStorage.getItem(LIVE_INTERVAL_STORAGE_KEY);
    if (v == null) return CONTROL_PLATFORM_LIVE_DEFAULT_MS;
    const n = Number(v);
    if (!Number.isFinite(n)) return CONTROL_PLATFORM_LIVE_DEFAULT_MS;
    return snapInterval(n);
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
  /** Polling-Intervall in Millisekunden (snapt auf erlaubte Optionen). */
  liveIntervalMs: ControlPlatformLiveIntervalMs;
  setLiveIntervalMs: (ms: number) => void;
  /** CDN für Fahrzeugbilder: Original vs. `resimages` mit Transcoding. */
  imageDeliveryMode: ControlPlatformImageDeliveryMode;
  setImageDeliveryMode: (m: ControlPlatformImageDeliveryMode) => void;
  imageDeliveryCustomFormat: ControlPlatformTranscodeFormat;
  setImageDeliveryCustomFormat: (f: ControlPlatformTranscodeFormat) => void;
  imageDeliveryCustomQuality: number;
  setImageDeliveryCustomQuality: (q: number) => void;
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
  const [liveIntervalMs, setLiveIntervalMsState] =
    useState<ControlPlatformLiveIntervalMs>(() => readIntervalFromStorage());

  const [imageDeliveryMode, setImageDeliveryModeState] =
    useState<ControlPlatformImageDeliveryMode>(() =>
      readDeliveryModeFromStorage(),
    );
  const [imageDeliveryCustomFormat, setImageDeliveryCustomFormatState] =
    useState<ControlPlatformTranscodeFormat>(() =>
      readCustomFormatFromStorage(),
    );
  const [imageDeliveryCustomQuality, setImageDeliveryCustomQualityState] =
    useState<number>(() => readCustomQualityFromStorage());

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        IMAGE_DELIVERY_MODE_STORAGE_KEY,
        imageDeliveryMode,
      );
    } catch {
      /* noop */
    }
  }, [imageDeliveryMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        IMAGE_DELIVERY_CUSTOM_F_STORAGE_KEY,
        imageDeliveryCustomFormat,
      );
    } catch {
      /* noop */
    }
  }, [imageDeliveryCustomFormat]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        IMAGE_DELIVERY_CUSTOM_Q_STORAGE_KEY,
        String(imageDeliveryCustomQuality),
      );
    } catch {
      /* noop */
    }
  }, [imageDeliveryCustomQuality]);

  const setMode = useCallback((m: ControlPlatformViewsMode) => {
    setViewsMode(m);
  }, []);

  const setLiveEnabled = useCallback((b: boolean) => {
    setLiveEnabledState(b);
  }, []);

  const setLiveIntervalMs = useCallback((ms: number) => {
    setLiveIntervalMsState(snapInterval(ms));
  }, []);

  const setImageDeliveryMode = useCallback(
    (m: ControlPlatformImageDeliveryMode) => {
      setImageDeliveryModeState(m);
    },
    [],
  );

  const setImageDeliveryCustomFormat = useCallback(
    (f: ControlPlatformTranscodeFormat) => {
      setImageDeliveryCustomFormatState(f === "avif" ? "avif" : "webp");
    },
    [],
  );

  const setImageDeliveryCustomQuality = useCallback((q: number) => {
    if (!Number.isFinite(q)) return;
    setImageDeliveryCustomQualityState(Math.min(100, Math.max(1, Math.round(q))));
  }, []);

  const v = useMemo<Ctx>(
    () => ({
      viewsMode,
      setViewsMode: setMode,
      liveEnabled,
      setLiveEnabled,
      liveIntervalMs,
      setLiveIntervalMs,
      imageDeliveryMode,
      setImageDeliveryMode,
      imageDeliveryCustomFormat,
      setImageDeliveryCustomFormat,
      imageDeliveryCustomQuality,
      setImageDeliveryCustomQuality,
    }),
    [
      viewsMode,
      setMode,
      liveEnabled,
      setLiveEnabled,
      liveIntervalMs,
      setLiveIntervalMs,
      imageDeliveryMode,
      setImageDeliveryMode,
      imageDeliveryCustomFormat,
      setImageDeliveryCustomFormat,
      imageDeliveryCustomQuality,
      setImageDeliveryCustomQuality,
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
