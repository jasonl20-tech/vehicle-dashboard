import type { ImageUrlIpRow } from "./bildempfangIpApi";
import { msToRgba } from "./bildempfangMsColor";
import { iso2Latlng } from "./iso2Countries";

export type IpMapMarker = {
  key: string;
  ip: string;
  /** `react-simple-maps` Marker: [lng, lat] */
  coordinates: [number, number];
  title: string;
  family: "v4" | "v6";
  r: number;
  /** ISO-2 */
  iso2: string;
  /** Mittlere Latenz (ms) pro IP/Land, für Farbe */
  avgMs: number | null;
  userAgent: string;
  edgeCode: string;
  imagePath: string;
  /** Anzahl Requests pro IP/Land im ausgewählten Zeitraum. */
  count: number;
  /** Key-Status aus `blob8` (valid / expired / none / "") */
  status: string;
  /** RGBA aus avgMs (grün…rot) */
  signalColor: string;
  /** Größere Aura (px), innen folgt kleiner IP-Punkt */
  auraRadius: number;
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
  const mss = take
    .map((x) => x.r.avgMs)
    .filter((v): v is number => v != null && v > 0);
  const msLo = mss.length ? Math.min(...mss) : 50;
  const msHi = mss.length ? Math.max(...mss) : 800;

  return take.map(({ r, lat, lng }) => {
    const t = Math.log(1 + r.count) / Math.log(1 + maxCount);
    const rad = 2 + 7 * t;
    const fam = r.family === "v4" ? "v4" : "v6";
    const rawAvg = r.avgMs;
    const avg =
      rawAvg != null && rawAvg > 0
        ? rawAvg
        : null;
    const signalColor = msToRgba(avg, { lo: msLo, hi: msHi });
    const auraRadius = 10 + 20 * t;
    return {
      key: `${r.ip}|${r.iso2}`,
      ip: r.ip,
      coordinates: [lng, lat] as [number, number],
      family: fam,
      r: rad,
      iso2: r.iso2,
      avgMs: avg,
      userAgent: (r.userAgent ?? "").trim(),
      edgeCode: (r.edgeCode ?? "").trim().toUpperCase().slice(0, 3),
      imagePath: (r.imagePath ?? "").trim(),
      count: r.count,
      status: (r.status ?? "").trim().toLowerCase(),
      signalColor,
      auraRadius,
      title: `${r.ip} (${fam === "v4" ? "IPv4" : "IPv6"}) — ${r.iso2}: ${r.count}`,
    };
  });
}
