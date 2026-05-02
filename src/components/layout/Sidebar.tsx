import {
  ChevronDown,
  ChevronRight,
  Command,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { Logo } from "../brand/Logo";
import {
  NAV_FOOTER,
  NAV_PRIMARY,
  type NavItem,
} from "./navConfig";

type Props = {
  mobileOpen: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenPalette: () => void;
};

export default function Sidebar({
  mobileOpen,
  onClose,
  collapsed,
  onToggleCollapse,
  onOpenPalette,
}: Props) {
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
        className={`fixed lg:sticky top-0 z-40 h-screen shrink-0 bg-night-900 text-night-300 transition-[width,transform] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] will-change-[width] ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0 ${
          collapsed ? "w-[260px] lg:w-[68px]" : "w-[260px]"
        }`}
      >
        <div className="flex h-full flex-col">
          <Brand
            collapsed={collapsed}
            onToggleCollapse={onToggleCollapse}
          />
          <SearchBox collapsed={collapsed} onOpenPalette={onOpenPalette} />
          <Nav
            items={NAV_PRIMARY}
            onNavigate={onClose}
            collapsed={collapsed}
          />
          <div className="mt-auto" />
          <Nav
            items={NAV_FOOTER}
            onNavigate={onClose}
            collapsed={collapsed}
            dense
          />
          <UserRow collapsed={collapsed} />
        </div>
      </aside>
    </>
  );
}

