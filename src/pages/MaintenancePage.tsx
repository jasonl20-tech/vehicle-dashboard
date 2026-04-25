import PageHeader from "../components/ui/PageHeader";

export default function MaintenancePage() {
  return (
    <>
      <PageHeader
        eyebrow="Service"
        title="Wartung"
        description="Geplante Inspektionen, Reparaturen und Servicehistorie."
      />
      <div className="flex min-h-[40vh] items-center justify-center border-y border-hair">
        <div className="max-w-md px-6 py-16 text-center">
          <p className="font-display text-[20px] tracking-tightish text-ink-900">
            Wartungsplan
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-500">
            TÜV-Termine, Werkstattaufträge und Wartungshistorie folgen hier.
          </p>
        </div>
      </div>
    </>
  );
}
