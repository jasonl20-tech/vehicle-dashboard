/**
 * Geteilter Standard-Fahrzeugsatz der Demo (Hero + Showroom). Wird von der
 * Demo-Seite UND vom Demo-Link-Generator genutzt: Beim Erzeugen eines
 * Kunden-Links wird genau dieser Satz als „erlaubte Fahrzeuge" in den Link
 * geschrieben (Snapshot). So bleiben Demo-Anzeige und serverseitige
 * Scope-Prüfung im Bild-Proxy konsistent.
 */

export type DemoCar = {
  marke: string;
  modell: string;
  jahr: number;
  body: string;
  trim: string;
};

/** Kuratierte Hero-Fahrzeuge (vollständig, alle Farben/Ansichten). */
export const STANDARD_FEATURED: DemoCar[] = [
  { marke: "BMW", modell: "X3", jahr: 2024, body: "Basis", trim: "base" },
  { marke: "Tesla", modell: "Model_S", jahr: 2021, body: "Basis", trim: "base" },
  { marke: "Audi", modell: "e-tron", jahr: 2022, body: "Basis", trim: "base" },
  { marke: "BMW", modell: "i7", jahr: 2022, body: "Basis", trim: "base" },
  { marke: "Tesla", modell: "Cybertruck", jahr: 2023, body: "Basis", trim: "base" },
  { marke: "BMW", modell: "iX", jahr: 2021, body: "Basis", trim: "base" },
];

/** Showroom „Baujahr 2010" (fester Fallback-Satz). */
export const STANDARD_SHOWROOM: DemoCar[] = [
  { marke: "Volkswagen", modell: "Golf", jahr: 2010, body: "Basis", trim: "base" },
  { marke: "BMW", modell: "5er", jahr: 2010, body: "Basis", trim: "base" },
  { marke: "Audi", modell: "A4", jahr: 2010, body: "Basis", trim: "base" },
  { marke: "Mercedes-Benz", modell: "C_Klasse", jahr: 2010, body: "Basis", trim: "base" },
  { marke: "Ford", modell: "Focus", jahr: 2010, body: "Basis", trim: "base" },
  { marke: "Opel", modell: "Astra", jahr: 2010, body: "Basis", trim: "base" },
  { marke: "Toyota", modell: "Corolla", jahr: 2010, body: "Basis", trim: "base" },
  { marke: "Volkswagen", modell: "Passat", jahr: 2010, body: "Basis", trim: "base" },
  { marke: "Audi", modell: "A6", jahr: 2010, body: "Basis", trim: "base" },
  { marke: "BMW", modell: "X5", jahr: 2010, body: "Basis", trim: "base" },
];

/**
 * Für Demo-Links auswählbare Farben (Slug + Label). „default" ist serverseitig
 * immer erlaubt und daher hier nicht wählbar.
 */
export const DEMO_LINK_COLOR_CHOICES: { value: string; label: string }[] = [
  { value: "white", label: "Weiß" },
  { value: "black", label: "Schwarz" },
  { value: "blue", label: "Blau" },
  { value: "orange", label: "Orange" },
  { value: "wine_red", label: "Weinrot" },
];
