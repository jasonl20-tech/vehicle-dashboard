import {
  Box,
  Calendar,
  Clock,
  LayoutGrid,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { Logo } from "../brand/Logo";
import { useAuth, type SessionUser } from "../../lib/auth";
import { CMS_ROOT } from "../../lib/cmsAccess";
import {
  CMS_CONTENT_MODELS_API,
  type CmsContentModelsListResponse,
} from "../../lib/cmsApi";
import { useApi } from "../../lib/customerApi";

function cmsSidebarEditFocusPath(pathname: string): boolean {
  if (pathname === `${CMS_ROOT}/models/new`) return true;
  if (pathname === `${CMS_ROOT}/entries/new`) return true;
  if (/^\/cms\/models\/[^/]+\/edit$/.test(pathname)) return true;
  if (/^\/cms\/entries\/[^/]+\/edit$/.test(pathname)) return true;
  return false;
}

function useEntriesNavActive() {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const onEntries = pathname === `${CMS_ROOT}/entries`;
  const modelFilter = searchParams.get("content_model_id") || "";
  const isZuletztView = searchParams.get("view") === "zuletzt";
  const allEntries = onEntries && !modelFilter && !isZuletztView;
  const zuletztEntries = onEntries && isZuletztView;
  return { onEntries, modelFilter, allEntries, isZuletztView, zuletztEntries };
}

function cmsHeaderUserInitials(user: SessionUser): string {
  return (user.benutzername || "??")
    .split(/[\s._-]+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function CmsHeaderUserChip({ user }: { user: SessionUser }) {
  const initials = cmsHeaderUserInitials(user);
  const label = user.titel?.trim() || user.benutzername;
  return (
    <div
      className="flex min-w-0 max-w-[11rem] items-center gap-2"
      title={user.benutzername}
    >
      <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-[#e8eaed] ring-2 ring-white shadow-sm ring-inset">
        {user.profilbild ? (
          <img
            src={user.profilbild}
            alt=""
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="grid h-full w-full place-items-center bg-gradient-to-br from-[#1a73e8] to-[#1557b0] text-[10px] font-semibold text-white">
            {initials}
          </div>
        )}
      </div>
      <span className="hidden min-w-0 truncate text-[12px] font-medium text-ink-800 sm:block">
        {label}
      </span>
    </div>
  );
}

function CmsHeaderSearch() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [val, setVal] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (location.pathname.startsWith(`${CMS_ROOT}/entries`)) {
      setVal(searchParams.get("q") || "");
    } else {
      setVal("");
    }
  }, [location.pathname, searchParams]);

  const pushQ = useCallback(
    (q: string) => {
      const p = new URLSearchParams();
      if (location.pathname.startsWith(`${CMS_ROOT}/entries`)) {
        const cid = searchParams.get("content_model_id");
        if (cid) p.set("content_model_id", cid);
        if (searchParams.get("view") === "zuletzt") p.set("view", "zuletzt");
      }
      const t = q.trim();
      if (t) p.set("q", t);
      const qs = p.toString();
      navigate(`${CMS_ROOT}/entries${qs ? `?${qs}` : ""}`, { replace: true });
    },
    [navigate, location.pathname, searchParams],
  );

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  return (
    <form
      className="hidden min-w-0 max-w-[14rem] flex-1 sm:block lg:max-w-xs"
      onSubmit={(e) => {
        e.preventDefault();
        if (debounceRef.current) clearTimeout(debounceRef.current);
        pushQ(val);
      }}
    >
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
        <input
          type="search"
          value={val}
          onChange={(e) => {
            const v = e.target.value;
            setVal(v);
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => pushQ(v), 320);
          }}
          placeholder="Einträge suchen…"
          className="w-full rounded-md border border-[#dadce0] bg-[#f8f9fa] py-1.5 pl-8 pr-2 text-[12px] text-ink-800 placeholder:text-ink-400 focus:border-[#1a73e8] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#1a73e8]/25"
          aria-label="Einträge durchsuchen"
        />
      </div>
    </form>
  );
}

