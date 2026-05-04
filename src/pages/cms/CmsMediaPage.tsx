export default function CmsMediaPage() {
  return (
    <div className="mx-auto w-full max-w-7xl">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-[28px] font-semibold tracking-tighter2 text-ink-900 sm:text-[32px]">
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
