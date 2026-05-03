/**
 * R2-Objektschlüssel (`v1/…`) für Controlling-Bilder — gleiche Segment-Kodierung
 * wie `buildVehicleImageUrl` im Frontend; anschließend liefert `r2KeyFromImageUrl`
 * denselben String aus der vollen URL.
 */

function fileExtFromRowFormat(format: string | null | undefined): string {
  const f = String(format ?? "")
    .trim()
    .toLowerCase()
    .replace(/^\./, "");
  if (!f) return "png";
  return f;
}

function pathSeg(s: string | number | null | undefined): string {
  return encodeURIComponent(String(s ?? "").trim());
}

export type VehicleImageryRowFieldsForR2 = {
  format: string | null;
  resolution: string | null;
  marke: string | null;
  modell: string | null;
  jahr: number | null;
  body: string | null;
  trim: string | null;
  farbe: string | null;
};

/**
 * Pfad ab `v1/` (ohne CDN-Host), z. B. für `controll_status.key` bei
 * `regen_vertex` / Generierungs-Jobs.
 */
export function controllingStorageR2KeyFromViewToken(
  row: VehicleImageryRowFieldsForR2,
  viewToken: string,
): string {
  const view = String(viewToken ?? "").trim();
  const ext = fileExtFromRowFormat(row.format);
  const fileName = view ? `${view}.${ext}` : `.${ext}`;
  return `v1/${pathSeg(row.format)}/${pathSeg(row.resolution)}/${pathSeg(row.marke)}/${pathSeg(row.modell)}/${pathSeg(row.jahr)}/${pathSeg(row.body)}/${pathSeg(row.trim)}/${pathSeg(row.farbe)}/${encodeURIComponent(fileName)}`;
}
