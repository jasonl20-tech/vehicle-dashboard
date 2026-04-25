import {
  ArrowUpRight,
  BarChart3,
  Car,
  ChevronDown,
  Command,
  LayoutDashboard,
  LogOut,
  type LucideIcon,
  MapPinned,
  Search,
  Settings,
  ShieldCheck,
  Users,
  Wrench,
} from "lucide-react";
import { useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/auth";

type NavChild = { label: string; to: string };
type NavItem = {
  label: string;
  icon: LucideIcon;
  to?: string;
  children?: NavChild[];
};

const NAV_PRIMARY: NavItem[] = [
  { label: "Übersicht", icon: LayoutDashboard, to: "/dashboard" },
  {
    label: "Analytics",
    icon: BarChart3,
    children: [
      { label: "Fahrzeug-Analytics", to: "/analytics" },
      { label: "Touren-Analytics", to: "/trips" },
    ],
  },
  { label: "Flotte", icon: Car, to: "/fleet" },
  { label: "Fahrten", icon: MapPinned, to: "/trips" },
  { label: "Fahrer", icon: Users, to: "/drivers" },
  { label: "Wartung", icon: Wrench, to: "/maintenance" },
];

const NAV_FOOTER: NavItem[] = [
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
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
        />
      )}
      <aside
        className={`fixed lg:sticky top-0 z-40 h-screen w-[260px] shrink-0 bg-night-900 text-night-300 transition-transform duration-200 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        <div className="flex h-full flex-col">
          <Brand />
          <SearchBox />
          <Nav items={NAV_PRIMARY} onNavigate={onClose} />
          <div className="mt-auto" />
          <Nav items={NAV_FOOTER} onNavigate={onClose} dense />
          <UserRow />
        </div>
      </aside>
    </>
  );
}

function Brand() {
  return (
    <div className="flex items-center justify-between px-5 pt-6 pb-5">
      <div className="flex items-center gap-2.5">
        <div className="relative grid h-8 w-8 place-items-center overflow-hidden rounded-lg bg-gradient-to-br from-brand-500 via-brand-600 to-night-700 ring-1 ring-white/10">
          <Car className="h-[14px] w-[14px] text-white" />
        </div>
        <div className="leading-tight">
          <p className="text-[14px] font-semibold tracking-tight text-white">
            vehiclehub
          </p>
          <p className="text-[10.5px] uppercase tracking-[0.14em] text-night-400">
            Fleet OS
          </p>
        </div>
      </div>
      <button
        type="button"
        title="Workspace wechseln"
        className="text-night-400 hover:text-white"
      >
        <ArrowUpRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function SearchBox() {
  return (
    <div className="px-4 pb-5">
      <label className="group relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-night-400" />
        <input
          type="search"
          placeholder="Suchen oder Befehl…"
          className="w-full rounded-md bg-white/[0.04] py-2 pl-9 pr-12 text-[13px] text-night-200 placeholder:text-night-400 ring-1 ring-inset ring-white/10 focus:bg-white/[0.07] focus:outline-none focus:ring-brand-500/60"
        />
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-0.5 rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-night-400">
          <Command className="h-3 w-3" />K
        </span>
      </label>
    </div>
  );
}

function Nav({
  items,
  onNavigate,
  dense = false,
}: {
  items: NavItem[];
  onNavigate: () => void;
  dense?: boolean;
}) {
  const { pathname } = useLocation();
  const initiallyOpen = useMemo(
    () =>
      new Set(
        items
          .filter((it) => it.children?.some((c) => pathname.startsWith(c.to)))
          .map((it) => it.label),
      ),
    [items, pathname],
  );
  const [openGroups, setOpenGroups] = useState<Set<string>>(initiallyOpen);

  const toggle = (label: string) =>
    setOpenGroups((prev) => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });

  return (
    <nav className={`px-2 ${dense ? "" : "flex-1 overflow-y-auto"}`}>
      <ul className="space-y-px">
        {items.map((item) => {
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
                  className={`group flex w-full items-center justify-between rounded-md px-3 py-1.5 text-[13px] transition-colors ${
                    childActive
                      ? "text-white"
                      : "text-night-300 hover:bg-white/[0.04] hover:text-white"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Icon className="h-4 w-4 text-night-400 group-hover:text-night-200" />
                    {item.label}
                  </span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 text-night-400 transition-transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {isOpen && (
                  <ul className="ml-7 mt-0.5 space-y-px border-l border-white/10 pl-3">
                    {item.children.map((child) => (
                      <li key={child.to + child.label}>
                        <NavLink
                          to={child.to}
                          onClick={onNavigate}
                          className={({ isActive }) =>
                            `block rounded-md px-2.5 py-1 text-[12.5px] transition-colors ${
                              isActive
                                ? "text-white"
                                : "text-night-400 hover:text-night-200"
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
                  `group relative flex items-center gap-3 rounded-md px-3 py-1.5 text-[13px] transition-colors ${
                    isActive
                      ? "bg-white/[0.06] text-white"
                      : "text-night-300 hover:bg-white/[0.04] hover:text-white"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-r bg-brand-400" />
                    )}
                    <Icon
                      className={`h-4 w-4 ${
                        isActive
                          ? "text-brand-300"
                          : "text-night-400 group-hover:text-night-200"
                      }`}
                    />
                    {item.label}
                  </>
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function UserRow() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const initials = (user.benutzername || "??")
    .split(/[\s._-]+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const banner = user.bannerfarbe && user.bannerfarbe !== "#ffffff"
    ? user.bannerfarbe
    : null;

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="relative border-t border-white/[0.06]">
      {banner && (
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-7"
          style={{
            background: `linear-gradient(to bottom, ${banner}33, transparent)`,
          }}
        />
      )}
      <div className="relative flex items-center gap-2.5 px-4 py-3">
        <div className="relative">
          {user.profilbild ? (
            <img
              src={user.profilbild}
              alt={user.benutzername}
              className="h-8 w-8 rounded-full object-cover ring-1 ring-white/10"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-brand-400 to-accent-rose text-[11px] font-semibold text-white">
              {initials}
            </div>
          )}
          <span className="absolute -bottom-0 -right-0 h-2 w-2 rounded-full bg-accent-mint ring-2 ring-night-900" />
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[12.5px] font-medium text-white">
            {user.benutzername}
          </p>
          <p className="flex items-center gap-1 truncate text-[10.5px] text-night-400">
            {user.titel || "Mitglied"}
            {user.sicherheitsstufe >= 5 && (
              <ShieldCheck className="h-3 w-3 text-brand-300" />
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          title="Abmelden"
          className="rounded-md p-1 text-night-400 hover:bg-white/[0.05] hover:text-white"
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
