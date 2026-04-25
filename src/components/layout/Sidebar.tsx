import {
  ArrowUpRight,
  BarChart3,
  Building2,
  ChevronDown,
  Command,
  Database,
  Globe,
  Inbox,
  LayoutDashboard,
  LogOut,
  type LucideIcon,
  Mails,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { Logo } from "../brand/Logo";

type NavChild = { label: string; to: string; end?: boolean };
type NavItem = {
  label: string;
  icon: LucideIcon;
  to?: string;
  children?: NavChild[];
};

const NAV_PRIMARY: NavItem[] = [
  { label: "Übersicht", icon: LayoutDashboard, to: "/dashboard" },
  { label: "CRM", icon: Building2, to: "/crm" },
  { label: "Anfragen", icon: Inbox, to: "/anfragen" },
  { label: "Logs", icon: ScrollText, to: "/logs" },
  {
    label: "Analytics",
    icon: BarChart3,
    children: [
      { label: "Kunden API", to: "/analytics/kunden-api" },
      { label: "Oneauto API", to: "/analytics/oneauto-api" },
      { label: "Oneauto Reports", to: "/analytics/oneauto-reports" },
    ],
  },
  {
    label: "Zahlungen",
    icon: Wallet,
    children: [
      { label: "Zahlungslinks", to: "/zahlungen/zahlungslinks" },
      { label: "Pläne", to: "/zahlungen/plaene" },
    ],
  },
  {
    label: "Webseite",
    icon: Globe,
    children: [
      { label: "Blogs", to: "/website/blogs" },
      { label: "Landing Pages", to: "/website/landing-pages" },
      { label: "FAQ", to: "/website/faq" },
      { label: "Tutorials", to: "/website/tutorials" },
      { label: "Whitepaper", to: "/website/whitepaper" },
      { label: "Company Info", to: "/website/company" },
      { label: "Changelog", to: "/website/changelog" },
    ],
  },
  {
    label: "Datenbanken",
    icon: Database,
    children: [{ label: "Produktions Datenbank", to: "/databases/production" }],
  },
  { label: "Newsletter", icon: Mails, to: "/newsletter" },
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
      <Logo className="h-[22px] w-auto text-white" />
      <button
        type="button"
        title="Workspace wechseln"
        className="text-night-400 transition-colors hover:text-white"
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
                          end={child.end}
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

  // `bannerfarbe` als gefüllte „Bubble“ um Avatar + Name (nicht die ganze Ecke).
  const profileBg = sanitizeColor(user.bannerfarbe) ?? "#1f232c";
  const stufe = user.sicherheitsstufe ?? 0;
  const onLight = isLightBackground(profileBg);
  const nameCls = onLight
    ? "text-ink-900"
    : "text-white";
  const subCls = onLight
    ? "text-ink-600"
    : "text-night-200/80";
  const sepCls = onLight ? "text-ink-400" : "text-white/35";
  const avatarRing = onLight
    ? "ring-2 ring-ink-900/12"
    : "ring-2 ring-night-900/90";
  const dotRing = onLight ? "ring-2 ring-white" : "ring-2 ring-night-900";
  const logoutBtn = onLight
    ? "bg-ink-900/8 text-ink-800 hover:bg-ink-900/14"
    : "bg-white/10 text-white/95 hover:bg-white/18";
  const bubbleRing = onLight
    ? "ring-1 ring-ink-900/10 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset]"
    : "ring-1 ring-white/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.2)]";

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="border-t border-white/[0.06] px-3 pb-3.5 pt-3">
      <div
        className={`rounded-2xl px-2.5 py-2 ${bubbleRing}`}
        style={{ backgroundColor: profileBg }}
      >
        <div className="flex items-center gap-2.5">
          <div className="relative shrink-0">
            {user.profilbild ? (
              <img
                src={user.profilbild}
                alt={user.benutzername}
                className={`h-11 w-11 rounded-full object-cover ${avatarRing}`}
                referrerPolicy="no-referrer"
              />
            ) : (
              <div
                className={`grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-brand-400 to-accent-rose text-[12px] font-semibold text-white ${avatarRing}`}
              >
                {initials}
              </div>
            )}
            <span
              className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-accent-mint ${dotRing}`}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p
              className={`truncate text-[12.5px] font-medium ${nameCls}`}
            >
              {user.benutzername}
            </p>
            <div
              className={`mt-0.5 flex min-w-0 items-center gap-1.5 text-[10.5px] ${subCls}`}
            >
              <span className="truncate">
                {user.titel || "Mitglied"}
              </span>
              <span className={`shrink-0 opacity-60 ${sepCls}`}>·</span>
              <SecurityBadge level={stufe} onLight={onLight} />
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            title="Abmelden"
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-md transition-colors ${logoutBtn}`}
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function SecurityBadge({ level, onLight }: { level: number; onLight: boolean }) {
  return (
    <span
      title={`Sicherheitsstufe ${level}`}
      className={
        onLight
          ? "inline-flex shrink-0 items-center gap-1 rounded-sm bg-ink-900/[0.08] px-1.5 py-[1px] text-[10px] font-medium leading-none text-ink-700 ring-1 ring-inset ring-ink-900/12"
          : "inline-flex shrink-0 items-center gap-1 rounded-sm bg-white/[0.07] px-1.5 py-[1px] text-[10px] font-medium leading-none text-night-200 ring-1 ring-inset ring-white/10"
      }
    >
      <ShieldCheck
        className={
          onLight
            ? "h-2.5 w-2.5 text-brand-600"
            : "h-2.5 w-2.5 text-brand-300"
        }
      />
      Stufe {level}
    </span>
  );
}

/**
 * Akzeptiert nur Strings die wie eine CSS-Farbe aussehen
 * (#rgb, #rrggbb, #rrggbbaa). Sonst null → Fallback.
 */
function sanitizeColor(input: string | null | undefined): string | null {
  if (!input) return null;
  const s = input.trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(s)) return s;
  return null;
}

/** Rel. Helligkeit (sRGB) → helle Hintergründe brauchen dunkle Schrift. */
function isLightBackground(hex: string): boolean {
  let h = hex.replace("#", "").toLowerCase();
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (h.length === 8) h = h.slice(0, 6);
  if (h.length !== 6) return false;
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return false;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const lin = (c: number) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.55;
}
