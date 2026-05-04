import { Search } from "lucide-react";
import { useMemo, useState } from "react";

const MOCK = [
  {
    id: "demo-landing",
    title: "Willkommen",
    type: "Landing Page",
    locale: "de-DE",
    updated: "—",
    state: "Entwurf",
  },
  {
    id: "demo-article",
    title: "Erster Artikel",
    type: "Blog Post",
    locale: "de-DE",
    updated: "—",
    state: "Entwurf",
  },
];

export default function CmsEntriesPage() {
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return MOCK;
    return MOCK.filter(
      (r) =>
        r.title.toLowerCase().includes(s) ||
        r.type.toLowerCase().includes(s) ||
        r.id.toLowerCase().includes(s),
    );
  }, [q]);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-[26px] font-semibold tracking-tighter2 text-ink-900">
            Content
          </h1>
          <p className="mt-1 text-[13px] text-ink-500">
            Alle Inhalte nach Content-Modell — Daten sind noch statisch, API
            folgt.
          </p>
        </div>
        <button
          type="button"
          disabled
          className="inline-flex items-center justify-center rounded-lg bg-ink-900 px-4 py-2 text-[12.5px] font-medium text-white opacity-60"
        >
          Content anlegen
        </button>
      </header>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Titel, Modell oder ID suchen …"
            className="w-full rounded-lg border border-hair bg-white py-2 pl-9 pr-3 text-[13px] text-ink-800 placeholder:text-ink-400 focus:border-ink-500 focus:outline-none focus:ring-1 focus:ring-ink-500/20"
          />
        </div>
        <p className="text-[12px] text-ink-400">
          {rows.length} {rows.length === 1 ? "Eintrag" : "Einträge"}{" "}
          <span className="text-ink-300">(Listenansicht)</span>
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-hair bg-white shadow-sm">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-hair bg-night-900/[0.02] text-[11px] font-semibold uppercase tracking-wide text-ink-500">
            <tr>
              <th className="px-4 py-3">Titel</th>
              <th className="px-4 py-3">Modell</th>
              <th className="hidden px-4 py-3 sm:table-cell">Locale</th>
              <th className="hidden px-4 py-3 md:table-cell">Geändert</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hair">
            {rows.map((r) => (
              <tr
                key={r.id}
                className="transition hover:bg-night-900/[0.02] cursor-pointer"
              >
                <td className="px-4 py-3 font-medium text-ink-900">{r.title}</td>
                <td className="px-4 py-3 text-ink-600">{r.type}</td>
                <td className="hidden px-4 py-3 text-ink-500 sm:table-cell">
                  {r.locale}
                </td>
                <td className="hidden px-4 py-3 text-ink-400 md:table-cell">
                  {r.updated}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-md border border-hair bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-900">
                    {r.state}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
