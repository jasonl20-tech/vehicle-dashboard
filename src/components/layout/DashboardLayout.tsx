import { useCallback, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import { Menu } from "lucide-react";
import CommandPalette from "../CommandPalette";

const COLLAPSE_KEY = "ui.sidebar.collapsed";

function readCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

function useIsLg(): boolean {
  const [isLg, setIsLg] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.matchMedia("(min-width: 1024px)").matches;
  });
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = (e: MediaQueryListEvent) => setIsLg(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return isLg;
}

const FULL_WIDTH_KUNDEN_TEST_ANFRAGEN = "/kunden/test-anfragen" as const;

export default function DashboardLayout() {
  const { pathname } = useLocation();
  const isKundenTestAnfragen = pathname === FULL_WIDTH_KUNDEN_TEST_ANFRAGEN;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(readCollapsed);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const isLg = useIsLg();

  const toggleCollapse = useCallback(() => {
    setCollapsed((v) => {
      const next = !v;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  // Global ⌘K / Ctrl+K to open the command palette.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInputLike =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
        return;
      }
      // Optional: "/" to focus search when not typing somewhere else
      if (!isInputLike && e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Only allow collapsed mode on desktop. Mobile always renders expanded sidebar.
  const effectiveCollapsed = collapsed && isLg;

  return (
    <div className="relative min-h-screen bg-paper text-ink-800">
      {/* Layered background — sits behind everything, doesn't intercept clicks. */}
      <BackgroundLayer />

      <div className="relative flex min-h-screen w-full min-w-0">
        <Sidebar
          mobileOpen={mobileOpen}
          onClose={() => setMobileOpen(false)}
          collapsed={effectiveCollapsed}
          onToggleCollapse={toggleCollapse}
          onOpenPalette={() => setPaletteOpen(true)}
        />
        <main className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          <div
            className={
              isKundenTestAnfragen
                ? "relative flex min-h-0 w-full min-w-0 flex-1 flex-col px-3 py-0 sm:px-4 lg:px-5"
                : "relative mx-auto w-full min-w-0 max-w-[1480px] px-5 py-8 sm:px-10 sm:py-8 lg:px-14 lg:py-12"
            }
          >
            {isKundenTestAnfragen ? (
              <div className="shrink-0 border-b border-hair/60 py-2.5 lg:hidden">
                <button
                  type="button"
                  onClick={() => setMobileOpen(true)}
                  className="inline-flex items-center gap-2 text-sm text-ink-600 hover:text-ink-900"
                >
                  <Menu className="h-4 w-4" />
                  Menü
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="mb-6 inline-flex items-center gap-2 text-sm text-ink-600 hover:text-ink-900 lg:hidden"
              >
                <Menu className="h-4 w-4" />
                Menü
              </button>
            )}
            <div
              className={
                isKundenTestAnfragen
                  ? "min-h-0 w-full min-w-0 flex-1 flex flex-col"
                  : ""
              }
            >
              <Outlet />
            </div>
          </div>
        </main>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
      />
    </div>
  );
}

/**
 * Subtle, layered background:
 *   1) Soft radial colour fades (existing `bg-grid-fade`)
 *   2) Faint dot grid for depth
 *   3) Top vignette tint to anchor the page
 * All decorative, pointer-events-none, z-0.
 */
function BackgroundLayer() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      {/* Soft radial fades (tailwind: bg-grid-fade) */}
      <div className="absolute inset-0 bg-grid-fade" />
      {/* Dot grid */}
      <div
        className="absolute inset-0 opacity-[0.55]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(13,13,15,0.06) 1px, transparent 0)",
          backgroundSize: "22px 22px",
          maskImage:
            "linear-gradient(to bottom, rgba(0,0,0,0.85), rgba(0,0,0,0.55) 60%, rgba(0,0,0,0.2) 100%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, rgba(0,0,0,0.85), rgba(0,0,0,0.55) 60%, rgba(0,0,0,0.2) 100%)",
        }}
      />
      {/* Subtle accent glow top-left */}
      <div
        className="absolute -top-32 -left-32 h-[480px] w-[480px] rounded-full opacity-[0.18] blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgba(109,82,255,0.55), transparent 75%)",
        }}
      />
      {/* Subtle accent glow bottom-right */}
      <div
        className="absolute -bottom-40 -right-32 h-[520px] w-[520px] rounded-full opacity-[0.16] blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgba(62,207,142,0.5), transparent 75%)",
        }}
      />
    </div>
  );
}
