/**
 * Vorlagen-Kategorien.
 *
 * Pro Kategorie:
 *   - `id`/`label`/`description` für die UI
 *   - `keywords`         — semantische Tags für die Suche
 *   - `content`          — Texte (Headline/Subline/CTA…), die in jedes
 *                          Layout eingesetzt werden
 *   - `layouts`          — Liste von 5 Layout-IDs aus `LAYOUTS`
 *
 * Jede Kategorie ergibt automatisch `5 × THEMES.length = 20` Vorlagen.
 */
import type { Content } from "./layouts";
import type { LayoutId } from "./layouts";

export type CategoryDef = {
  id: string;
  label: string;
  description: string;
  keywords: string[];
  /** Inhalts-Texte (Headlines, Bullets, Quotes…) */
  content: Content;
  /** Genau 5 Layouts → ergibt 20 Templates × Themes. */
  layouts: [LayoutId, LayoutId, LayoutId, LayoutId, LayoutId];
};

export const CATEGORIES: CategoryDef[] = [
  // 1
  {
    id: "header",
    label: "Header",
    description: "Logo, Navigation und kurze Banner ganz oben in der Mail.",
    keywords: ["header", "logo", "menü", "navigation", "banner"],
    content: {
      headline: "Vehicle Imagery",
      subline: "Premium-Fahrzeugbilder, automatisch erzeugt.",
      cta: "Mehr",
      eyebrow: "Vehicle Imagery",
      bullets: ["Produkt", "Preise", "Kontakt"],
    },
    layouts: [
      "header_logo_center",
      "header_logo_menu",
      "header_banner",
      "header_logo_tagline",
      "header_hairline",
    ],
  },
  // 2
  {
    id: "hero",
    label: "Hero",
    description: "Aufmacher mit großem Bild, Headline und Hauptaktion.",
    keywords: ["hero", "aufmacher", "intro", "willkommen", "cta"],
    content: {
      headline: "Großer Schritt voraus",
      subline:
        "Eine kurze, einprägsame Zeile, die dein Angebot zusammenfasst.",
      cta: "Jetzt entdecken",
      eyebrow: "Neu",
      placeholder: "Hero",
    },
    layouts: [
      "hero_centered_cta",
      "hero_full_image",
      "hero_split_left",
      "hero_split_right",
      "hero_eyebrow",
    ],
  },
  // 3
  {
    id: "welcome",
    label: "Willkommen",
    description:
      "Begrüßung neuer Nutzer mit klarer Anleitung zum nächsten Schritt.",
    keywords: ["welcome", "willkommen", "begrüßung", "onboarding-start", "start"],
    content: {
      headline: "Willkommen, {{name}}",
      subline:
        "Schön, dass du da bist. Hier ist alles, was du für den Start brauchst.",
      cta: "Loslegen",
      eyebrow: "Hallo",
      placeholder: "Willkommen",
      bullets: ["Account aktivieren", "Profil ergänzen", "Erste Aktion"],
      cardTexts: [
        "Aktiviere deinen Account in 30 Sekunden.",
        "Lege dein Profil an.",
        "Starte deine erste Aktion.",
      ],
    },
    layouts: [
      "hero_eyebrow",
      "content_numbered_steps",
      "cta_with_subline",
      "content_text",
      "hero_centered_cta",
    ],
  },
  // 4
  {
    id: "onboarding",
    label: "Onboarding",
    description: "Schritte und Tutorial-Karten für die ersten Tage.",
    keywords: ["onboarding", "schritte", "tutorial", "anleitung", "setup"],
    content: {
      headline: "In 3 Schritten zum Ziel",
      subline:
        "Folge dieser kurzen Anleitung und du bist in unter fünf Minuten startklar.",
      cta: "Setup starten",
      eyebrow: "Anleitung",
      bullets: ["Anmelden", "Konfigurieren", "Aktivieren"],
      cardTexts: [
        "Erstelle deinen Account und bestätige die Mail.",
        "Verbinde dein Konto mit deinen Daten.",
        "Schalte dein erstes Modul scharf.",
      ],
      bullets4: [
        "Account einrichten",
        "Profil vervollständigen",
        "Daten importieren",
        "Erste Mail verschicken",
      ],
    },
    layouts: [
      "content_numbered_steps",
      "content_text",
      "content_numbered_list",
      "content_three_features",
      "cta_card",
    ],
  },
  // 5
  {
    id: "announcement",
    label: "Ankündigung",
    description: "News, Releases oder organisatorische Hinweise.",
    keywords: ["announcement", "ankündigung", "news", "release", "info"],
    content: {
      headline: "Wichtige Ankündigung",
      subline:
        "Wir haben Neuigkeiten, die dich direkt betreffen — bitte kurz lesen.",
      cta: "Details lesen",
      eyebrow: "News",
      placeholder: "News",
    },
    layouts: [
      "hero_eyebrow",
      "content_text",
      "notice_box",
      "cta_banner",
      "content_image_text",
    ],
  },
  // 6
  {
    id: "product_launch",
    label: "Produkt-Launch",
    description: "Neue Produkte vorstellen mit Bild + Highlights + CTA.",
    keywords: ["produkt", "launch", "vorstellung", "neu", "release"],
    content: {
      headline: "Stell dich auf etwas Großes ein",
      subline:
        "Wir präsentieren unser neues Produkt — schneller, hübscher, smarter.",
      cta: "Jetzt ansehen",
      eyebrow: "Launch",
      placeholder: "Produkt",
      cardTitles: ["Schnell", "Sicher", "Skalierbar"],
      cardTexts: [
        "Bis zu 10x schneller als zuvor.",
        "Ende-zu-Ende verschlüsselt.",
        "Wächst mit deinem Team.",
      ],
    },
    layouts: [
      "hero_split_left",
      "content_three_features",
      "content_image_text",
      "cta_with_subline",
      "stats_three",
    ],
  },
  // 7
  {
    id: "feature_release",
    label: "Feature-Release",
    description: "Updates und neue Funktionen, kurz erklärt.",
    keywords: ["feature", "update", "release", "neu", "funktion", "changelog"],
    content: {
      headline: "Drei neue Features",
      subline: "Diese Highlights findest du ab heute in deinem Konto.",
      cta: "Im Konto öffnen",
      eyebrow: "Update 12.4",
      bullets: ["Bulk-Aktionen", "Schnellsuche", "Live-Vorschau"],
      cardTexts: [
        "Mehrere Datensätze in einem Rutsch.",
        "Filter direkt aus der Tastatur.",
        "Sofortige Vorschau aller Änderungen.",
      ],
      cardTitles: ["Bulk-Aktionen", "Schnellsuche", "Live-Vorschau"],
    },
    layouts: [
      "hero_eyebrow",
      "content_three_features",
      "content_two_cards",
      "content_video_preview",
      "cta_card",
    ],
  },
  // 8
  {
    id: "promotion",
    label: "Aktion / Promo",
    description: "Promotion mit klarem Vorteil und Frist.",
    keywords: ["promo", "aktion", "rabatt", "angebot", "kampagne"],
    content: {
      headline: "Nur diese Woche: -25%",
      subline:
        "Sichere dir jetzt ein Viertel Rabatt auf alle Pläne — gilt bis Sonntag.",
      cta: "Code einlösen",
      ctaSecondary: "Bedingungen",
      eyebrow: "Limitiert",
      placeholder: "Promo",
    },
    layouts: [
      "hero_eyebrow",
      "cta_banner",
      "cta_two_buttons",
      "notice_box",
      "hero_centered_cta",
    ],
  },
  // 9
  {
    id: "sale",
    label: "Sale",
    description: "Sale-Banner mit Preisreduzierung und Dringlichkeit.",
    keywords: ["sale", "rabatt", "deal", "discount", "schnäppchen"],
    content: {
      headline: "Sommer-Sale",
      subline: "Bis zu 50% Rabatt auf ausgewählte Produkte.",
      cta: "Jetzt shoppen",
      eyebrow: "−50%",
      placeholder: "Sale",
      cardTitles: ["Bestseller", "Neu", "Limitiert"],
      cardTexts: [
        "Die Top-Picks unserer Kunden.",
        "Frisch reingekommen.",
        "Solange Vorrat reicht.",
      ],
    },
    layouts: [
      "hero_full_image",
      "hero_eyebrow",
      "content_two_cards",
      "gallery_two_by_one",
      "cta_with_subline",
    ],
  },
  // 10
  {
    id: "event",
    label: "Event / Webinar",
    description: "Einladungen zu Veranstaltungen, Webinaren oder Workshops.",
    keywords: ["event", "webinar", "workshop", "einladung", "konferenz"],
    content: {
      headline: "Bist du dabei?",
      subline:
        "Live-Webinar am 15. Mai um 18 Uhr. Dauer ca. 45 Minuten + Q&A.",
      cta: "Platz reservieren",
      ctaSecondary: "Zum Kalender",
      eyebrow: "Webinar",
      placeholder: "Event",
      bullets: ["Live-Demo", "Q&A", "Workshop"],
      cardTitles: ["15. Mai", "18:00 Uhr", "Online"],
      cardTexts: ["Donnerstag", "ca. 60 Min.", "Zoom-Link folgt"],
    },
    layouts: [
      "hero_eyebrow",
      "content_three_features",
      "cta_two_buttons",
      "content_image_text",
      "cta_card",
    ],
  },
  // 11
  {
    id: "newsletter",
    label: "Newsletter",
    description: "Regelmäßige News-Ausgabe mit mehreren Themen.",
    keywords: ["newsletter", "ausgabe", "themen", "wochenrückblick", "monthly"],
    content: {
      headline: "Diese Woche",
      subline: "Drei Geschichten, die du nicht verpassen solltest.",
      cta: "Alle Artikel",
      eyebrow: "Newsletter #42",
      placeholder: "News",
      cardTitles: ["Story 1", "Story 2", "Story 3"],
      cardTexts: [
        "Kurzer Anreißer für die erste Geschichte.",
        "Kurzer Anreißer für die zweite Geschichte.",
        "Kurzer Anreißer für die dritte Geschichte.",
      ],
    },
    layouts: [
      "hero_eyebrow",
      "content_three_features",
      "content_two_cards",
      "divider_with_label",
      "footer_columns",
    ],
  },
  // 12
  {
    id: "digest",
    label: "Wochen-Digest",
    description: "Zusammenfassung der wichtigsten Vorgänge.",
    keywords: ["digest", "zusammenfassung", "rückblick", "weekly", "summary"],
    content: {
      headline: "Deine Woche im Überblick",
      subline: "Was lief gut, was steht an — kompakt für dich aufbereitet.",
      cta: "Detail-Report",
      eyebrow: "KW 17",
      stats: [
        { value: "1.245", label: "Aufrufe" },
        { value: "+18%", label: "ggü. Vorwoche" },
        { value: "37", label: "neue Leads" },
      ],
      bullets: [
        "Drei Top-Anfragen erfolgreich abgeschlossen",
        "Zwei Demos vereinbart",
        "Eine neue Integration veröffentlicht",
      ],
    },
    layouts: [
      "stats_three",
      "content_bullet_list",
      "content_text",
      "divider_with_label",
      "cta_card",
    ],
  },
  // 13
  {
    id: "transactional",
    label: "Transaktional",
    description: "Bestellbestätigungen und automatisierte System-Mails.",
    keywords: ["transaktional", "bestätigung", "system", "auto", "trigger"],
    content: {
      headline: "Bestellung bestätigt",
      subline:
        "Vielen Dank für deine Bestellung — eine Übersicht haben wir unten zusammengestellt.",
      cta: "Bestellung anzeigen",
      eyebrow: "Bestätigung",
      bullets4: [
        "Plan Pro · 49,00 €",
        "Onboarding · kostenlos",
        "MwSt. (19%) · 9,31 €",
        "Gesamt · 58,31 €",
      ],
    },
    layouts: [
      "content_text",
      "receipt_list",
      "notice_box",
      "cta_card",
      "footer_minimal",
    ],
  },
  // 14
  {
    id: "receipt",
    label: "Rechnung / Quittung",
    description: "Strukturierte Quittung mit Posten und Summe.",
    keywords: ["rechnung", "quittung", "receipt", "invoice", "zahlung"],
    content: {
      headline: "Rechnung #INV-1042",
      subline: "Vielen Dank für deinen Einkauf.",
      cta: "PDF herunterladen",
      eyebrow: "Rechnung",
      bullets4: [
        "Plan Pro (1 Monat) · 49,00 €",
        "Erweitertes Reporting · 12,00 €",
        "MwSt. (19%) · 11,59 €",
        "Gesamtbetrag · 72,59 €",
      ],
    },
    layouts: [
      "content_text",
      "receipt_list",
      "divider_with_label",
      "cta_card",
      "footer_copyright",
    ],
  },
  // 15
  {
    id: "shipping",
    label: "Versand-Status",
    description: "Statusupdate zu Bestellungen und Lieferungen.",
    keywords: ["versand", "lieferung", "status", "tracking", "paket"],
    content: {
      headline: "Dein Paket ist unterwegs",
      subline:
        "Voraussichtliche Zustellung: morgen zwischen 10 und 14 Uhr.",
      cta: "Sendung verfolgen",
      eyebrow: "Versand",
      placeholder: "Paket",
      bullets: ["Verpackt", "Übergeben", "In Zustellung"],
      cardTexts: ["Heute · 09:12", "Heute · 11:45", "Morgen geplant"],
    },
    layouts: [
      "hero_eyebrow",
      "content_numbered_steps",
      "notice_box",
      "cta_card",
      "footer_minimal",
    ],
  },
  // 16
  {
    id: "reminder",
    label: "Erinnerung",
    description: "Sanfte Erinnerung an offene Aktionen.",
    keywords: ["reminder", "erinnerung", "ping", "follow-up", "nudge"],
    content: {
      headline: "Kleine Erinnerung",
      subline:
        "Du hast deinen Vorgang noch nicht abgeschlossen — wir helfen gerne weiter.",
      cta: "Jetzt fortsetzen",
      eyebrow: "Erinnerung",
    },
    layouts: [
      "notice_box",
      "content_text",
      "cta_with_subline",
      "cta_card",
      "footer_minimal",
    ],
  },
  // 17
  {
    id: "reengagement",
    label: "Reaktivierung",
    description: "Win-Back inaktiver Nutzer mit klarem Mehrwert.",
    keywords: ["reengagement", "winback", "reaktivierung", "comeback", "lange"],
    content: {
      headline: "Wir vermissen dich",
      subline:
        "Schau, was sich seit deinem letzten Besuch alles getan hat.",
      cta: "Zurückkommen",
      ctaSecondary: "Was ist neu?",
      eyebrow: "Wir vermissen dich",
      placeholder: "Comeback",
      stats: [
        { value: "32", label: "neue Features" },
        { value: "−30%", label: "neuer Preis" },
        { value: "10x", label: "schneller" },
      ],
    },
    layouts: [
      "hero_split_left",
      "stats_three",
      "cta_two_buttons",
      "quote_avatar",
      "cta_card",
    ],
  },
  // 18
  {
    id: "survey",
    label: "Umfrage",
    description: "Feedback-Anfragen und kurze Umfragen.",
    keywords: ["umfrage", "feedback", "survey", "bewertung", "nps"],
    content: {
      headline: "Eine Minute deiner Zeit?",
      subline:
        "Hilf uns besser zu werden — drei kurze Fragen, anonym auswertbar.",
      cta: "Umfrage starten",
      ctaSecondary: "Später",
      eyebrow: "Feedback",
      bullets: ["Wie zufrieden?", "Was fehlt?", "Worauf freust du dich?"],
    },
    layouts: [
      "hero_eyebrow",
      "content_numbered_list",
      "cta_two_buttons",
      "notice_box",
      "footer_minimal",
    ],
  },
  // 19
  {
    id: "testimonial",
    label: "Kundenstimmen",
    description: "Social-Proof mit Zitaten von Kunden.",
    keywords: ["testimonial", "kundenstimme", "review", "quote", "feedback"],
    content: {
      headline: "Das sagen unsere Kunden",
      subline: "Mehr als 5.000 Teams vertrauen uns täglich.",
      cta: "Mehr Kundenstimmen",
      eyebrow: "★★★★★",
      quote:
        "Das beste Produkt, das ich seit Jahren benutzt habe — wirklich beeindruckend.",
      quoteAuthor: "— Max Mustermann, CTO @ Beispiel GmbH",
    },
    layouts: [
      "quote_centered",
      "quote_large_block",
      "quote_avatar",
      "stats_three",
      "cta_with_subline",
    ],
  },
  // 20
  {
    id: "pricing",
    label: "Preise",
    description: "Preistabellen und Plan-Vergleich.",
    keywords: ["preise", "pricing", "plan", "abo", "tarif"],
    content: {
      headline: "49 €",
      subline: "Pro Monat, jederzeit kündbar. Inklusive aller Updates.",
      cta: "Plan wählen",
      eyebrow: "Pro",
      bullets4: [
        "Unbegrenzte Bilder",
        "API-Zugriff",
        "Premium-Support",
        "SLA 99.9%",
      ],
    },
    layouts: [
      "pricing_single",
      "content_three_features",
      "cta_with_subline",
      "stats_three",
      "cta_card",
    ],
  },
  // 21
  {
    id: "stats",
    label: "Statistiken",
    description: "Reports und Zahlen-Übersichten.",
    keywords: ["stats", "zahlen", "metriken", "report", "analytics"],
    content: {
      headline: "Deine Zahlen",
      subline: "Highlights des aktuellen Zeitraums auf einen Blick.",
      cta: "Volle Auswertung",
      eyebrow: "Report",
      stats: [
        { value: "12.4k", label: "Aufrufe" },
        { value: "+24%", label: "ggü. Vorperiode" },
        { value: "98.2%", label: "Uptime" },
      ],
    },
    layouts: [
      "stats_three",
      "content_text",
      "divider_with_label",
      "cta_card",
      "footer_minimal",
    ],
  },
  // 22
  {
    id: "team",
    label: "Team",
    description: "Vorstellung von Mitarbeitenden und Personen-Portraits.",
    keywords: ["team", "people", "mitarbeiter", "portrait", "personen"],
    content: {
      headline: "Wer hinter Vehicle Imagery steckt",
      subline: "Ein kurzer Blick auf das Team, das jeden Tag dafür arbeitet.",
      cta: "Über uns",
      eyebrow: "Team",
      people: [
        { name: "Anna Berger", role: "Founder" },
        { name: "Ben Costa", role: "CTO" },
        { name: "Cara Dvorak", role: "Lead Design" },
      ],
    },
    layouts: [
      "avatar_three_team",
      "avatar_single",
      "content_text",
      "quote_avatar",
      "cta_with_subline",
    ],
  },
  // 23
  {
    id: "content",
    label: "Inhalt (generisch)",
    description: "Allgemeine Inhalts-Bausteine: Texte, Listen, Bilder.",
    keywords: ["content", "text", "inhalt", "absatz", "general"],
    content: {
      headline: "Worum es geht",
      subline:
        "Ein generischer Block, den du beliebig mit eigenen Inhalten füllst.",
      cta: "Mehr erfahren",
      bullets: ["Erster Punkt", "Zweiter Punkt", "Dritter Punkt"],
      bullets4: [
        "Erste Idee",
        "Zweite Idee",
        "Dritte Idee",
        "Vierte Idee",
      ],
    },
    layouts: [
      "content_text",
      "content_image_text",
      "content_bullet_list",
      "content_numbered_list",
      "divider_with_label",
    ],
  },
  // 24
  {
    id: "cta",
    label: "CTA",
    description: "Action-Banner um den User zu einer Handlung zu bringen.",
    keywords: ["cta", "call-to-action", "action", "button", "link"],
    content: {
      headline: "Bereit für den nächsten Schritt?",
      subline: "Schalte alle Funktionen frei und beschleunige dein Team.",
      cta: "Jetzt starten",
      ctaSecondary: "Demo ansehen",
    },
    layouts: [
      "cta_banner",
      "cta_two_buttons",
      "cta_with_subline",
      "cta_card",
      "hero_centered_cta",
    ],
  },
  // 25
  {
    id: "footer",
    label: "Footer",
    description: "Abschluss-Sections mit Adresse, Social und Abmelde-Link.",
    keywords: ["footer", "abmelden", "address", "kontakt", "unsubscribe"],
    content: {
      headline: "",
      subline: "",
      cta: "",
      address: "Vehicle Imagery GmbH · Musterstraße 1 · 12345 Berlin",
      cardTitles: ["Produkt", "Firma", "Rechtliches"],
      cardTexts: [
        "Features|Preise|Changelog",
        "Über uns|Kontakt|Karriere",
        "Impressum|Datenschutz|Abmelden",
      ],
    },
    layouts: [
      "footer_social",
      "footer_columns",
      "footer_minimal",
      "footer_copyright",
      "divider_with_label",
    ],
  },
  // 26
  {
    id: "legal",
    label: "Rechtliches",
    description: "DSGVO-Hinweise, Cookie-Banner-Texte und AGB-Mails.",
    keywords: ["legal", "dsgvo", "agb", "cookies", "rechtlich", "compliance"],
    content: {
      headline: "Aktualisierte Datenschutz-Hinweise",
      subline:
        "Wir haben unsere Datenschutzerklärung überarbeitet — wichtige Änderungen findest du untenstehend.",
      cta: "Volle Erklärung lesen",
      eyebrow: "Rechtlich",
      bullets: [
        "Erweiterte Auskunftsrechte",
        "Klare Speicherfristen",
        "Neue Sub-Auftragsverarbeiter",
      ],
    },
    layouts: [
      "content_text",
      "content_bullet_list",
      "notice_box",
      "cta_card",
      "footer_copyright",
    ],
  },
  // 27
  {
    id: "holiday",
    label: "Feiertag",
    description: "Saisonale Mails (Weihnachten, Ostern, Neujahr, …).",
    keywords: ["feiertag", "weihnachten", "ostern", "neujahr", "saison"],
    content: {
      headline: "Frohe Feiertage!",
      subline:
        "Wir wünschen dir und deinem Team eine erholsame Zeit und einen guten Rutsch.",
      cta: "Saison-Angebote",
      eyebrow: "Aus dem Team",
      placeholder: "Feiertag",
    },
    layouts: [
      "hero_centered_cta",
      "hero_full_image",
      "quote_centered",
      "cta_card",
      "footer_minimal",
    ],
  },
];
