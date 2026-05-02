import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
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

type Ctx = {
  viewsMode: ControlPlatformViewsMode;
  setViewsMode: (m: ControlPlatformViewsMode) => void;
};

const ControlPlatformModeContext = createContext<Ctx | null>(null);

export function ControlPlatformModeProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [viewsMode, setViewsMode] =
    useState<ControlPlatformViewsMode>("korrektur");

  const set = useCallback((m: ControlPlatformViewsMode) => {
    setViewsMode(m);
  }, []);

  const v = useMemo(
    () => ({ viewsMode, setViewsMode: set }),
    [viewsMode, set],
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
