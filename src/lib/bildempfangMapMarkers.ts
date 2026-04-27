import type { ImageUrlIpRow } from "./bildempfangIpApi";
import { iso2Latlng } from "./iso2Countries";

export type IpMapMarker = {
  key: string;
  /** `react-simple-maps` Marker: [lng, lat] */
  coordinates: [number, number];
  title: string;
  family: "v4" | "v6";
  r: number;
  /** ISO-2 — für Netz-Linien Land → Punkt */
  iso2: string;
};

/**
 * Ländermittelpunkt + leichte Streuung (kleine Offsets = „genauer“ als breite Zufallsfläche).
 * Ohne GeoIP im Worker bleibt es Näherung pro Land.
 */
function jitter(
  ip: string,
  iso2: string,
  base: [number, number],
): [number, number] {
  let h = 2166136261;
  const s = `${iso2}|${ip}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const u = h >>> 0;
  const a = (u & 0xffff) / 0xffff;
  const b = ((u >> 16) & 0xffff) / 0xffff;
  const dLat = (a - 0.5) * 0.55;
  const dLng = (b - 0.5) * 0.75;
  return [base[0] + dLat, base[1] + dLng];
}

export function buildIpMapMarkers(
  rows: ImageUrlIpRow[],
  options: { maxMarkers?: number } = {},
): IpMapMarker[] {
  const max = options.maxMarkers ?? 360;
  const valid = rows.filter((r) => r.family === "v4" || r.family === "v6");
  const placed: {
    r: ImageUrlIpRow;
    lat: number;
    lng: number;
  }[] = [];
  for (const r of valid) {
    const ll0 = iso2Latlng(r.iso2);
    if (!ll0) continue;
    const [lat, lng] = jitter(r.ip, r.iso2, ll0);
    placed.push({ r, lat, lng });
  }
  const sorted = [...placed].sort((a, b) => b.r.count - a.r.count);
  const take = sorted.slice(0, max);
  const maxCount = Math.max(1, ...take.map((x) => x.r.count));
  return take.map(({ r, lat, lng }) => {
    const t = Math.log(1 + r.count) / Math.log(1 + maxCount);
    const rad = 2 + 7 * t;
    const fam = r.family === "v4" ? "v4" : "v6";
    return {
      key: `${r.ip}|${r.iso2}`,
      coordinates: [lng, lat] as [number, number],
      family: fam,
      r: rad,
      iso2: r.iso2,
      title: `${r.ip} (${fam === "v4" ? "IPv4" : "IPv6"}) — ${r.iso2}: ${r.count}`,
    };
  });
}
