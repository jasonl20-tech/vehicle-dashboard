import {
  BarChart3,
  Car,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  type LucideIcon,
  MapPinned,
  MoreVertical,
  Search,
  Settings,
  UserRound,
  Users,
  Wrench,
} from "lucide-react";
import { useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";

type NavChild = { label: string; to: string };
type NavItem = {
  label: string;
  icon: LucideIcon;
  to?: string;
  children?: NavChild[];
};

const NAV: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, to: "/dashboard" },
  { label: "Flotte", icon: Car, to: "/fleet" },
  { label: "Fahrten", icon: MapPinned, to: "/trips" },
  { label: "Fahrer", icon: Users, to: "/drivers" },
  { label: "Wartung", icon: Wrench, to: "/maintenance" },
  {
    label: "Analytics",
    icon: BarChart3,
    children: [
      { label: "Fahrzeug-Analytics", to: "/analytics" },
      { label: "Verwaltung", to: "/fleet" },
    ],
  },
  { label: "Einstellungen", icon: Settings, to: "/settings" },
];

type Props = {
  mobileOpen: boolean;
  onClose: () => void;
};

export default function Sidebar({ mobileOpen, onClose }: Props) {
  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Menü schließen"
          onClick={onClose}
          className="fixed inset-0 z-30 bg-ink-900/40 lg:hidden"
        />
      )}
      <aside
        className={`fixed lg:sticky top-0 z-40 h-screen w-72 shrink-0 border-r border-ink-200 bg-white transition-transform duration-200 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        <div className="flex h-full flex-col">
          <Brand />
          <SearchBox />
          <Navigation onNavigate={onClose} />
          <UserCard />
        </div>
      </aside>
    </>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-3 px-5 pt-5 pb-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-soft">
        <Car className="h-4 w-4" />
      </div>
      <div className="leading-tight">
        <p className="text-[15px] font-semibold text-ink-900">vehiclehub</p>
        <p className="text-[11px] text-ink-400">Fleet Operations</p>
      </div>
    </div>
  );
}

function SearchBox() {
  return (
    <div className="px-4 pb-4">
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <input
          type="search"
          placeholder="Suchen"
          className="w-full rounded-lg border border-ink-200 bg-ink-50 py-2 pl-9 pr-3 text-sm placeholder:text-ink-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
      </label>
    </div>
  );
}

function Navigation({ onNavigate }: { onNavigate: () => void }) {
  const { pathname } = useLocation();
  const initiallyOpen = useMemo(
    () =>
      new Set(
        NAV.filter((it) =>
          it.children?.some((c) => pathname.startsWith(c.to)),
        ).map((it) => it.label),
      ),
    [pathname],
  );
  const [openGroups, setOpenGroups] = useState<Set<string>>(initiallyOpen);

  const toggle = (label: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  return (
    <nav className="flex-1 overflow-y-auto px-3">
      <ul className="space-y-0.5">
        {NAV.map((item) => {
          const Icon = item.icon;
          if (item.children) {
            const isOpen = openGroups.has(item.label);
            const childActive = item.children.some(
              (c) => pathname === c.to || pathname.startsWith(`${c.to}/`),
            );
            return (
              <li key={item.label}>
                <button
                  type="button"
                  onClick={() => toggle(item.label)}
                  className={`group flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                    childActive
                      ? "text-ink-900"
                      : "text-ink-600 hover:bg-ink-50 hover:text-ink-900"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Icon className="h-[18px] w-[18px] text-ink-500 group-hover:text-ink-700" />
                    {item.label}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-ink-400 transition-transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {isOpen && (
                  <ul className="mt-1 space-y-0.5 pl-10">
                    {item.children.map((child) => (
                      <li key={child.to}>
                        <NavLink
                          to={child.to}
                          onClick={onNavigate}
                          className={({ isActive }) =>
                            `block rounded-md px-3 py-1.5 text-[13px] transition-colors ${
                              isActive
                                ? "bg-brand-50 text-brand-700 font-medium"
                                : "text-ink-500 hover:text-ink-800"
                            }`
                          }
                        >
                          {child.label}
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          }
          return (
            <li key={item.label}>
              <NavLink
                to={item.to!}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? "bg-brand-50 text-brand-700 font-medium"
                      : "text-ink-600 hover:bg-ink-50 hover:text-ink-900"
                  }`
                }
              >
                <Icon
                  className={`h-[18px] w-[18px] ${
                    pathname === item.to
                      ? "text-brand-600"
                      : "text-ink-500 group-hover:text-ink-700"
                  }`}
                />
                {item.label}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function UserCard() {
  return (
    <div className="m-3 mt-auto flex items-center gap-3 rounded-xl border border-ink-200 bg-white p-3 shadow-card">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-brand-700">
        <UserRound className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-[13px] font-semibold text-ink-900">
          Darrell Steward
        </p>
        <p className="truncate text-[11px] text-ink-400">
          darrell@vehiclehub.io
        </p>
      </div>
      <button
        type="button"
        title="Abmelden"
        className="rounded-md p-1.5 text-ink-400 hover:bg-ink-50 hover:text-ink-700"
      >
        <LogOut className="h-4 w-4" />
      </button>
      <button
        type="button"
        title="Mehr"
        className="rounded-md p-1 text-ink-400 hover:bg-ink-50 hover:text-ink-700"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
    </div>
  );
}
