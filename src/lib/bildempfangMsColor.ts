const GREEN = { r: 34, g: 197, b: 94 } as const;
const RED = { r: 239, g: 68, b: 68 } as const;
const GRAY = { r: 148, g: 163, b: 184 } as const;

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

/**
 * Mappt ms → Farbe: niedriger wert = grün, höher = rot (schlechter Empfang).
 * `null` = neutralgrau.
 */
export function msToRgba(
  ms: number | null,
  range: { lo: number; hi: number } = { lo: 20, hi: 900 },
): string {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) {
    const c = GRAY;
    return `rgba(${c.r},${c.g},${c.b},0.85)`;
  }
  const { lo, hi } = range;
  const spread = Math.max(80, hi - lo);
  const t = Math.min(1, Math.max(0, (ms - lo) / spread));
  const r = lerp(GREEN.r, RED.r, t);
  const g = lerp(GREEN.g, RED.g, t);
  const b = lerp(GREEN.b, RED.b, t);
  return `rgba(${r},${g},${b},0.9)`;
}

export function msToRgbaGloss(ms: number | null, range: { lo: number; hi: number }): {
  line: string;
  glow: string;
} {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) {
    return { line: "rgba(148,163,184,0.5)", glow: "rgba(148,163,184,0.12)" };
  }
  const { lo, hi } = range;
  const spread = Math.max(80, hi - lo);
  const t = Math.min(1, Math.max(0, (ms - lo) / spread));
  const r = lerp(GREEN.r, RED.r, t);
  const g = lerp(GREEN.g, RED.g, t);
  const b = lerp(GREEN.b, RED.b, t);
  return {
    line: `rgba(${r},${g},${b},0.92)`,
    glow: `rgba(${r},${g},${b},0.2)`,
  };
}
