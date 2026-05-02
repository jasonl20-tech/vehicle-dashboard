import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Outlet, useLocation } from "react-router-dom";
import type { DashboardOutletContext } from "./dashboardOutletContext";
import { BILDBEMPFANG_HTML_CLASS } from "../../lib/bildempfangMapTheme";
import CommandPalette from "../CommandPalette";
import DashboardHeader from "./DashboardHeader";
import Sidebar from "./Sidebar";

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

const FULL_WIDTH_KUNDEN_TEST_ANFRAGEN = "/dashboard/kunden/test-anfragen" as const;
const BILDEMPFANG_PAGE = "/dashboard/ansichten/bildempfang" as const;
const KUNDEN_CRM = "/dashboard/kunden/crm" as const;
const KUNDEN_ANFRAGEN = "/dashboard/kunden/anfragen" as const;
const EMAIL_TEMPLATES = "/dashboard/emails/templates" as const;
const ASSETS_PAGE = "/dashboard/databases/assets" as const;

/**
 * Pfade, die das Split-View-Layout (kollabierbare Sidebar links + Editor
 * rechts) verwenden — sie benötigen die volle Viewport-Höhe analog zum
 * Email-Editor und dem CRM. Pfade mit `:param` werden über einen Match
 * geprüft.
 */
const SPLIT_VIEW_PREFIXES = [
  "/dashboard/kunden/keys",
  "/dashboard/kunden/test-keys",
  "/dashboard/systeme/prompts",
  "/dashboard/systeme/mapping",
  "/dashboard/systeme/blockierte-fahrzeuge",
  "/dashboard/emails/logs",
] as const;

function isSplitViewPath(pathname: string): boolean {
  return SPLIT_VIEW_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export default function DashboardLayout() {
  const { pathname } = useLocation();
  const isKundenTestAnfragen = pathname === FULL_WIDTH_KUNDEN_TEST_ANFRAGEN;
  const isKundenAnfragenPage = pathname === KUNDEN_ANFRAGEN;
  /**
   * Bildempfang ist eine reguläre Page mit Header + Karte als Hauptinhalt.
   * Die Karte wird hier nur noch als full-height-Container behandelt
   * (analog Email-Editor / CRM); der Ozean-Hintergrund wird in der Page
   * selbst gesetzt, damit globale Overlays (Cmd+K-Palette) zuverlässig
   * darüberliegen.
   */
  const isBildempfangPage = pathname === BILDEMPFANG_PAGE;
  const isCrmPage = pathname === KUNDEN_CRM;
  const isEmailEditor = pathname === EMAIL_TEMPLATES;
  const isAssetsPage = pathname === ASSETS_PAGE;
  const isSplitView = isSplitViewPath(pathname);
  /** Vollflächig + Header-Toolbar (wie CRM): Anfragen + Test Anfragen */
  const isKundenAnfragenLayout = isKundenAnfragenPage || isKundenTestAnfragen;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [headerTrailing, setHeaderTrailing] = useState<ReactNode | null>(null);
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

  useEffect(() => {
    const root = document.documentElement;
    if (isBildempfangPage) {
      root.classList.add(BILDBEMPFANG_HTML_CLASS);
    } else {
      root.classList.remove(BILDBEMPFANG_HTML_CLASS);
    }
    return () => root.classList.remove(BILDBEMPFANG_HTML_CLASS);
  }, [isBildempfangPage]);

  // Only allow collapsed mode on desktop. Mobile always renders expanded sidebar.
  const effectiveCollapsed = collapsed && isLg;

  const outletContext: DashboardOutletContext = useMemo(
    () => ({ setHeaderTrailing }),
    [],
  );
  /**
   * Wir behandeln Bildempfang nun wie Email-/Assets-Editor: full-height,
   * Header oben, Outlet darunter. Damit greift Cmd+K-Palette korrekt
   * darüber, statt unter der Karte zu landen.
   */
  const isFullHeightPage =
    isBildempfangPage ||
    isCrmPage ||
    isKundenAnfragenLayout ||
    isEmailEditor ||
    isAssetsPage ||
    isSplitView;
  const allowsHeaderTrailing =
    isCrmPage ||
    isKundenAnfragenLayout ||
    isEmailEditor ||
    isAssetsPage ||
    isSplitView ||
    isBildempfangPage;

  useEffect(() => {
    if (!allowsHeaderTrailing) {
      setHeaderTrailing(null);
    }
  }, [allowsHeaderTrailing]);

  return (
    <div className="relative min-h-screen bg-paper text-ink-800">
      {/* Layered background — sits behind everything, doesn't intercept clicks. */}
      <BackgroundLayer />

      <div className="relative flex w-full min-w-0 min-h-screen">
        <Sidebar
          mobileOpen={mobileOpen}
          onClose={() => setMobileOpen(false)}
          collapsed={effectiveCollapsed}
          onToggleCollapse={toggleCollapse}
          onOpenPalette={() => setPaletteOpen(true)}
        />
        <main
          className={`relative flex min-h-0 min-w-0 flex-1 flex-col ${
            isFullHeightPage ? "h-[100dvh] min-h-0" : ""
          }`}
        >
          <DashboardHeader
            onOpenMobileMenu={() => setMobileOpen(true)}
            trailing={allowsHeaderTrailing ? headerTrailing : null}
            crmMode={allowsHeaderTrailing}
          />
          <div
            className={
              isFullHeightPage
                ? "relative flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden p-0"
                : "relative mx-auto w-full min-w-0 max-w-[1480px] px-5 pb-8 pt-4 sm:px-10 sm:pb-8 sm:pt-5 lg:px-14 lg:pb-12 lg:pt-6"
            }
          >
            {/*
             * `key={pathname}` zwingt React zum Re-Mount bei Routen-Wechsel,
             * dadurch greift `animate-fade-up` als Page-Transition für ALLE
             * Dashboard-Seiten kostenlos. `will-change: opacity, transform`
             * hält die GPU-Pipeline kurz aktiv, ohne Layout-Thrashing.
             */}
            <div
              key={pathname}
              style={{ willChange: "opacity, transform" }}
              className={
                isFullHeightPage
                  ? "animate-fade-up flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden"
                  : "animate-fade-up"
              }
            >
              <Outlet context={outletContext} />
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
 * Dezenter Hintergrund: subtiles Punktraster ohne radiale Akzent-Bubbles.
 * Die früher genutzten Glow-Punkte (lila/grün) wurden auf Wunsch entfernt,
 * das UI wirkt damit klarer und ruhiger.
 */
function BackgroundLayer() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <div
        className="absolute inset-0 opacity-[0.45]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(13,13,15,0.05) 1px, transparent 0)",
          backgroundSize: "22px 22px",
          maskImage:
            "linear-gradient(to bottom, rgba(0,0,0,0.6), rgba(0,0,0,0.25) 70%, rgba(0,0,0,0.05) 100%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, rgba(0,0,0,0.6), rgba(0,0,0,0.25) 70%, rgba(0,0,0,0.05) 100%)",
        }}
      />
    </div>
  );
}
