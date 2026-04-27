/**
 * Extrahiert Marke/Modell aus typischen Bild-URL-Pfaden
 * (`.../default/Marke/Modell_mit_Unterstrichen/...`).
 */
export function parseVehicleFromImagePath(path: string): {
  brand: string;
  model: string;
} | null {
  const p = path.trim();
  if (!p) return null;
  const m =
    /\/default\/([^/]+)\/([^/]+)(?:\/|$)/.exec(p) ||
    /(?:^|\/)png\/default\/([^/]+)\/([^/]+)(?:\/|$)/i.exec(p);
  if (!m) return null;
  const brand = m[1]!.replace(/_/g, " ").trim();
  const model = m[2]!.replace(/_/g, " ").trim();
  if (!brand || !model) return null;
  return { brand, model };
}

/** Kompakte Geräte-Zeile aus User-Agent (heuristisch). */
export function summarizeUserAgent(ua: string): string {
  const u = ua.trim();
  if (!u) return "—";
  let os = "";
  if (/iPhone|iPad|iPod/.test(u)) os = "iOS";
  else if (/Android/.test(u)) os = "Android";
  else if (/Mac OS X/.test(u)) os = "macOS";
  else if (/Windows NT/.test(u)) os = "Windows";
  else if (/Linux/.test(u)) os = "Linux";
  let browser = "";
  if (/Edg\//.test(u)) browser = "Edge";
  else if (/Chrome\//.test(u) && !/Chromium/.test(u)) browser = "Chrome";
  else if (/Firefox\//.test(u)) browser = "Firefox";
  else if (/Safari\//.test(u) && !/Chrome/.test(u)) browser = "Safari";
  if (os && browser) return `${browser} · ${os}`;
  if (u.length <= 100) return u;
  return `${u.slice(0, 96)}…`;
}
