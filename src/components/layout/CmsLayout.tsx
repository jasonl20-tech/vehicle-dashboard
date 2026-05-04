import {
  Box,
  ChevronDown,
  Globe,
  Image as ImageIcon,
  LayoutGrid,
  LogOut,
  Settings,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { Logo } from "../brand/Logo";
import { useAuth } from "../../lib/auth";
import { CMS_ROOT } from "../../lib/cmsAccess";

const navClass = ({ isActive }: { isActive: boolean }) =>
  [
    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] font-medium transition-colors",
    isActive
      ? "bg-ink-900 text-white shadow-sm"
      : "text-ink-600 hover:bg-night-900/[0.05] hover:text-ink-900",
  ].join(" ");

export default function CmsLayout() {
  const { user, logout } = useAuth();
  const [spaceOpen, setSpaceOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[#f5f5f2] text-ink-900">
      <aside
        className="sticky top-0 flex h-screen w-[280px] shrink-0 flex-col border-r border-hair bg-white"
        aria-label="CMS Navigation"
      >
        <div className="flex h-[3.75rem] items-center border-b border-hair px-5">
          <Link
            to={CMS_ROOT}
            className="inline-flex min-w-0 items-center"
            aria-label="CMS — zur Übersicht"
          >
            <Logo className="h-6 w-auto shrink-0 text-ink-900" />
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-5">
          <NavLink to={CMS_ROOT} end className={navClass}>
            <LayoutGrid className="h-[18px] w-[18px] shrink-0 opacity-80" />
            Übersicht
          </NavLink>

          <p className="mb-2 mt-6 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-400">
            Inhalt
          </p>
          <NavLink to={`${CMS_ROOT}/models`} className={navClass}>
            <Sparkles className="h-[18px] w-[18px] shrink-0 opacity-80" />
            Content-Modelle
          </NavLink>
          <NavLink to={`${CMS_ROOT}/entries`} className={navClass}>
            <Box className="h-[18px] w-[18px] shrink-0 opacity-80" />
            Content
          </NavLink>
          <NavLink to={`${CMS_ROOT}/media`} className={navClass}>
            <ImageIcon className="h-[18px] w-[18px] shrink-0 opacity-80" />
            Medien
          </NavLink>
          <NavLink to={`${CMS_ROOT}/locales`} className={navClass}>
            <Globe className="h-[18px] w-[18px] shrink-0 opacity-80" />
            Sprachen
          </NavLink>

          <p className="mb-2 mt-6 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-400">
            Space
          </p>
          <NavLink to={`${CMS_ROOT}/settings`} className={navClass}>
            <Settings className="h-[18px] w-[18px] shrink-0 opacity-80" />
            Einstellungen
          </NavLink>
        </nav>

        <div className="flex justify-end border-t border-hair p-3">
          <NavLink
            to="/"
            className="rounded-lg px-3 py-2 text-[12px] font-medium text-ink-500 transition hover:bg-night-900/[0.04] hover:text-ink-800"
          >
            Plattform
          </NavLink>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-[3.75rem] shrink-0 items-center justify-between gap-4 border-b border-hair bg-white/90 px-6 backdrop-blur lg:px-8">
          <div className="relative min-w-0">
            <button
              type="button"
              onClick={() => setSpaceOpen((v) => !v)}
              className="flex max-w-full items-center gap-2 rounded-lg border border-hair bg-white px-3.5 py-2 text-left text-[13px] font-medium text-ink-800 shadow-sm transition hover:border-ink-200"
            >
              <span className="truncate">Space · Produktions-Space</span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-ink-400 transition ${spaceOpen ? "rotate-180" : ""}`}
              />
            </button>
            {spaceOpen && (
              <div
                role="menu"
                className="absolute left-0 top-full z-20 mt-2 w-56 rounded-lg border border-hair bg-white py-1 shadow-lg"
              >
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-[12px] text-ink-900 hover:bg-ink-50"
                  onClick={() => setSpaceOpen(false)}
                >
                  Produktions-Space
                  <span className="ml-2 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                    aktiv
                  </span>
                </button>
                <button
                  type="button"
                  disabled
                  className="block w-full cursor-not-allowed px-3 py-2 text-left text-[12px] text-ink-400 opacity-60"
                  title="Preview-Space folgt"
                >
                  Preview-Space
                  <span className="ml-2 text-[10px] font-medium text-ink-400">
                    demnächst
                  </span>
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {user && (
              <span className="hidden max-w-[10rem] truncate text-[12px] text-ink-500 sm:inline">
                {user.titel || user.benutzername}
              </span>
            )}
            <button
              type="button"
              onClick={() => void logout()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-hair bg-white px-2.5 py-1.5 text-[12px] font-medium text-ink-700 transition hover:bg-ink-50"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Abmelden</span>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6 lg:p-10 xl:px-12">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
