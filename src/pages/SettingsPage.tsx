import PageHeader from "../components/ui/PageHeader";

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Konfiguration"
        title="Einstellungen"
        description="Mandanten-, Benutzer- und Integrationseinstellungen."
      />
      <div className="flex min-h-[40vh] items-center justify-center border-y border-hair">
        <div className="max-w-md px-6 py-16 text-center">
          <p className="font-display text-[20px] tracking-tightish text-ink-900">
            Workspace
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-500">
            Profile, Team, API-Keys und Integrationen folgen hier.
          </p>
        </div>
      </div>
    </>
  );
}
