import PageHeader from "../components/ui/PageHeader";

export default function DriversPage() {
  return (
    <>
      <PageHeader
        eyebrow="People"
        title="Fahrer"
        description="Verwaltung von Führerscheinen, Schulungen und Zuteilungen."
      />
      <div className="flex min-h-[40vh] items-center justify-center border-y border-hair">
        <div className="max-w-md px-6 py-16 text-center">
          <p className="font-display text-[20px] tracking-tightish text-ink-900">
            Fahrerprofile
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-500">
            Profile, Schulungsstand und Verfügbarkeit kommen hier rein.
          </p>
        </div>
      </div>
    </>
  );
}
