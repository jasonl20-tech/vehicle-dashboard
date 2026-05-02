import type { AuthEnv } from "./auth";

const BLOB_SAFE = 4096;

export function truncateAnalyticsBlob(s: string, max = BLOB_SAFE): string {
  if (s.length <= max) return s;
  return `${s.slice(0, Math.max(0, max - 1))}…`;
}

export function clientIpFromRequest(request: Request): string {
  const cf = request.headers.get("CF-Connecting-IP");
  if (cf?.trim()) return cf.trim();
  const xff = request.headers.get("X-Forwarded-For");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return "";
}

/**
 * Ein Analytics-Engine-Datenpunkt für Control-Platform-Aktionen.
 *
 * - `indexes[0]` / `blob1`: Benutzername
 * - `blob2`: z. B. `shortcut:correct` oder `toolbar:regen_vertex`
 * - `blob3`: Anzeige-Modus (z. B. „Korrektur“, „Skalierung“)
 * - `blob4`: Bild-R2-Key
 * - `blob5`: Client-IP
 * - `blob6`: User-Agent; optional mit ` | ` angehängte Client-Meta
 * - `blob7`: RTT in ms (String)
 * - `double1`..`double5`: 1, offene Korrektur-Fahrzeuge, 0, 0, offene Skalierungs-Fahrzeuge
 * - `double6`: Summe noch offener Korrektur-Ansichten (ohne #trp/#skaliert/…)
 * - `double7`–`double8`: 0
 * - `double9`: Summe noch offener Skalierungs-Kacheln (Paar = 1)
 */
export function writeControllPlatformAnalyticsPoint(
  env: AuthEnv,
  input: {
    username: string;
    actionLabel: string;
    viewsModeLabel: string;
    imageKey: string | null;
    clientIp: string;
    userAgent: string;
    metaAppend?: string | null;
    clientRttMs: number | null;
    doubleOpenCorrection: number;
    doubleOpenScaling: number;
    doubleRemainingCorrectionViews: number;
    doubleRemainingScalingPairs: number;
  },
): void {
  const ae = env.controll_analytics;
  if (!ae || typeof ae.writeDataPoint !== "function") return;

  const ua = truncateAnalyticsBlob(input.userAgent);
  const blob6 =
    input.metaAppend?.trim() ?
      truncateAnalyticsBlob(`${ua} | ${input.metaAppend.trim()}`)
    : ua;

  const blob7 =
    input.clientRttMs != null && Number.isFinite(input.clientRttMs) ?
      String(Math.round(input.clientRttMs))
    : "";

  ae.writeDataPoint({
    indexes: [truncateAnalyticsBlob(input.username, 96)],
    blobs: [
      input.username,
      input.actionLabel,
      input.viewsModeLabel,
      truncateAnalyticsBlob(input.imageKey ?? "", 2048),
      input.clientIp,
      blob6,
      blob7,
    ],
    doubles: [
      1,
      input.doubleOpenCorrection,
      0,
      0,
      input.doubleOpenScaling,
      input.doubleRemainingCorrectionViews,
      0,
      0,
      input.doubleRemainingScalingPairs,
    ],
  });
}
