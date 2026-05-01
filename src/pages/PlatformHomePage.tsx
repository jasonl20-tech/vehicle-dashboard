import {
  ArrowRight,
  LayoutDashboard,
  Lock,
  LogOut,
  Sparkles,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Logo, LogoMark } from "../components/brand/Logo";
import { useAuth } from "../lib/auth";

type PlatformTile = {
  title: string;
  description: string;
  eyebrow: string;
  icon: LucideIcon;
  to?: string;
  status?: string;
};

const TILES: PlatformTile[] = [
  {
    title: "Dashboard",
    description:
      "Öffnet die bestehende Vehicleimagery-Konsole mit Übersicht, Kunden, Analytics und Systemen.",
    eyebrow: "Live Bereich",
    icon: LayoutDashboard,
    to: "/dashboard",
  },
  {
    title: "Kundenportal",
    description:
      "Später der Einstieg für Kundenzugänge, Accounts und externe Self-Service-Flows.",
    eyebrow: "Geplant",
    icon: Users,
    status: "Bald verfügbar",
  },
  {
    title: "Automationen",
    description:
      "Platzhalter für Workflows, Jobs und wiederkehrende Plattform-Abläufe.",
    eyebrow: "Geplant",
    icon: Workflow,
    status: "Bald verfügbar",
  },
  {
    title: "Content Studio",
    description:
      "Reserviert für Website-Inhalte, Kampagnen und zukünftige Marketing-Module.",
    eyebrow: "Geplant",
    icon: Sparkles,
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
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-ink-900 text-white shadow-[0_18px_45px_-24px_rgba(13,13,15,0.65)]">
            <LogoMark className="h-6 w-auto" />
          </span>
          <Logo className="hidden h-5 w-auto text-ink-900 sm:block" />
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

      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-88px)] w-full max-w-7xl flex-col items-center justify-center px-6 pb-12 pt-4 sm:px-10 lg:px-12">
        <section className="max-w-3xl text-center">
          <h1 className="font-display text-[44px] font-semibold leading-[0.98] tracking-tighter2 text-ink-900 sm:text-[58px] lg:text-[70px]">
            Wohin möchtest du gehen?
          </h1>
        </section>

        <section
          className="mt-10 grid w-full gap-4 sm:grid-cols-2 xl:grid-cols-4"
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
  const isActive = Boolean(tile.to);
  const content = (
    <>
      <div className="flex items-start justify-between gap-4">
        <div
          className={`grid h-11 w-11 place-items-center rounded-xl ${
            isActive
              ? "bg-ink-900 text-white"
              : "bg-night-900/[0.04] text-ink-400"
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
            isActive
              ? "bg-accent-mint/10 text-ink-700"
              : "bg-night-900/[0.04] text-ink-400"
          }`}
        >
          {!isActive && <Lock className="h-3 w-3" />}
          {isActive ? tile.eyebrow : tile.status}
        </span>
      </div>

      <div className="mt-8">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-ink-400">
          {tile.eyebrow}
        </p>
        <h2 className="mt-2 font-display text-[24px] font-semibold tracking-tighter2 text-ink-900">
          {tile.title}
        </h2>
        <p className="mt-3 text-[13.5px] leading-6 text-ink-500">
          {tile.description}
        </p>
      </div>

      <div className="mt-8 flex items-center justify-between border-t border-hair pt-5">
        <span className="text-[12.5px] font-medium text-ink-600">
          {isActive ? "Bereich öffnen" : "Kommt später"}
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
        className="group relative min-h-[310px] overflow-hidden rounded-2xl border border-hair bg-white/75 p-5 shadow-[0_24px_70px_-45px_rgba(13,13,15,0.45)] backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-ink-200 hover:bg-white"
      >
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-accent-rose to-accent-mint"
        />
        {content}
      </Link>
    );
  }

  return (
    <div className="relative min-h-[310px] overflow-hidden rounded-2xl border border-hair bg-white/45 p-5 opacity-85 backdrop-blur">
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
