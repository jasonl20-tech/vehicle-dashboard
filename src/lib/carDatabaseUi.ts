/** Geteilte UI-Konstanten + Helfer für die Car-Database-Seiten (Übersicht + Liste). */

export const PAGE_SIZE = 30;

export const TEXT_IN =
  "w-full min-w-0 rounded border border-hair bg-white px-2 py-1.5 text-[12.5px] text-ink-800 focus:border-ink-400 focus:outline-none";
export const TH =
  "px-2 py-2 text-left text-[10px] font-medium uppercase tracking-[0.1em] text-ink-400";
export const TD = "px-2 py-2 align-middle text-[12.5px] text-ink-800";
export const CARD = "rounded-lg border border-hair bg-paper p-4";

export const C = {
  brand: "#5a3df0",
  done: "#10b981",
  open: "#5a3df0",
  hold: "#f59e0b",
  error: "#f43f5e",
  neutral: "#cbd5e1",
};

export function fmtWhen(s: string | null | undefined): string {
  if (!s?.trim()) return "—";
  const t = s.includes("T")
    ? Date.parse(s)
    : Date.parse(s.replace(" ", "T") + "Z");
  if (isNaN(t)) return s;
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(t));
}

export function pct(part: number, whole: number): number {
  if (!whole) return 0;
  return Math.round((part / whole) * 100);
}
