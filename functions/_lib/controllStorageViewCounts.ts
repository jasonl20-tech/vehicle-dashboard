/**
 * Erwartete View-Anzahlen aus `vehicleimagery_controlling_storage.views`
 * für Analytics-Summen (ohne korrelierte Subqueries in D1).
 *
 * Korrektur: wie `expectedViewsExpr("correction")` — Semikolon-Segmentzählung
 * minus Zeichen mit `#`.
 *
 * Skalierung: wie `countScalingViewPairsInViews` in `src/lib/vehicleImageryUrl.ts`.
 */

function parseViewTokens(views: string | null | undefined): string[] {
  if (!views?.trim()) return [];
  return views
    .split(/[;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function isScalingControlViewToken(raw: string): boolean {
  const t = (raw ?? "").trim();
  const i = t.indexOf("#");
  if (i === -1) return false;
  const mod = t.slice(i + 1).trim().toLowerCase();
  return mod === "skaliert" || mod === "skaliert_weiß";
}

function slugBeforeHash(raw: string): string {
  const t = (raw ?? "").trim();
  const i = t.indexOf("#");
  if (i === -1) return t;
  const slug = t.slice(0, i).trim();
  return slug || t;
}

/** Entspricht SQL `expectedViewsExpr` für `correction`. */
export function correctionExpectedViewCountFromViews(
  views: string | null | undefined,
): number {
  const v = views ?? "";
  if (v === "") return 0;
  const tokensTotal = v.length - v.replace(/;/g, "").length + 1;
  const tokensWithHash = v.length - v.replace(/#/g, "").length;
  return Math.max(0, tokensTotal - tokensWithHash);
}

/** Entspricht `countScalingViewPairsInViews` (Frontend / SQL scaling open count). */
export function scalingPairExpectedCountFromViews(
  views: string | null | undefined,
): number {
  const slugs = new Set<string>();
  for (const t of parseViewTokens(views)) {
    if (!isScalingControlViewToken(t)) continue;
    slugs.add(slugBeforeHash(t).toLowerCase());
  }
  return slugs.size;
}
