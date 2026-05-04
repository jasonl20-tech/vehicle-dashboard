export default function CmsSettingsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="mb-8">
        <h1 className="font-display text-[28px] font-semibold tracking-tighter2 text-ink-900 sm:text-[32px]">
          Space-Einstellungen
        </h1>
      </header>

      <div className="space-y-6 rounded-xl border border-hair bg-white p-8 shadow-sm">
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
            readOnly
            value=""
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
            value=""
            className="w-full rounded-lg border border-hair bg-white px-3 py-2 font-mono text-[13px] text-ink-600"
          />
        </div>
      </div>
    </div>
  );
}