function Brand({
  collapsed,
  onToggleCollapse,
}: {
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  return (
    <div
      className={`flex items-center pt-6 pb-5 ${
        collapsed ? "justify-center px-2" : "justify-between px-5"
      }`}
    >
      {!collapsed && (
        <Link
          to="/"
          className="min-w-0 shrink rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-night-900"
          aria-label="Zur Plattform-Auswahl"
        >
          <Logo className="h-[22px] w-auto text-white" />
        </Link>
      )}
      <button
        type="button"
        onClick={onToggleCollapse}
        title={collapsed ? "Sidebar ausklappen" : "Sidebar einklappen"}
        aria-label={collapsed ? "Sidebar ausklappen" : "Sidebar einklappen"}
        className="press hidden h-7 w-7 shrink-0 items-center justify-center rounded-md text-night-400 transition-colors hover:bg-white/[0.06] hover:text-white lg:inline-flex"
      >
        {collapsed ? (
          <PanelLeftOpen className="h-4 w-4" />
        ) : (
          <PanelLeftClose className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}

function SearchBox({
  collapsed,
  onOpenPalette,
}: {
  collapsed: boolean;
  onOpenPalette: () => void;
}) {
  if (collapsed) {
    return (
      <div className="px-2 pb-4">
        <button
          type="button"
          onClick={onOpenPalette}
          title="Suchen oder Befehl (⌘K)"
          aria-label="Suchen (⌘K)"
          className="press grid h-9 w-full place-items-center rounded-md text-night-400 ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/[0.06] hover:text-white"
        >
          <Search className="h-4 w-4" />
        </button>
      </div>
    );
  }
  return (
    <div className="px-4 pb-5">
      <FullSearch onOpenPalette={onOpenPalette} />
    </div>
  );
}

function FullSearch({ onOpenPalette }: { onOpenPalette: () => void }) {
  const isMac =
    typeof navigator !== "undefined" && /mac|iphone|ipad/i.test(navigator.platform);
  return (
    <button
      type="button"
      onClick={onOpenPalette}
      className="press group relative flex w-full items-center gap-2 rounded-md bg-white/[0.04] px-3 py-2 text-left text-[13px] text-night-400 ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/[0.07] hover:text-night-200"
    >
      <Search className="h-3.5 w-3.5" />
      <span className="flex-1 truncate">Suchen oder Befehl…</span>
      <span className="pointer-events-none inline-flex items-center gap-0.5 rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-night-400">
        {isMac ? <Command className="h-3 w-3" /> : "Ctrl"}
        K
      </span>
    </button>
  );
}

function Nav({
  items,
  onNavigate,
  collapsed,
  dense = false,
}: {
  items: NavItem[];
  onNavigate: () => void;
  collapsed: boolean;
  dense?: boolean;
}) {
  return (
    <nav
      className={`${dense ? "" : "flex-1 overflow-y-auto"} ${
        collapsed ? "px-2 lg:px-2" : "px-2"
      }`}
    >
      <ul className="space-y-px">
        {items.map((item) =>
          collapsed ? (
            <CollapsedNavRow
              key={item.label}
              item={item}
              onNavigate={onNavigate}
            />
          ) : (
            <ExpandedNavRow
              key={item.label}
              item={item}
              onNavigate={onNavigate}
            />
          ),
        )}
      </ul>
    </nav>
  );
}

function ExpandedNavRow({
  item,
  onNavigate,
}: {
  item: NavItem;
  onNavigate: () => void;
}) {
  const Icon = item.icon;
  const { pathname } = useLocation();
  const childActive = !!item.children?.some(
    (c) => pathname === c.to || pathname.startsWith(`${c.to}/`),
  );
  const initiallyOpen = childActive;
  const [open, setOpen] = useState(initiallyOpen);

  // If pathname changes such that this group becomes active, ensure it's open.
  useEffect(() => {
    if (childActive) setOpen(true);
  }, [childActive]);

  if (item.children) {
    return (
      <li>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`press group flex w-full items-center justify-between rounded-md px-3 py-1.5 text-[13px] transition-colors ${
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
              open ? "rotate-180" : ""
            }`}
          />
        </button>
        {open && (
          <ul className="stagger-children ml-7 mt-0.5 space-y-px border-l border-white/10 pl-3">
            {item.children.map((child) => (
              <li key={child.to + child.label} className="animate-fade-down">
                <NavLink
                  to={child.to}
                  end={child.end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `press block rounded-md px-2.5 py-1 text-[12.5px] transition-colors ${
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
    <li>
      <NavLink
        to={item.to!}
        onClick={onNavigate}
        className={({ isActive }) =>
          `press group relative flex items-center gap-3 rounded-md px-3 py-1.5 text-[13px] transition-colors ${
            isActive
              ? "bg-white/[0.06] text-white"
              : "text-night-300 hover:bg-white/[0.04] hover:text-white"
          }`
        }
      >
        {({ isActive }) => (
          <>
            {isActive && (
              <span className="animate-scale-in absolute left-0 top-1/2 h-4 w-[2px] origin-center -translate-y-1/2 rounded-r bg-brand-400 shadow-[0_0_10px_rgba(138,118,255,0.6)]" />
            )}
            <Icon
              className={`h-4 w-4 transition-colors ${
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
}

function CollapsedNavRow({
  item,
  onNavigate,
}: {
  item: NavItem;
  onNavigate: () => void;
}) {
  const Icon = item.icon;
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const ref = useRef<HTMLLIElement>(null);

  const childActive = !!item.children?.some(
    (c) => pathname === c.to || pathname.startsWith(`${c.to}/`),
  );

  // Close flyout on outside click / escape.
  useEffect(() => {
    if (!flyoutOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setFlyoutOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFlyoutOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [flyoutOpen]);

  // Mobile-fallback: when collapsed prop is set but viewport is mobile, behave normally.
  // We rely on `lg:` classes and a single set of markup; the parent wraps mobile differently.

  if (item.children) {
    return (
      <li ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setFlyoutOpen((v) => !v)}
          title={item.label}
          aria-haspopup="menu"
          aria-expanded={flyoutOpen}
          className={`group relative flex w-full items-center justify-center rounded-md py-1.5 transition-colors ${
            childActive
              ? "bg-white/[0.06] text-white"
              : "text-night-300 hover:bg-white/[0.04] hover:text-white"
          }`}
        >
          {childActive && (
            <span className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-r bg-brand-400" />
          )}
          <Icon
            className={`h-4 w-4 ${
              childActive
                ? "text-brand-300"
                : "text-night-400 group-hover:text-night-200"
            }`}
          />
        </button>
        {flyoutOpen && (
          <div
            role="menu"
            className="absolute left-full top-0 z-50 ml-2 w-56 overflow-hidden rounded-md border border-white/10 bg-night-800 py-1 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.6)]"
          >
            <p className="px-3 pb-1 pt-1.5 text-[10.5px] font-medium uppercase tracking-[0.16em] text-night-400">
              {item.label}
            </p>
            <div className="px-1 pb-1">
              {item.children.map((c) => {
                const active = pathname === c.to || pathname.startsWith(`${c.to}/`);
                return (
                  <button
                    key={c.to}
                    type="button"
                    onClick={() => {
                      setFlyoutOpen(false);
                      onNavigate();
                      navigate(c.to);
                    }}
                    className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12.5px] transition-colors ${
                      active
                        ? "bg-white/[0.06] text-white"
                        : "text-night-300 hover:bg-white/[0.04] hover:text-white"
                    }`}
                  >
                    <ChevronRight
                      className={`h-3 w-3 ${
                        active ? "text-brand-300" : "text-night-500"
                      }`}
                    />
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </li>
    );
  }

  return (
    <li>
      <NavLink
        to={item.to!}
        onClick={onNavigate}
        title={item.label}
        className={({ isActive: a }) =>
          `group relative flex items-center justify-center rounded-md py-1.5 transition-colors ${
            a
              ? "bg-white/[0.06] text-white"
              : "text-night-300 hover:bg-white/[0.04] hover:text-white"
          }`
        }
      >
        {({ isActive: a }) => (
          <>
            {a && (
              <span className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-r bg-brand-400" />
            )}
            <Icon
              className={`h-4 w-4 ${
                a
                  ? "text-brand-300"
                  : "text-night-400 group-hover:text-night-200"
              }`}
            />
          </>
        )}
      </NavLink>
    </li>
  );
}

function UserRow({ collapsed }: { collapsed: boolean }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  if (!user) return null;

  const initials = (user.benutzername || "??")
    .split(/[\s._-]+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // `bannerfarbe` als gefüllte „Bubble" um Avatar + Name (nicht die ganze Ecke).
  const profileBg = sanitizeColor(user.bannerfarbe) ?? "#1f232c";
  const stufe = user.sicherheitsstufe ?? 0;
  const onLight = isLightBackground(profileBg);
  const nameCls = onLight ? "text-ink-900" : "text-white";
  const subCls = onLight ? "text-ink-600" : "text-night-200/80";
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

  // ── Collapsed mode (desktop): just an avatar with click-popover ──
  if (collapsed) {
    return (
      <div
        ref={ref}
        className="relative hidden border-t border-white/[0.06] px-2 pb-3.5 pt-3 lg:block"
      >
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          title={user.benutzername}
          className={`relative grid h-10 w-10 shrink-0 place-items-center rounded-full ${avatarRing} mx-auto`}
          style={{ backgroundColor: profileBg }}
        >
          {user.profilbild ? (
            <img
              src={user.profilbild}
              alt={user.benutzername}
              className="h-10 w-10 rounded-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="text-[11px] font-semibold text-white">{initials}</span>
          )}
          <span
            className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-accent-mint ${dotRing}`}
          />
        </button>
        {menuOpen && (
          <div
            role="menu"
            className="absolute bottom-2 left-full ml-2 w-60 overflow-hidden rounded-md border border-white/10 bg-night-800 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.6)]"
          >
            <div
              className="flex items-center gap-2.5 px-3 py-3"
              style={{ backgroundColor: profileBg }}
            >
              <div className={`relative h-9 w-9 shrink-0 ${avatarRing} rounded-full`}>
                {user.profilbild ? (
                  <img
                    src={user.profilbild}
                    alt={user.benutzername}
                    className="h-full w-full rounded-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center rounded-full bg-gradient-to-br from-brand-400 to-accent-rose text-[11px] font-semibold text-white">
                    {initials}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className={`truncate text-[12.5px] font-medium ${nameCls}`}>
                  {user.benutzername}
                </p>
                <div
                  className={`mt-0.5 flex min-w-0 items-center gap-1.5 text-[10.5px] ${subCls}`}
                >
                  <span className="truncate">{user.titel || "Mitglied"}</span>
                  <span className={`shrink-0 opacity-60 ${sepCls}`}>·</span>
                  <SecurityBadge level={stufe} onLight={onLight} />
                </div>
              </div>
            </div>
            <div className="border-t border-white/10 px-1 py-1">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  void handleLogout();
                }}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12.5px] text-night-200 hover:bg-white/[0.06] hover:text-white"
              >
                <LogOut className="h-3.5 w-3.5" />
                Abmelden
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Expanded mode: original card ──
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
            <p className={`truncate text-[12.5px] font-medium ${nameCls}`}>
              {user.benutzername}
            </p>
            <div
              className={`mt-0.5 flex min-w-0 items-center gap-1.5 text-[10.5px] ${subCls}`}
            >
              <span className="truncate">{user.titel || "Mitglied"}</span>
              <span className={`shrink-0 opacity-60 ${sepCls}`}>·</span>
              <SecurityBadge level={stufe} onLight={onLight} />
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            title="Abmelden"
            className={`press grid h-8 w-8 shrink-0 place-items-center rounded-md transition-colors ${logoutBtn}`}
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

// Export NAV constants for compatibility with previous consumers (CommandPalette).
export { NAV_FOOTER, NAV_PRIMARY };
