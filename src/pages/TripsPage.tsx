import PageHeader from "../components/ui/PageHeader";

export default function TripsPage() {
  return (
    <>
      <PageHeader
        title="Fahrten"
        description="Aktuelle und vergangene Fahrten deiner Flotte."
      />
      <Placeholder text="Fahrtenliste, Routen-Detail und Live-Tracking folgen hier." />
    </>
  );
}

function Placeholder({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-ink-200 bg-white p-12 text-center text-sm text-ink-500 shadow-card">
      {text}
    </div>
  );
}
