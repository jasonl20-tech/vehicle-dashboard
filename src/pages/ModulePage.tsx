import { useLocation } from "react-router-dom";
import PageHeader from "../components/ui/PageHeader";

const META: Record<
  string,
  { title: string; eyebrow: string; description: string }
> = {
  "/dashboard/ansichten/bildaustrahlung": {
    title: "Bildaustrahlung",
    eyebrow: "Ansichten",
    description: "Ausgabe und Verteilung von Fahrzeugbildern – Inhalte folgen.",
  },
  "/dashboard/leads": {
    title: "Leads",
    eyebrow: "Leads",
    description: "Interessenten und Lead-Übersicht – Inhalte folgen.",
  },
  "/dashboard/kunden/keys": {
    title: "Kunden keys",
    eyebrow: "Kundenmanagement",
    description: "Produktive API-Schlüssel und Kundenbindung – Inhalte folgen.",
  },
  "/dashboard/kunden/test-keys": {
    title: "Kundentest keys",
    eyebrow: "Kundenmanagement",
    description: "Test- und Staging-Keys, getrennt von Produktion – Inhalte folgen.",
  },
  "/dashboard/logs/skalierungs-worker": {
    title: "Skalierungs Worker",
    eyebrow: "Logs",
    description: "Protokolle und Einstellungen des Skalierungs-Workers – Inhalte folgen.",
  },
  "/dashboard/logs/generierungs-worker": {
    title: "Generierungs Worker",
    eyebrow: "Logs",
    description: "Protokolle und Einstellungen des Generierungs-Workers – Inhalte folgen.",
  },
  "/dashboard/emails/logs": {
    title: "Email Logs",
    eyebrow: "Emails",
    description: "Versand- und Zustellprotokolle – Inhalte folgen.",
  },
  "/dashboard/emails/tracking": {
    title: "Email Tracking",
    eyebrow: "Emails",
    description: "Öffnungs- und Klick-Tracking – Inhalte folgen.",
  },
  "/dashboard/emails/automator": {
    title: "Email Automator",
    eyebrow: "Emails",
    description: "Regeln und Abläufe für automatisierte E-Mails – Inhalte folgen.",
  },
  "/dashboard/website/blogs": {
    title: "Blogs",
    eyebrow: "Webseite",
    description: "Blog-Artikel und Kategorien.",
  },
  "/dashboard/website/landing-pages": {
    title: "Landing Pages",
    eyebrow: "Webseite",
    description: "Conversion-Seiten und Traffic-Einstiege.",
  },
  "/dashboard/website/faq": {
    title: "FAQ",
    eyebrow: "Webseite",
    description: "Häufige Fragen – Struktur und Inhalte.",
  },
  "/dashboard/website/tutorials": {
    title: "Tutorials",
    eyebrow: "Webseite",
    description: "Anleitungen und Video-Inhalte.",
  },
  "/dashboard/website/whitepaper": {
    title: "Whitepaper",
    eyebrow: "Webseite",
    description: "Downloads und Leads.",
  },
  "/dashboard/website/company": {
    title: "Company Info",
    eyebrow: "Webseite",
    description: "Unternehmensseiten und Team.",
  },
  "/dashboard/website/changelog": {
    title: "Changelog",
    eyebrow: "Webseite",
    description: "Produkt- und Release-Notizen.",
  },
};

const DEFAULT_META = {
  title: "Bereich",
  eyebrow: "Vehicleimagery",
  description: "Dieser Bereich wird noch ausgebaut.",
};

export default function ModulePage() {
  const { pathname } = useLocation();
  const m = META[pathname] ?? {
    ...DEFAULT_META,
    title: pathname || DEFAULT_META.title,
  };

  return (
    <>
      <PageHeader
        eyebrow={m.eyebrow}
        title={m.title}
        description={m.description}
      />
      <div className="flex min-h-[40vh] items-center border-t border-hair">
        <div className="max-w-md px-1 py-14">
          <p className="text-[13px] leading-relaxed text-ink-500">
            Platzhalter – hier kommen deine echten Inhalte, Tabellen und
            Aktionen hin.
          </p>
        </div>
      </div>
    </>
  );
}
