export default function CmsLocalesPage() {
  const locales = [
    { code: "de-DE", name: "Deutsch", default: true },
    { code: "en-US", name: "English", default: false },
  ];

  return (
    <div className="mx-auto max-w-xl">
      <header className="mb-8">
        <h1 className="font-display text-[26px] font-semibold tracking-tighter2 text-ink-900">
          Sprachen
        </h1>
        <p className="mt-1 text-[13px] text-ink-500">
          Locales pro Space — Vorschau für mehrsprachige Inhalte.
        </p>
      </header>

      <ul className="divide-y divide-hair rounded-xl border border-hair bg-white">
        {locales.map((l) => (
          <li
            key={l.code}
            className="flex items-center justify-between gap-3 px-4 py-3.5"
          >
            <div>
              <p className="font-medium text-ink-900">{l.name}</p>
              <p className="font-mono text-[12px] text-ink-500">{l.code}</p>
            </div>
            {l.default ? (
              <span className="rounded-md bg-emerald-500/12 px-2 py-0.5 text-[11px] font-semibold text-emerald-900">
                Standard
              </span>
            ) : (
              <span className="text-[12px] text-ink-400">aktiv</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
