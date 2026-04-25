import PageHeader from "../components/ui/PageHeader";

export default function TripsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Fahrten"
        description="Aktuelle und vergangene Fahrten deiner Flotte."
      />
      <Empty
        title="Live-Tracking & Routen"
        text="Fahrtenliste, Routen-Detail und Live-Tracking erscheinen hier, sobald Daten angebunden sind."
      />
    </>
  );
}

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center border-y border-hair bg-[radial-gradient(circle_at_top,rgba(109,82,255,0.04),transparent_60%)]">
      <div className="max-w-md px-6 py-16 text-center">
        <p className="font-display text-[20px] tracking-tightish text-ink-900">
          {title}
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-500">{text}</p>
      </div>
    </div>
  );
}
