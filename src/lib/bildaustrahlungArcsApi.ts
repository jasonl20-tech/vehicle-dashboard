/**
 * Frontend-Anbindung an `GET /api/intern-analytics/image-url-requests-customer-arcs`.
 * Liefert pro CRM-Kunde mit Standort + Firmen-Domain das Country-Breakdown
 * der Bildaustrahlung – damit Bögen vom Firmensitz zu jedem Viewer-Land
 * gezeichnet werden können.
 */

const PATH = "/api/intern-analytics/image-url-requests-customer-arcs" as const;

export type BildaustrahlungArcCustomer = {
  id: string;
  email: string;
  company: string;
  /** ISO-3166-Alpha-2 (z. B. "DE"); DB-Spalte `location`. */
  location: string;
  /** Erste gematchte index1-Domain (Anzeige). */
  domain: string;
  domainsMatched: string[];
  /** ISO-2 → SUM(_sample_interval). */
  viewers: Record<string, number>;
  viewersTotal: number;
  viewersCountryCount: number;
  viewerMax: number;
};

export type BildaustrahlungArcsResponse = {
  from: string;
  to: string;
  days: number;
  modesTried: ("filter" | "dedicated")[];
  customers: BildaustrahlungArcCustomer[];
  stats?: {
    crmCustomers: number;
    candidatesWithDomain: number;
    domainsQueried: number;
    matchedCustomers: number;
  };
  queryWarnings?: string[];
  info?: string;
};

export function imageUrlRequestsCustomerArcsUrl(
  options: { days?: number } = {},
): string {
  const p = new URLSearchParams();
  if (options.days != null) p.set("days", String(options.days));
  const qs = p.toString();
  return qs ? `${PATH}?${qs}` : PATH;
}

/**
 * Reduzierter Bogen pro Kunde × Viewer-Land — ein Eintrag pro Linie auf
 * der Karte. `count` ist die Anzahl der Requests aus diesem Land für
 * exakt diese Firmen-Domain.
 */
export type BildaustrahlungArc = {
  customerId: string;
  customerEmail: string;
  company: string;
  domain: string;
  /** ISO-2 des Firmensitzes. */
  fromIso2: string;
  /** ISO-2 des Viewers. */
  toIso2: string;
  count: number;
  /** Anteil [0,1] am Maximum dieses Kunden – für Linienstärke/Opazität. */
  weight: number;
};

export function arcsFromCustomers(
  customers: BildaustrahlungArcCustomer[],
): BildaustrahlungArc[] {
  const out: BildaustrahlungArc[] = [];
  for (const c of customers) {
    if (!/^[A-Z]{2}$/.test(c.location)) continue;
    const max = c.viewerMax || 1;
    for (const [iso2, count] of Object.entries(c.viewers)) {
      if (!/^[A-Z]{2}$/.test(iso2)) continue;
      if (iso2 === c.location) continue;
      out.push({
        customerId: c.id,
        customerEmail: c.email,
        company: c.company,
        domain: c.domain,
        fromIso2: c.location,
        toIso2: iso2,
        count,
        weight: count > 0 && max > 0 ? Math.min(1, count / max) : 0,
      });
    }
  }
  return out;
}
