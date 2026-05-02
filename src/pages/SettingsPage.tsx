import PageHeader from "../components/ui/PageHeader";
import MfaSection from "./settings/MfaSection";

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Konfiguration"
        title="Einstellungen"
        description="Sicherheit, Profil und Zugangsoptionen fuer dein Konsole-Konto."
      />
      <div className="mx-auto mt-8 w-full max-w-3xl space-y-10 px-0 pb-14">
        <MfaSection />
        <section className="rounded-xl border border-dashed border-hair bg-white/[0.35] p-8 text-center">
          <p className="font-display text-[18px] text-ink-800">
            Weitere Bereiche folgen.
          </p>
          <p className="mt-2 text-[12.5px] text-ink-500">
            Profilbild und Team koennen spaeter hier ergänzt werden.
          </p>
        </section>
      </div>
    </>
  );
}
