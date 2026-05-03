import { Code2, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Logo } from "../components/brand/Logo";
import {
  API_CATALOG,
  API_CATALOG_GENERATED_AT,
  type ApiCatalogEntry,
} from "../lib/apiCatalog.generated";

function apiGroupKey(path: string): string {
  const parts = path.split("/").filter(Boolean);
  if (parts.length >= 2 && parts[0] === "api") {
    return parts[1] ?? "api";
  }
  return "api";
}

function formatGeneratedAt(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("de-DE", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

const METHOD_BADGE: Record<string, string> = {
  GET: "bg-emerald-500/12 text-emerald-800 border-emerald-500/25",
  POST: "bg-blue-500/12 text-blue-800 border-blue-500/25",
  PUT: "bg-amber-500/12 text-amber-900 border-amber-500/25",
  PATCH: "bg-violet-500/12 text-violet-800 border-violet-500/25",
  DELETE: "bg-rose-500/12 text-rose-800 border-rose-500/25",
  OPTIONS: "bg-night-900/8 text-ink-600 border-hair",
};

function MethodBadges({ methods }: { methods: readonly string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {methods.map((m) => (
        <span
          key={m}
          className={`inline-flex rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide ${METHOD_BADGE[m] ?? "bg-night-900/8 text-ink-700 border-hair"}`}
        >
          {m}
        </span>
      ))}
    </div>
  );
}

export default function DeveloperOverviewPage() {
  const [query, setQuery] = useState("");

  const filteredCatalog = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [...API_CATALOG];
    return API_CATALOG.filter((e) => {
      const hay = `${e.path} ${e.source} ${e.methods.join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [query]);

  const grouped = useMemo(() => {
    const map = new Map<string, ApiCatalogEntry[]>();
    for (const e of filteredCatalog) {
      const g = apiGroupKey(e.path);
      const arr = map.get(g);
      if (arr) arr.push(e);
      else map.set(g, [e]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filteredCatalog]);

  return (
    <div className="relative min-h-screen bg-paper text-ink-900">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-grid-fade opacity-60"
      />

      <header className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6 sm:px-8">
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

      <main className="relative z-10 mx-auto w-full max-w-5xl px-6 pb-16 sm:px-8">
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ink-900 text-white">
              <Code2 className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h1 className="font-display text-[28px] font-semibold tracking-tighter2 text-ink-900">
                Developer Übersicht
              </h1>
              <p className="mt-0.5 text-[13px] text-ink-500">
                API-Endpunkte der Plattform.
              </p>
            </div>
          </div>
        </div>

        <section className="mb-12" aria-labelledby="api-catalog-heading">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2
                id="api-catalog-heading"
                className="text-[15px] font-semibold tracking-tight text-ink-900"
              >
                API-Endpunkte
              </h2>
              <p className="mt-0.5 text-[12px] text-ink-500">
                Aus <code className="rounded bg-night-900/[0.06] px-1 font-mono text-[11px]">functions/api</code> generiert · Stand{" "}
                {formatGeneratedAt(API_CATALOG_GENERATED_AT)}
              </p>
            </div>
            <label className="relative w-full sm:max-w-xs">
              <span className="sr-only">API-Pfade filtern</span>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400"
                aria-hidden
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Pfad oder Datei suchen …"
                className="w-full rounded-lg border border-hair bg-white/90 py-2 pl-9 pr-3 text-[13px] text-ink-800 shadow-sm outline-none ring-brand-500/0 transition placeholder:text-ink-400 focus:border-ink-300 focus:ring-2 focus:ring-brand-500/20"
              />
            </label>
          </div>

          <p className="mb-4 text-[12px] text-ink-500">
            Dynamische Segmente erscheinen als{" "}
            <code className="rounded bg-night-900/[0.06] px-1 font-mono text-[11px]">:id</code>{" "}
            (im Dateisystem{" "}
            <code className="rounded bg-night-900/[0.06] px-1 font-mono text-[11px]">[id]</code>
            ). Auth und Rechte wie in der Middleware.
          </p>

          <div className="space-y-8">
            {grouped.map(([group, entries]) => (
              <div key={group}>
                <h3 className="mb-2 border-b border-hair pb-1.5 font-mono text-[12px] font-semibold uppercase tracking-wider text-ink-600">
                  /api/{group}
                </h3>
                <div className="overflow-x-auto rounded-xl border border-hair bg-white/80 shadow-sm backdrop-blur">
                  <table className="w-full min-w-[640px] border-collapse text-left text-[12.5px]">
                    <thead>
                      <tr className="border-b border-hair bg-night-900/[0.03] text-[11px] font-medium uppercase tracking-wide text-ink-500">
                        <th className="px-3 py-2.5 font-medium">Methoden</th>
                        <th className="px-3 py-2.5 font-medium">Pfad</th>
                        <th className="px-3 py-2.5 font-medium">Quelle</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hair text-ink-800">
                      {entries.map((e) => (
                        <tr
                          key={`${e.path}-${e.source}`}
                          className="transition-colors hover:bg-night-900/[0.02]"
                        >
                          <td className="align-top px-3 py-2.5">
                            <MethodBadges methods={e.methods} />
                          </td>
                          <td className="align-top px-3 py-2.5">
                            <code className="break-all font-mono text-[12px] text-ink-900">
                              {e.path}
                            </code>
                          </td>
                          <td className="align-top px-3 py-2.5 text-ink-500">
                            <code className="break-all font-mono text-[11px]">
                              {e.source}
                            </code>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>

          {grouped.length === 0 ? (
            <p className="mt-6 rounded-xl border border-hair bg-white/60 px-4 py-6 text-center text-[13px] text-ink-500">
              Keine Einträge für diese Suche.
            </p>
          ) : null}
        </section>
      </main>
    </div>
  );
}
