/**
 * Cyan → Magenta-Gradient für die Bildempfang-Karte (Watch-Dogs/Palantir-
 * Neon-Look). Niedrige `double2`-Werte (schnell ausgeliefert) wirken
 * cyan-türkis ("alles im grünen Bereich"), hohe Werte werden magenta
 * (auffällig, "warum so langsam?").
 *
 * Wir verwenden ein 3-Stop-Gradient: Cyan → Lila → Magenta — der
 * Übergang über Lila vermeidet die matschige Mittelfarbe, die ein
 * direkter Cyan→Magenta-Lerp im RGB-Raum erzeugen würde.
 */
type RGB = { r: number; g: number; b: number };

const CYAN: RGB = { r: 34, g: 211, b: 238 }; // #22d3ee
const VIOLET: RGB = { r: 167, g: 139, b: 250 }; // #a78bfa
const MAGENTA: RGB = { r: 217, g: 70, b: 239 }; // #d946ef
const NEUTRAL: RGB = { r: 148, g: 163, b: 184 }; // #94a3b8 — slate-400

/** Cloudflare-Brand-Orange für Edge-PoPs auf der Karte. */
export const EDGE_PRIMARY = { r: 243, g: 130, b: 31 } as const; // #f3821f
export const EDGE_PRIMARY_RGB = "243, 130, 31" as const;

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function lerpRgb(a: RGB, b: RGB, t: number): RGB {
  return {
    r: lerp(a.r, b.r, t),
    g: lerp(a.g, b.g, t),
    b: lerp(a.b, b.b, t),
  };
}

function gradient(ms: number, range: { lo: number; hi: number }): RGB {
  const { lo, hi } = range;
  const spread = Math.max(80, hi - lo);
  const t = Math.min(1, Math.max(0, (ms - lo) / spread));
  // Erste Hälfte: Cyan → Violet, zweite Hälfte: Violet → Magenta
  if (t < 0.5) return lerpRgb(CYAN, VIOLET, t * 2);
  return lerpRgb(VIOLET, MAGENTA, (t - 0.5) * 2);
}

/**
 * Mappt ms → Farbe (Cyan → Magenta). `null` ergibt einen dezenten
 * Neutral-Grauton, damit fehlende Latenz nicht „grün" wirkt.
 */
export function msToRgba(
  ms: number | null,
  range: { lo: number; hi: number } = { lo: 20, hi: 900 },
): string {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) {
    const c = NEUTRAL;
    return `rgba(${c.r},${c.g},${c.b},0.85)`;
  }
  const { r, g, b } = gradient(ms, range);
  return `rgba(${r},${g},${b},0.92)`;
}

/**
 * Liefert Linien-/Glow-Farbe als Tuple für die Edge-IP-Verbindungen.
 * Glow ist eine entsättigte/transparente Variante derselben Farbe.
 */
export function msToRgbaGloss(
  ms: number | null,
  range: { lo: number; hi: number },
): { line: string; glow: string } {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) {
    return { line: "rgba(148,163,184,0.55)", glow: "rgba(148,163,184,0.12)" };
  }
  const { r, g, b } = gradient(ms, range);
  return {
    line: `rgba(${r},${g},${b},0.95)`,
    glow: `rgba(${r},${g},${b},0.22)`,
  };
}

/** Reine RGB-Triple-Variante für CSS-Variablen / SVG-Filter. */
export function msToRgbTriple(
  ms: number | null,
  range: { lo: number; hi: number } = { lo: 20, hi: 900 },
): string {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) {
    return `${NEUTRAL.r}, ${NEUTRAL.g}, ${NEUTRAL.b}`;
  }
  const { r, g, b } = gradient(ms, range);
  return `${r}, ${g}, ${b}`;
}
