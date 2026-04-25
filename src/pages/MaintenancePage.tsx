import PageHeader from "../components/ui/PageHeader";

export default function MaintenancePage() {
  return (
    <>
      <PageHeader
        title="Wartung"
        description="Geplante Inspektionen, Reparaturen und Servicehistorie."
      />
      <div className="rounded-2xl border border-dashed border-ink-200 bg-white p-12 text-center text-sm text-ink-500 shadow-card">
        Wartungspläne, TÜV-Termine und Werkstattaufträge erscheinen hier.
      </div>
    </>
  );
}
