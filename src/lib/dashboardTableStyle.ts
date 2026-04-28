/** Gleicher horizontaler Inset wie `DashboardHeader` in der Hauptspalte */
export const DASHBOARD_MAIN_INSET_X = "px-2 sm:px-3 lg:px-4";

/** Dezentes Zellenraster (wie CRM) */
export const DASH_TABLE_GRID = "border border-ink-200/85";

export const DASH_TH = `${DASH_TABLE_GRID} bg-gradient-to-b from-ink-50 to-ink-100/90 p-0 align-middle`;
export const DASH_TD = `${DASH_TABLE_GRID} p-0 align-middle bg-white`;

/** Tabellenkopf mit Sortier-Buttons (CRM) */
export const DASH_TH_SORT = DASH_TH;

/** Kopfzelle mit `<button>` (Sortierung) — gleiche Optik wie Kunden-CRM */
export const DASH_SORT_COLUMN_BTN =
  "flex w-full min-h-[2.85rem] items-center justify-center gap-0.5 px-1.5 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.05em] text-ink-500 transition hover:bg-ink-200/30 hover:text-ink-700";

/** Sortierkopf ohne Interaktion (z. B. Aktions-Spalte) */
export const DASH_TH_LABEL =
  "flex w-full min-h-[2.85rem] items-center justify-center px-1.5 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.05em] text-ink-500";

/** Zellen-Inhalt (zentriert) — gleiche Rhythmik wie CRM */
export const DASH_TD_INNER =
  "flex min-h-[3rem] w-full max-w-full items-center justify-center gap-1 px-3 py-2 text-center text-[12.5px] leading-snug text-ink-800";

export const DASH_TD_INNER_MONO =
  "flex min-h-[3rem] w-full max-w-full items-center justify-center px-2.5 py-2 text-center font-mono text-[11px] leading-tight text-ink-500";
