import {
  Box,
  ChevronDown,
  Clock,
  Calendar,
  LayoutGrid,
  LogOut,
  Search,
  Settings,
  Workflow,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useSearchParams,
} from "react-router-dom";
import { Logo } from "../brand/Logo";
import { useAuth } from "../../lib/auth";
import { CMS_ROOT } from "../../lib/cmsAccess";
import {
  CMS_CONTENT_MODELS_API,
  type CmsContentModelsListResponse,
} from "../../lib/cmsApi";
import { useApi } from "../../lib/customerApi";

function useEntriesNavActive() {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const onEntries = pathname === `${CMS_ROOT}/entries`;
  const modelFilter = searchParams.get("content_model_id") || "";
  return { onEntries, modelFilter, allEntries: onEntries && !modelFilter };
}

export default function CmsLayout() {
  const { pathname: path } = useLocation();
  const { user, logout } = useAuth();
  const [spaceOpen, setSpaceOpen] = useState(false);
  const { onEntries, modelFilter, allEntries } = useEntriesNavActive();

  const isModels = path.startsWith(`${CMS_ROOT}/models`);
  const isEntries = path.startsWith(`${CMS_ROOT}/entries`);
  const isMedia = path.startsWith(`${CMS_ROOT}/media`);
  const isN8n = path.startsWith("/n8n");
  const isApps =
    path === "/" ||
    path === "/developer" ||
    path.startsWith("/developer/");

  const tabClassFor = (active: boolean) =>
    [
      "relative shrink-0 border-b-2 px-1 pb-3 pt-1 text-[13px] font-medium transition-colors",
      active
        ? "border-brand-500 text-brand-600"
        : "border-transparent text-ink-500 hover:text-ink-800",
    ].join(" ");

  const modelsUrl = `${CMS_CONTENT_MODELS_API}?limit=500`;
  const models = useApi<CmsContentModelsListResponse>(modelsUrl);

  const sortedModels = useMemo(() => {
    const rows = models.data?.rows ?? [];
    return [...rows].sort((a, b) =>
      a.key.localeCompare(b.key, "de", { sensitivity: "base" }),
    );
  }, [models.data?.rows]);

  const sideItemBase =
    "flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] transition-colors";
  const sideItemActive = "bg-[#e8f0fe] font-medium text-[#1967d2]";
  const sideItemIdle = "text-ink-700 hover:bg-black/[0.04]";

  return (
    <div className="flex min-h-screen bg-[#f4f5f7] text-ink-900">
      <aside
        className="sticky top-0 flex h-screen w-[268px] shrink-0 flex-col border-r border-[#e8eaed] bg-white"
        aria-label="CMS Navigation"
      >
        <div className="flex h-14 items-center border-b border-[#e8eaed] px-4">
          <Link
            to={CMS_ROOT}
            className="inline-flex min-w-0 items-center"
            aria-label="CMS — Übersicht"
          >
            <Logo className="h-6 w-auto shrink-0 text-ink-900" />
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <Link
            to={`${CMS_ROOT}/entries`}
            className={[
              sideItemBase,
              allEntries ? sideItemActive : sideItemIdle,
            ].join(" ")}
          >
            <LayoutGrid className="h-4 w-4 shrink-0 opacity-90" />
            Alle Inhalte
          </Link>
          <button
            type="button"
            disabled
            title="Demnächst"
            className={`${sideItemBase} w-full cursor-not-allowed text-left text-ink-400`}
          >
            <Clock className="h-4 w-4 shrink-0" />
            Zuletzt
          </button>
          <button
            type="button"
            disabled
            title="Demnächst"
            className={`${sideItemBase} w-full cursor-not-allowed text-left text-ink-400`}
          >
            <Calendar className="h-4 w-4 shrink-0" />
            Geplant
          </button>

          <p className="mb-1.5 mt-6 px-3 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
            Ansichten
          </p>
          <p className="px-3 text-[12px] leading-snug text-ink-400">
            Gespeicherte Filter folgen.
          </p>

          <p className="mb-1.5 mt-6 px-3 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
            Content-Typ
          </p>
          <div className="space-y-0.5">
            {models.loading ? (
              <p className="px-3 py-2 text-[12px] text-ink-400">Laden …</p>
            ) : sortedModels.length === 0 ? (
              <p className="px-3 py-2 text-[12px] text-ink-400">
                Keine Modelle
              </p>
            ) : (
              sortedModels.map((m) => {
                const active =
                  onEntries && modelFilter === m.id;
                return (
                  <Link
                    key={m.id}
                    to={`${CMS_ROOT}/entries?content_model_id=${encodeURIComponent(m.id)}`}
                    className={[
                      sideItemBase,
                      active ? sideItemActive : sideItemIdle,
                    ].join(" ")}
                  >
                    <span className="truncate">{m.key}</span>
                  </Link>
                );
              })
            )}
          </div>

          <p className="mb-1.5 mt-8 px-3 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
            Space
          </p>
          <NavLink
            to={`${CMS_ROOT}/settings`}
            className={({ isActive }) =>
              [
                sideItemBase,
                isActive ? sideItemActive : sideItemIdle,
              ].join(" ")
            }
          >
            <Settings className="h-4 w-4 shrink-0 opacity-90" />
            Einstellungen
          </NavLink>
          <NavLink
            to={`${CMS_ROOT}/locales`}
            className={({ isActive }) =>
              [
                sideItemBase,
                isActive ? sideItemActive : sideItemIdle,
              ].join(" ")
            }
          >
            <Box className="h-4 w-4 shrink-0 opacity-90" />
            Sprachen
          </NavLink>
        </nav>

        <div className="border-t border-[#e8eaed] p-3">
          <Link
            to="/"
            className="block rounded-md px-3 py-2 text-center text-[12px] font-medium text-ink-500 transition hover:bg-black/[0.04] hover:text-ink-800"
          >
            Zur Plattform
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 shrink-0 border-b border-[#e8eaed] bg-white">
          <div className="flex h-14 items-center gap-4 overflow-x-auto px-4 lg:px-6">
            <nav
              className="flex min-w-0 flex-1 items-center gap-5 lg:gap-7"
              aria-label="CMS Bereiche"
            >
              <Link
                to={`${CMS_ROOT}/models`}
                className={tabClassFor(isModels)}
              >
                Content-Modell
              </Link>
              <Link
                to={`${CMS_ROOT}/entries`}
                className={tabClassFor(isEntries)}
              >
                Content
              </Link>
              <Link
                to={`${CMS_ROOT}/media`}
                className={tabClassFor(isMedia)}
              >
                Medien
              </Link>
              <Link to="/n8n" className={tabClassFor(isN8n)}>
                KI &amp; Automation
              </Link>
              <Link to="/" className={tabClassFor(isApps)}>
                Apps
              </Link>
            </nav>

            <div className="hidden items-center gap-2 sm:flex">
              <span
                className="rounded-full p-2 text-ink-400"
                title="Suche (Inhalt folgt)"
                aria-hidden
              >
                <Search className="h-4 w-4" />
              </span>
            </div>

            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setSpaceOpen((v) => !v)}
                className="flex max-w-[200px] items-center gap-1.5 rounded-md border border-[#dadce0] bg-white px-3 py-1.5 text-left text-[12px] font-medium text-ink-800 lg:max-w-[260px]"
              >
                <Workflow className="h-3.5 w-3.5 shrink-0 text-ink-500" />
                <span className="truncate">Produktion · master</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 shrink-0 text-ink-400 ${spaceOpen ? "rotate-180" : ""}`}
                />
              </button>
              {spaceOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 top-full z-20 mt-1 w-56 rounded-lg border border-hair bg-white py-1 shadow-lg"
                >
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-[12px] text-ink-900 hover:bg-ink-50"
                    onClick={() => setSpaceOpen(false)}
                  >
                    Produktion · master
                    <span className="ml-2 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                      aktiv
                    </span>
                  </button>
                </div>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-2 border-l border-[#e8eaed] pl-3">
              {user ? (
                <span className="hidden max-w-[7rem] truncate text-[12px] text-ink-500 md:inline">
                  {user.titel || user.benutzername}
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => void logout()}
                className="inline-flex items-center gap-1 rounded-md border border-[#dadce0] bg-white px-2 py-1.5 text-[12px] font-medium text-ink-700 hover:bg-[#f8f9fa]"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Abmelden</span>
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
