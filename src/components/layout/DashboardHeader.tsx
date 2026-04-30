import { Menu } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { flattenNav } from "./navConfig";

function usePageHeading(pathname: string): { page: string; section?: string } {
  return useMemo(() => {
    const routes = flattenNav();
    const sorted = [...routes].sort((a, b) => b.to.length - a.to.length);
    for (const r of sorted) {
      if (pathname === r.to) {
        return {
          page: r.label,
          section:
            r.parentLabel && r.parentLabel !== r.label
              ? r.parentLabel
              : r.section !== r.label
                ? r.section
                : undefined,
        };
      }
      if (r.to.length > 1 && pathname.startsWith(`${r.to}/`)) {
        return {
          page: r.label,
          section: r.parentLabel ? r.parentLabel : r.section,
        };
      }
    }
    if (pathname === "/") {
      return { page: "Übersicht" };
    }
    return { page: "Vehicleimagery" };
  }, [pathname]);
}

type Props = {
  onOpenMobileMenu: () => void;
  /** Rechts (z. B. CRM-Toolbar); Kommando-Suche nur in der Sidebar */
  trailing?: ReactNode;
  /** Schlanke Titelleiste ohne Sektion-Zeile */
  crmMode?: boolean;
};

/**
 * Fester oberer Balken in der Hauptspalte (neben der Sidebar) — dieselbe
 * Nacht-Optik wie `Sidebar`, sichtbar auf allen Dashboard-Seiten.
 */
export default function DashboardHeader({
  onOpenMobileMenu,
  trailing = null,
  crmMode = false,
}: Props) {
  const { pathname } = useLocation();
  const { page, section } = usePageHeading(pathname);
  const showSection = !crmMode && section && section !== page;

  return (
    <header
      className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-white/[0.07] bg-night-900/95 px-2 backdrop-blur-md sm:px-3 lg:px-4"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="press inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-night-200 transition hover:bg-white/[0.08] hover:text-white lg:hidden"
          aria-label="Menü öffnen"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div
          className="hidden h-7 w-px bg-white/10 md:block"
          aria-hidden
        />
        <div
          key={`${section ?? ""}|${page}`}
          className="animate-fade-down min-w-0 max-w-[min(40vw,200px)] py-0.5 sm:max-w-none"
        >
          {showSection && (
            <p className="truncate text-[10px] font-medium uppercase tracking-[0.16em] text-night-500">
              {section}
            </p>
          )}
          <h1 className="truncate text-[15px] font-semibold leading-tight text-white sm:text-base">
            {page}
          </h1>
        </div>
      </div>
      <div
        className={`flex min-w-0 flex-1 items-center justify-end gap-1.5 sm:gap-2 sm:pl-2 ${
          crmMode ? "max-w-none" : "max-w-[min(100%,520px)]"
        }`}
      >
        {trailing}
      </div>
    </header>
  );
}
