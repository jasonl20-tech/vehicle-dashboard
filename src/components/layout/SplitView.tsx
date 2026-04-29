import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";

/**
 * Wiederverwendbares Split-Layout: links eine kollabierbare Sidebar,
 * rechts der Haupt-Editor. Höhe wird vom umgebenden DashboardLayout
 * (full-height) gesetzt — die einzelnen Pages müssen dafür im Layout
 * als full-height markiert sein.
 *
 * Persistenz des Collapse-Zustands erfolgt unter `storageKey` in
 * localStorage. Auf Mobile wird die Sidebar oben angezeigt
 * (collapsibler Header-Strip), darunter der Main-Bereich.
 */
export interface SplitViewProps {
  /** Eindeutiger Key für localStorage. */
  storageKey: string;
  /** Label, das im eingeklappten Zustand vertikal angezeigt wird (z. B. „Keys"). */
  asideLabel: string;
  /** Inhalt der Sidebar (Suche + Filter + Liste). */
  asideContent: ReactNode;
  /** Breite der Sidebar (Tailwind-Klasse). Standard: 300px. */
  asideWidthClass?: string;
  /** Inhalt des rechten Bereichs. */
  children: ReactNode;
  /** Optional: Bei sehr kompakten Pages kann die Sidebar links breiter werden. */
  className?: string;
}

function readBool(key: string, fallback = false): boolean {
  if (typeof window === "undefined") return fallback;
  try {
    const v = window.localStorage.getItem(key);
    if (v == null) return fallback;
    return v === "1";
  } catch {
    return fallback;
  }
}

function writeBool(key: string, val: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, val ? "1" : "0");
  } catch {
    // ignore
  }
}

export default function SplitView({
  storageKey,
  asideLabel,
  asideContent,
  asideWidthClass = "md:w-[300px]",
  children,
  className,
}: SplitViewProps) {
  const [collapsed, setCollapsed] = useState<boolean>(() =>
    readBool(storageKey, false),
  );

  useEffect(() => {
    writeBool(storageKey, collapsed);
  }, [storageKey, collapsed]);

  const toggle = useCallback(() => setCollapsed((v) => !v), []);

  return (
    <div
      className={`flex min-h-0 flex-1 flex-col md:flex-row ${className ?? ""}`}
    >
      {collapsed ? (
        <button
          type="button"
          onClick={toggle}
          title={`${asideLabel} einblenden`}
          aria-label={`${asideLabel} einblenden`}
          aria-expanded={false}
          className="group flex h-10 w-full shrink-0 items-center justify-center gap-1.5 border-b border-hair bg-ink-50 text-[11px] font-medium uppercase tracking-[0.12em] text-ink-700 transition hover:bg-ink-100 hover:text-ink-900 md:h-auto md:w-10 md:flex-col md:gap-2 md:border-b-0 md:border-r md:py-3 md:text-[10px]"
        >
          <ChevronsRight className="h-4 w-4 shrink-0" />
          <span className="md:[writing-mode:vertical-rl] md:[transform:rotate(180deg)]">
            {asideLabel}
          </span>
        </button>
      ) : (
        <aside
          className={`flex w-full shrink-0 flex-col border-b border-hair bg-white md:border-b-0 md:border-r ${asideWidthClass}`}
        >
          <div className="flex min-h-0 flex-1 flex-col">
            {/* Inhaltsbereich der Sidebar */}
            <div className="relative flex min-h-0 flex-1 flex-col">
              {/* Collapse-Knopf — ganz oben rechts in der Sidebar.
                  Gibt es nur auf Desktop (md:). */}
              <button
                type="button"
                onClick={toggle}
                title={`${asideLabel} einklappen`}
                aria-label={`${asideLabel} einklappen`}
                aria-expanded
                className="absolute right-2 top-2 z-10 hidden h-6 w-6 items-center justify-center rounded text-ink-400 transition hover:bg-ink-100 hover:text-ink-700 md:inline-flex"
              >
                <ChevronsLeft className="h-3.5 w-3.5" />
              </button>
              {asideContent}
            </div>
          </div>
        </aside>
      )}

      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        {children}
      </section>
    </div>
  );
}
