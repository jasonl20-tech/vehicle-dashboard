import {
  ArrowRight,
  Briefcase,
  FileText,
  Gauge,
  LayoutDashboard,
  LogOut,
  Send,
  Settings,
  Shield,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Logo } from "../components/brand/Logo";
import { useAuth } from "../lib/auth";

type PlatformTile = {
  title: string;
  icon: LucideIcon;
  to?: string;
  href?: string;
  status?: string;
};

const TILES: PlatformTile[] = [
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    to: "/dashboard",
  },
  {
    title: "Content Management System",
    icon: FileText,
    status: "Bald verfügbar",
  },
  {
    title: "Control Platform",
    icon: Gauge,
    status: "Bald verfügbar",
  },
  {
    title: "Job Manager",
    icon: Briefcase,
    status: "Bald verfügbar",
  },
  {
    title: "N8N",
    icon: Workflow,
    href: "https://n8n.vehicleimagery.com",
  },
  {
    title: "Buffer",
    icon: Send,
    href: "https://publish.buffer.com/schedule?tab=approvals",
  },
  {
    title: "Docusign",
    icon: FileText,
    href: "https://app-eu.boldsign.com/dashboard",
  },
  {
    title: "User Settings",
    icon: Settings,
    to: "/settings",
  },
  {
    title: "Admin Settings",
    icon: Shield,
    status: "Bald verfügbar",
  },
];

export default function PlatformHomePage() {
  const { user, logout } = useAuth();

  return (
    <div className="relative min-h-screen overflow-hidden bg-paper text-ink-900">
      <Background />

      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6 sm:px-10 lg:px-12">
        <Link
          to="/"
          className="inline-flex items-center gap-3 text-ink-900"
          aria-label="Vehicleimagery Plattform Start"
        >
          <Logo className="h-5 w-auto text-ink-900" />
        </Link>

        <div className="flex items-center gap-3">
          {user && (
            <div className="hidden min-w-0 text-right sm:block">
              <p className="truncate text-[12px] font-medium text-ink-800">
                {user.titel || user.benutzername}
              </p>
              <p className="text-[10.5px] uppercase tracking-[0.18em] text-ink-400">
                Plattform
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={() => void logout()}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-hair bg-white/70 px-4 text-[12.5px] font-medium text-ink-600 shadow-sm backdrop-blur transition hover:border-ink-200 hover:text-ink-900"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Abmelden</span>
          </button>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-88px)] w-full max-w-7xl flex-col items-center px-6 pb-12 pt-14 sm:px-10 sm:pt-16 lg:px-12 lg:pt-20">
        <section className="max-w-3xl text-center">
          <h1 className="font-display text-[44px] font-semibold leading-[0.98] tracking-tighter2 text-ink-900 sm:text-[58px] lg:text-[70px]">
            Wohin möchtest du gehen?
          </h1>
        </section>

        <section
          className="mt-10 grid w-full grid-cols-[repeat(auto-fit,minmax(min(100%,210px),1fr))] gap-4"
          aria-label="Plattform Bereiche"
        >
          {TILES.map((tile) => (
            <PlatformCard key={tile.title} tile={tile} />
          ))}
        </section>
      </main>
    </div>
  );
}

function PlatformCard({ tile }: { tile: PlatformTile }) {
  const Icon = tile.icon;
  const isActive = Boolean(tile.to || tile.href);
  const content = (
    <>
      <div className="flex items-center gap-4">
        <div
          className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${
            isActive
              ? "bg-ink-900 text-white"
              : "bg-night-900/[0.04] text-ink-400"
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <h2 className="font-display text-[22px] font-semibold leading-tight tracking-tighter2 text-ink-900">
          {tile.title}
        </h2>
      </div>

      <div className="mt-8 flex items-center justify-between border-t border-hair pt-4">
        <span className="text-[12.5px] font-medium text-ink-600">
          {isActive ? "Öffnen" : tile.status}
        </span>
        <span
          className={`grid h-8 w-8 place-items-center rounded-full transition ${
            isActive ? "bg-ink-900 text-white" : "bg-night-900/[0.04] text-ink-300"
          }`}
        >
          <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </>
  );

  if (tile.to) {
    return (
      <Link
        to={tile.to}
        className="group relative min-h-[175px] overflow-hidden rounded-2xl border border-hair bg-white/75 p-5 shadow-[0_24px_70px_-45px_rgba(13,13,15,0.45)] backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-ink-200 hover:bg-white"
      >
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-accent-rose to-accent-mint"
        />
        {content}
      </Link>
    );
  }

  if (tile.href) {
    return (
      <a
        href={tile.href}
        target="_blank"
        rel="noreferrer"
        className="group relative min-h-[175px] overflow-hidden rounded-2xl border border-hair bg-white/75 p-5 shadow-[0_24px_70px_-45px_rgba(13,13,15,0.45)] backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-ink-200 hover:bg-white"
      >
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-accent-rose to-accent-mint"
        />
        {content}
      </a>
    );
  }

  return (
    <div className="relative min-h-[175px] overflow-hidden rounded-2xl border border-hair bg-white/45 p-5 opacity-85 backdrop-blur">
      {content}
    </div>
  );
}

function Background() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="absolute inset-0 bg-grid-fade" />
      <div
        className="absolute inset-0 opacity-[0.42]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(13,13,15,0.07) 1px, transparent 0)",
          backgroundSize: "24px 24px",
          maskImage:
            "linear-gradient(to bottom, rgba(0,0,0,0.9), rgba(0,0,0,0.25) 75%, rgba(0,0,0,0.08))",
          WebkitMaskImage:
            "linear-gradient(to bottom, rgba(0,0,0,0.9), rgba(0,0,0,0.25) 75%, rgba(0,0,0,0.08))",
        }}
      />
      <Logo className="absolute left-1/2 top-1/2 h-auto w-[min(88vw,58rem)] -translate-x-1/2 -translate-y-1/2 text-ink-900/[0.035]" />
    </div>
  );
}
