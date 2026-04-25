import { useLocation } from "react-router-dom";
import PageHeader from "../components/ui/PageHeader";

const META: Record<
  string,
  { title: string; eyebrow: string; description: string }
> = {
  "/crm": {
    title: "CRM",
    eyebrow: "Kunden & Kontakte",
    description:
      "Kundenstammdaten, Pipeline und Kommunikation – Inhalte folgen.",
  },
  "/anfragen": {
    title: "Anfragen",
    eyebrow: "Eingang",
    description: "Eingehende Anfragen und Angebote an einem Ort.",
  },
  "/logs": {
    title: "Logs",
    eyebrow: "System",
    description: "Ereignis- und Anwendungsprotokolle.",
  },
  "/analytics/oneauto-api": {
    title: "Oneauto API",
    eyebrow: "Analytics",
    description: "Oneauto-Schnittstelle – Endpunkte, Authentifizierung und Quoten.",
  },
  "/zahlungslinks": {
    title: "Zahlungslinks",
    eyebrow: "Zahlungen",
    description: "Generierte Zahlungs- und Abo-Links verwalten.",
  },
  "/website/blogs": {
    title: "Blogs",
    eyebrow: "Webseite",
    description: "Blog-Artikel und Kategorien.",
  },
  "/website/landing-pages": {
    title: "Landing Pages",
    eyebrow: "Webseite",
    description: "Conversion-Seiten und Traffic-Einstiege.",
  },
  "/website/faq": {
    title: "FAQ",
    eyebrow: "Webseite",
    description: "Häufige Fragen – Struktur und Inhalte.",
  },
  "/website/tutorials": {
    title: "Tutorials",
    eyebrow: "Webseite",
    description: "Anleitungen und Video-Inhalte.",
  },
  "/website/whitepaper": {
    title: "Whitepaper",
    eyebrow: "Webseite",
    description: "Downloads und Leads.",
  },
  "/website/company": {
    title: "Company Info",
    eyebrow: "Webseite",
    description: "Unternehmensseiten und Team.",
  },
  "/website/changelog": {
    title: "Changelog",
    eyebrow: "Webseite",
    description: "Produkt- und Release-Notizen.",
  },
  "/databases/production": {
    title: "Produktions-Datenbank",
    eyebrow: "Datenbanken",
    description: "Verbindung und Schema-Überblick (Produktivumgebung).",
  },
  "/newsletter": {
    title: "Newsletter",
    eyebrow: "Marketing",
    description: "Kampagnen, Abonnenten und Versand.",
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