export default function CmsLayout() {
  const { pathname: path } = useLocation();
  const { user, logout } = useAuth();
  const { onEntries, modelFilter, allEntries, isZuletztView, zuletztEntries } =
    useEntriesNavActive();

  const isFocusEdit = useMemo(() => cmsSidebarEditFocusPath(path), [path]);
  const [navPinnedOpen, setNavPinnedOpen] = useState(false);
  useEffect(() => {
    setNavPinnedOpen(false);
  }, [path]);

  const sidebarCollapsed = isFocusEdit && !navPinnedOpen;

  const isModels = path.startsWith(`${CMS_ROOT}/models`);
  const isEntries = path.startsWith(`${CMS_ROOT}/entries`);
  const isMedia = path.startsWith(`${CMS_ROOT}/media`);
  const isScheduled = path.startsWith(`${CMS_ROOT}/scheduled`);

  const tabClassFor = (active: boolean) =>
    [
      "shrink-0 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#1a73e8]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
      active
        ? "bg-white text-ink-900 shadow-sm ring-1 ring-black/[0.06]"
        : "text-ink-600 hover:bg-white/70 hover:text-ink-900",
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
        id="cms-sidebar-primary"
        className={[
          "sticky top-0 flex h-screen shrink-0 flex-col border-r border-[#e8eaed] bg-white transition-[width,opacity] duration-200 ease-out",
          sidebarCollapsed
            ? "pointer-events-none w-0 min-w-0 overflow-hidden border-r-0 opacity-0"
            : "w-[268px] opacity-100",
        ].join(" ")}
        aria-hidden={sidebarCollapsed}
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
          <Link
            to={`${CMS_ROOT}/entries?view=zuletzt`}
            className={[
              sideItemBase,
              zuletztEntries ? sideItemActive : sideItemIdle,
            ].join(" ")}
          >
            <Clock className="h-4 w-4 shrink-0 opacity-90" />
            Zuletzt
          </Link>
          <Link
            to={`${CMS_ROOT}/scheduled`}
            className={[
              sideItemBase,
              isScheduled ? sideItemActive : sideItemIdle,
            ].join(" ")}
          >
            <Calendar className="h-4 w-4 shrink-0 opacity-90" />
            Geplant
          </Link>

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
                const active = onEntries && modelFilter === m.id;
                const qs = new URLSearchParams();
                qs.set("content_model_id", m.id);
                if (isZuletztView) qs.set("view", "zuletzt");
                return (
                  <Link
                    key={m.id}
                    to={`${CMS_ROOT}/entries?${qs}`}
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
              [sideItemBase, isActive ? sideItemActive : sideItemIdle].join(
                " ",
              )
            }
          >
            <Settings className="h-4 w-4 shrink-0 opacity-90" />
            Einstellungen
          </NavLink>
          <NavLink
            to={`${CMS_ROOT}/locales`}
            className={({ isActive }) =>
              [sideItemBase, isActive ? sideItemActive : sideItemIdle].join(
                " ",
              )
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
          <div className="flex h-14 items-center gap-3 overflow-x-auto px-4 lg:gap-4 lg:px-6">
            {isFocusEdit ? (
              <button
                type="button"
                onClick={() => setNavPinnedOpen((v) => !v)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#dadce0] bg-white px-2.5 py-1.5 text-[12px] font-medium text-ink-700 hover:bg-[#f8f9fa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a73e8]/35"
                aria-expanded={!sidebarCollapsed}
                aria-controls="cms-sidebar-primary"
                title={
                  sidebarCollapsed
                    ? "Navigation einblenden"
                    : "Navigation ausblenden"
                }
              >
                {sidebarCollapsed ? (
                  <PanelLeftOpen className="h-4 w-4" aria-hidden />
                ) : (
                  <PanelLeftClose className="h-4 w-4" aria-hidden />
                )}
                <span className="hidden sm:inline">
                  {sidebarCollapsed ? "Navigation" : "Seitenleiste"}
                </span>
              </button>
            ) : null}
            <nav
              className="flex min-w-0 shrink-0 items-center gap-0.5 rounded-xl border border-[#e8eaed] bg-[#f1f3f4] p-1"
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
            </nav>

            <CmsHeaderSearch />

            <div className="ml-auto flex shrink-0 items-center gap-2 border-l border-[#e8eaed] pl-3">
              {user ? <CmsHeaderUserChip user={user} /> : null}
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
