import PageHeader from "../components/ui/PageHeader";

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Einstellungen"
        description="Mandanten-, Benutzer- und Integrationseinstellungen."
      />
      <div className="rounded-2xl border border-dashed border-ink-200 bg-white p-12 text-center text-sm text-ink-500 shadow-card">
        Einstellungen folgen hier (Profil, Team, API-Keys).
      </div>
    </>
  );
}
