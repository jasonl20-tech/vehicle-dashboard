import countriesRaw from "world-countries";

export type Iso2CountryEntry = {
  /** ISO-3166-Alpha-2, immer großgeschrieben (z. B. `"DE"`). */
  iso2: string;
  /** Englisch-gebräuchlicher Name (Backup, nicht UI-Default). */
  nameEn: string;
  /** Deutsche Bezeichnung, mit Fallback auf den englischen Namen. */
  nameDe: string;
  /** Repräsentativer Mittelpunkt: `[lat, lng]`. */
  latlng: [number, number];
};

/**
 * Vorgefertigte Liste aller ISO-2-Länder (Antarktis ausgenommen) mit
 * deutschem Namen und lat/lng-Mittelpunkt.
 *
 * Wird unverändert für CRM-Dropdown UND Geo-Bögen genutzt – so ist garantiert,
 * dass jeder im CRM gewählte Standort auch auf der Karte einen Punkt hat.
 */
const RAW = countriesRaw as Array<{
  cca2: string;
  name: { common: string };
  translations?: { deu?: { common?: string } };
  latlng?: [number, number];
}>;

export const ISO2_COUNTRIES: Iso2CountryEntry[] = RAW
  .filter((c) => /^[A-Z]{2}$/.test(c.cca2) && c.cca2 !== "AQ")
  .map((c) => {
    const ll = Array.isArray(c.latlng) && c.latlng.length === 2 ? c.latlng : [0, 0];
    return {
      iso2: c.cca2.toUpperCase(),
      nameEn: c.name.common,
      nameDe: c.translations?.deu?.common || c.name.common,
      latlng: [Number(ll[0]) || 0, Number(ll[1]) || 0] as [number, number],
    };
  })
  .sort((a, b) => a.nameDe.localeCompare(b.nameDe, "de"));

export const ISO2_TO_COUNTRY: Record<string, Iso2CountryEntry> = (() => {
  const m: Record<string, Iso2CountryEntry> = {};
  for (const e of ISO2_COUNTRIES) m[e.iso2] = e;
  return m;
})();

export function iso2Name(iso2: string | null | undefined): string {
  if (!iso2) return "";
  const v = String(iso2).toUpperCase();
  return ISO2_TO_COUNTRY[v]?.nameDe ?? v;
}

export function iso2Latlng(
  iso2: string | null | undefined,
): [number, number] | null {
  if (!iso2) return null;
  const e = ISO2_TO_COUNTRY[String(iso2).toUpperCase()];
  return e ? e.latlng : null;
}
