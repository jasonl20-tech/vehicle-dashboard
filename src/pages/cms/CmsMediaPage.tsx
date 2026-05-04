export default function CmsMediaPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-[26px] font-semibold tracking-tighter2 text-ink-900">
            Medien
          </h1>
          <p className="mt-1 text-[13px] text-ink-500">
            Zentrale Asset-Bibliothek — Upload und CDN-Anbindung später.
          </p>
        </div>
        <button
          type="button"
          disabled
          className="rounded-lg border border-hair bg-white px-4 py-2 text-[12.5px] font-medium text-ink-500"
        >
          Datei hochladen
        </button>
      </header>

      <div className="grid place-items-center rounded-2xl border border-dashed border-hair bg-white/70 py-24 text-center">
        <p className="max-w-sm text-[13px] text-ink-500">
          Noch keine Medien. Sobald die API steht, erscheinen hier Vorschau,
          Metadaten und Filter.
        </p>
      </div>
    </div>
  );
}
