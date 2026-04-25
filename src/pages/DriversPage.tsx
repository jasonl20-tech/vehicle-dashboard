import PageHeader from "../components/ui/PageHeader";

export default function DriversPage() {
  return (
    <>
      <PageHeader
        title="Fahrer"
        description="Verwaltung von Führerscheinen, Schulungen und Zuteilungen."
      />
      <div className="rounded-2xl border border-dashed border-ink-200 bg-white p-12 text-center text-sm text-ink-500 shadow-card">
        Fahrerprofile und Schulungsstand kommen hier rein.
      </div>
    </>
  );
}
