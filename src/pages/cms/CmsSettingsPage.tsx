export default function CmsSettingsPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-8">
        <h1 className="font-display text-[26px] font-semibold tracking-tighter2 text-ink-900">
          Space-Einstellungen
        </h1>
        <p className="mt-1 text-[13px] text-ink-500">
          Name, Umgebungen und Zugriff — noch Platzhalter.
        </p>
      </header>

      <div className="space-y-6 rounded-xl border border-hair bg-white p-6">
        <div>
          <label
            className="mb-1.5 block text-[12px] font-medium text-ink-700"
            htmlFor="cms-space-name"
          >
            Space-Name
          </label>
          <input
            id="cms-space-name"
            type="text"
            defaultValue="Produktion"
            readOnly
            className="w-full rounded-lg border border-hair bg-ink-50/50 px-3 py-2 text-[13px] text-ink-600"
          />
        </div>
        <div>
          <label
            className="mb-1.5 block text-[12px] font-medium text-ink-700"
            htmlFor="cms-space-id"
          >
            Space-ID
          </label>
          <input
            id="cms-space-id"
            type="text"
            readOnly
            placeholder="wird mit API vergeben"
            className="w-full rounded-lg border border-hair bg-white px-3 py-2 font-mono text-[13px] text-ink-500 placeholder:text-ink-400"
          />
        </div>
      </div>
    </div>
  );
}
