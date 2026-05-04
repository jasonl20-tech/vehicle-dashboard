export default function CmsMediaPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-[26px] font-semibold tracking-tighter2 text-ink-900">
            Medien
          </h1>
        </div>
        <button
          type="button"
          disabled
          className="rounded-lg border border-hair bg-white px-4 py-2 text-[12.5px] font-medium text-ink-500"
        >
          Datei hochladen
        </button>
      </header>

      <div
        className="min-h-[12rem] rounded-xl border border-hair bg-white"
        aria-label="Medienliste"
      />
    </div>
  );
}
