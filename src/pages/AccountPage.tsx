import MfaSection from "./settings/MfaSection";

/**
 * User Settings Bereich. Bewusst eigene Top-Level-Route `/account`,
 * NICHT unter `/dashboard/...`, damit Sidebar/Top-Navigation des
 * Konsole-Dashboards nicht im Weg stehen.
 *
 * Wird über `AccountLayout` gerendert.
 */
export default function AccountPage() {
  return (
    <div className="space-y-10">
      <header>
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-ink-400">
          Konto
        </p>
        <h1 className="mt-1 font-display text-[28px] leading-tight tracking-tighter2 text-ink-900">
          Persönliche Einstellungen
        </h1>
        <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-ink-500">
          Sicherheit, Zwei-Faktor und Profiloptionen deines Konsole-Kontos.
        </p>
      </header>

      <MfaSection />
    </div>
  );
}
