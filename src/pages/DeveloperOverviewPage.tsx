import { ArrowRight, Code2 } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Logo } from "../components/brand/Logo";
import { useAuth } from "../lib/auth";
import { DEVELOPER_OVERVIEW_LINKS } from "../lib/developerOverviewLinks";
import { pathDirectlyAllowed } from "../lib/routeAccess";

export default function DeveloperOverviewPage() {
  const { erlaubtePfade } = useAuth();
  const links = useMemo(
    () =>
      DEVELOPER_OVERVIEW_LINKS.filter((l) =>
        pathDirectlyAllowed(l.to, erlaubtePfade),
      ),
    [erlaubtePfade],
  );

  return (
    <div className="relative min-h-screen bg-paper text-ink-900">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-grid-fade opacity-60"
      />

      <header className="relative z-10 mx-auto flex w-full max-w-2xl items-center justify-between px-6 py-6 sm:px-8">
        <Link
          to="/"
          className="inline-flex items-center gap-3 text-ink-900"
          aria-label="Zur Plattform-Übersicht"
        >
          <Logo className="h-5 w-auto text-ink-900" />
        </Link>
        <Link
          to="/"
          className="text-[12.5px] font-medium text-ink-600 underline-offset-4 transition hover:text-ink-900 hover:underline"
        >
          ← Plattform
        </Link>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-2xl px-6 pb-16 sm:px-8">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ink-900 text-white">
            <Code2 className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h1 className="font-display text-[28px] font-semibold tracking-tighter2 text-ink-900">
              Developer Übersicht
            </h1>
            <p className="mt-0.5 text-[13px] text-ink-500">
              Schnellzugriff auf Datenbanken, Systeme, APIs und Worker-Logs.
            </p>
          </div>
        </div>

        {links.length > 0 ? (
          <ul className="divide-y divide-hair rounded-xl border border-hair bg-white/80 shadow-sm backdrop-blur">
            {links.map(({ label, to }) => (
              <li key={to}>
                <Link
                  to={to}
                  className="press group flex items-center justify-between gap-3 px-4 py-3 text-[13px] text-ink-700 transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-night-900/[0.03] hover:text-ink-900"
                >
                  <span className="min-w-0 truncate">{label}</span>
                  <ArrowRight
                    className="h-3.5 w-3.5 shrink-0 text-ink-400 transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-hair bg-white/60 px-4 py-6 text-center text-[13px] text-ink-500">
            Für dein Konto sind keine Einträge freigeschaltet.
          </p>
        )}
      </main>
    </div>
  );
}
