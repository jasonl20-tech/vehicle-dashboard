import {
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  Lock,
  Plus,
  Search,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Link } from "react-router-dom";
import type { ControlPlatformViewsMode } from "../lib/controlPlatformModeContext";
import {
  CONTROL_PLATFORM_MODE_LABEL,
  useControlPlatformViewsMode,
} from "../lib/controlPlatformModeContext";
import {
  CONTROL_PLATFORM_MODE_TO_SETTING,
  CONTROLL_ACTION_TO_STATUS,
  CONTROLL_BUTTONS_SETTINGS_PATH,
  DEFAULT_CONTROLL_BUTTONS_CONFIG,
  type ControllActionStub,
  type ControllButtonsSettingsApiResponse,
} from "../lib/controllButtonsConfig";
import {
  postControllStatus,
  r2KeyFromImageUrl,
} from "../lib/controllStatusApi";
import { fmtNumber, useApi } from "../lib/customerApi";
import {
  areFirstViewsReady,
  FIRST_VIEWS_SETTINGS_PATH,
  type FirstViewsApiResponse,
  isSlotBlockedByFirstViews,
  makeFirstViewsSet,
} from "../lib/firstViewsConfig";
import {
  INSIDE_VIEWS_SETTINGS_PATH,
  type InsideViewsApiResponse,
  makeInsideViewsSet,
} from "../lib/insideViewsConfig";
import {
  GENERATION_VIEWS_SETTINGS_PATH,
  type GenerationViewsApiResponse,
  type GenerationViewsConfig,
  isGenerationAllowedForSlug,
} from "../lib/generationViewsConfig";
import {
  buildGoogleImageSearchQuery,
  GOOGLE_IMAGE_SEARCH_SETTINGS_PATH,
  type GoogleImageSearchApiResponse,
  googleImageSearchUrl,
} from "../lib/googleImageSearchConfig";
import {
  PREVIEW_IMAGES_SETTINGS_PATH,
  previewImageForSlug,
  type PreviewImagesSettingsApiResponse,
} from "../lib/previewImagesConfig";
import {
  type ControllListSortOption,
  type ControllListStatusFilter,
  CONTROLL_LIST_SORT_OPTIONS,
  CONTROLL_LIST_STATUS_FILTERS,
  type ControllStatusRow,
  VEHICLE_IMAGERY_CONTROLLING_API,
  VEHICLE_IMAGERY_CONTROLLING_CDN_FALLBACK,
  type VehicleImageryListResponse,
  type VehicleImageryOneResponse,
  vehicleImageryListUrl,
  vehicleImageryOneUrl,
} from "../lib/vehicleImageryPublicApi";
import {
  postControllPlatformAnalyticsFireAndForget,
} from "../lib/controllPlatformAnalyticsApi";
import {
  buildVehicleImageUrl,
  countScalingViewPairsInViews,
  isScalingControlViewToken,
  parseViewSlot,
  parseViewTokens,
  viewPathSlug,
  viewTokenImageFileName,
} from "../lib/vehicleImageryUrl";

/** Grünes Schachbrett hinter Fahrzeugbildern im Skalierungs-Modus. */
const SCALING_MODE_VEHICLE_BACKDROP_STYLE: CSSProperties = {
  backgroundColor: "#c5e1a5",
  backgroundImage:
    "repeating-conic-gradient(from 0deg, #aed581 0deg 90deg, #9ccc65 0deg 180deg)",
  backgroundSize: "16px 16px",
};

const PAGE_SIZE = 50;

function fmtWhen(s: string | null | undefined): string {
  if (!s?.trim()) return "—";
  const t = s.includes("T")
    ? Date.parse(s)
    : Date.parse(s.replace(" ", "T") + "Z");
  if (isNaN(t)) return s;
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(t));
}

function rowTitle(r: {
  marke: string | null;
  modell: string | null;
  id: number;
}): string {
  const t = `${r.marke ?? ""} ${r.modell ?? ""}`.trim();
  return t || `Eintrag ${r.id}`;
}

function rowSubtitle(r: {
  jahr: number | null;
  body: string | null;
  trim: string | null;
  farbe: string | null;
  resolution: string | null;
  format: string | null;
}): string {
  const parts = [
    r.jahr != null ? String(r.jahr) : null,
    [r.body, r.trim, r.farbe].filter(Boolean).join(" · ") || null,
    r.resolution || r.format
      ? [r.resolution, r.format].filter(Boolean).join("/")
      : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "—";
}

/**
 * Welche View-Tokens werden im aktuellen Modus als Kachel angezeigt?
 * - Korrektur: nur Tokens **ohne** `#`-Modifier (keine `#trp`/`#skaliert`/`#shadow`).
 * - Skalierung: nur `#skaliert` und `#skaliert_weiß` (exakter Modifier).
 * - Transparenz / Schatten: alle Tokens.
 */
function tokenMatchesMode(
  token: string,
  mode: ControlPlatformViewsMode,
): boolean {
  if (mode === "skalierung") return isScalingControlViewToken(token);
  if (mode !== "korrektur") return true;
  const s = parseViewSlot(token);
  return (
    !s.hasTransparencyHint && !s.hasScalingHint && !s.hasShadowHint
  );
}

const MAIN_VIEW_SLUGS = new Set(["front", "rear", "right", "left"]);
const FIXED_VIEW_SLOT_LAYOUT = [
  /* Top-Down (gespiegelt): Spalte 1 = rechte Seite, Spalte 2 = vorne/hinten, Spalte 3 = linke Seite */
  { slotSlug: "front_right", col: 1, row: 1 },
  { slotSlug: "right", col: 1, row: 2 },
  { slotSlug: "rear_right", col: 1, row: 3 },
  { slotSlug: "front", col: 2, row: 1 },
  { slotSlug: "rear", col: 2, row: 3 },
  { slotSlug: "front_left", col: 3, row: 1 },
  { slotSlug: "left", col: 3, row: 2 },
  { slotSlug: "rear_left", col: 3, row: 3 },
] as const;
const FIXED_VIEW_SLOT_SET = new Set<string>(
  FIXED_VIEW_SLOT_LAYOUT.map((slot) => slot.slotSlug),
);

/** Reihenfolge der Thumbnails in der Lightbox (oben → unten). */
const LIGHTBOX_STRIP_VIEW_ORDER = [
  "front_left",
  "front",
  "front_right",
  "right",
  "rear_right",
  "rear",
  "rear_left",
  "left",
] as const;

function lightboxStripSortRank(slotSlug: string): number {
  const s = normalizeSlug(slotSlug);
  const idx = (LIGHTBOX_STRIP_VIEW_ORDER as readonly string[]).indexOf(s);
  return idx === -1 ? LIGHTBOX_STRIP_VIEW_ORDER.length : idx;
}

type ControllToolbarColor = "green" | "blue" | "orange" | "red";

type ControllToolbarDef = {
  configKey: string;
  label: string;
  stub: ControllActionStub;
  color: ControllToolbarColor;
  /** Anzeige-Hinweis Tastenkürzel, z. B. „1 / R“. */
  hint: string;
};

const TOOLBAR_BUTTON_CLASSES: Record<ControllToolbarColor, string> = {
  green:
    "border-emerald-500 bg-ink-800 text-white hover:bg-emerald-950/40 hover:border-emerald-400",
  blue: "border-sky-500 bg-ink-800 text-white hover:bg-sky-950/40 hover:border-sky-400",
  orange:
    "border-orange-500 bg-ink-800 text-white hover:bg-orange-950/40 hover:border-orange-400",
  red: "border-red-500 bg-ink-800 text-white hover:bg-red-950/50 hover:border-red-400",
};

const TOOLBAR_HINT_CLASSES: Record<ControllToolbarColor, string> = {
  green: "text-emerald-300/85",
  blue: "text-sky-300/85",
  orange: "text-orange-300/90",
  red: "text-red-300/85",
};

function controlPlatformToolbarDefs(
  viewsMode: ControlPlatformViewsMode,
): ControllToolbarDef[] {
  if (viewsMode === "skalierung") {
    return [
      {
        configKey: "correct",
        label: "Richtig",
        stub: "richtig",
        color: "green",
        hint: "1 / R",
      },
      {
        configKey: "regen_transparent",
        label: "Neu Transparent",
        stub: "regen_transparent",
        color: "blue",
        hint: "2 / T",
      },
      {
        configKey: "regen_scaling",
        label: "Neu Skalieren",
        stub: "regen_scaling",
        color: "orange",
        hint: "3 / S",
      },
      {
        configKey: "delete",
        label: "Löschen",
        stub: "loeschen",
        color: "red",
        hint: "4 / L / Del",
      },
    ];
  }
  return [
    {
      configKey: "correct",
      label: "Richtig",
      stub: "richtig",
      color: "green",
      hint: "1 / R",
    },
    {
      configKey: "regen_vertex",
      label: "Neu Generieren ( Vertex )",
      stub: "vertex",
      color: "blue",
      hint: "2 / V",
    },
    {
      configKey: "regen_batch",
      label: "Neu Generieren ( Batch )",
      stub: "batch",
      color: "orange",
      hint: "3 / B",
    },
    {
      configKey: "delete",
      label: "Löschen",
      stub: "loeschen",
      color: "red",
      hint: "4 / L / Del",
    },
  ];
}

/**
 * Tastatur-Bindings je Modus + `configKey` (in `controll_buttons`).
 * Wert = Liste akzeptierter `e.key`-Werte (case-insensitiv für Buchstaben);
 * Wird nur ausgewertet, wenn der Button aktuell sichtbar ist.
 */
function controlPlatformShortcutKeys(
  viewsMode: ControlPlatformViewsMode,
): Record<string, string[]> {
  if (viewsMode === "skalierung") {
    return {
      correct: ["1", "r"],
      regen_transparent: ["2", "t"],
      regen_scaling: ["3", "s"],
      delete: ["4", "l", "Delete", "Backspace"],
    };
  }
  return {
    correct: ["1", "r"],
    regen_vertex: ["2", "v"],
    regen_batch: ["3", "b"],
    delete: ["4", "l", "Delete", "Backspace"],
  };
}

function matchesShortcutKey(eventKey: string, list: string[]): boolean {
  if (list.includes(eventKey)) return true;
  const lower = eventKey.toLowerCase();
  return list.some((k) => k.length === 1 && k.toLowerCase() === lower);
}

type ViewGridEntry = {
  slotSlug: string;
  token: string | null;
  /** Nur Skalierung: zweites Token (#skaliert_weiß), wenn beides existiert. */
  tokenSecondary?: string | null;
  col: number;
  row: number;
  /**
   * Zusätzliche Ansichten (z. B. mehrere Kamerawinkel oder Duplikat-Slug):
   * 4. Spalte im Raster, keine `first_views`-Sperre — gleiches Status-/Toolbar-Verhalten wie Standard-Slots.
   */
  supplemental?: boolean;
};

/** Hauptansicht (front/rear/right/left, slug-Vergleich, case-insensitive). */
function isMainViewSlug(slug: string): boolean {
  return MAIN_VIEW_SLUGS.has(slug.trim().toLowerCase());
}

function normalizeSlug(x: string): string {
  return x.trim().toLowerCase();
}

/**
 * Feste Positions-Spalten 1–3 für das Standard‑Umrisslayout; zusätzliche
 * Ansichten (weitere Basis-Slots, Duplikate eines Slugs, Zusatzwinkel) in
 * **Spalte 4**, untereinander — Korrektur und Skalierung gleicher Ansatz.
 */
function buildViewGridEntries(
  tokens: string[],
  viewsMode: ControlPlatformViewsMode,
): ViewGridEntry[] {
  if (viewsMode === "skalierung") {
    const pairMap = new Map<
      string,
      { skaliert: string | null; weiss: string | null }
    >();
    for (const token of tokens) {
      if (!isScalingControlViewToken(token)) continue;
      const slot = parseViewSlot(token);
      const slug = normalizeSlug(slot.slug);
      const mod = token.slice(token.indexOf("#") + 1).trim().toLowerCase();
      let p = pairMap.get(slug);
      if (!p) {
        p = { skaliert: null, weiss: null };
        pairMap.set(slug, p);
      }
      if (mod === "skaliert") p.skaliert = token;
      else if (mod === "skaliert_weiß") p.weiss = token;
    }

    const fixed = FIXED_VIEW_SLOT_LAYOUT.map((slot) => {
      const p = pairMap.get(normalizeSlug(slot.slotSlug));
      const primary = p?.skaliert ?? p?.weiss ?? null;
      const secondary =
        p?.skaliert && p?.weiss ? p.weiss : null;
      return {
        slotSlug: slot.slotSlug,
        token: primary,
        tokenSecondary: secondary,
        col: slot.col,
        row: slot.row,
        supplemental: false,
      };
    });

    const fixedSlugSet = new Set(
      FIXED_VIEW_SLOT_LAYOUT.map((s) => normalizeSlug(s.slotSlug)),
    );
    const extraSlugs = [...pairMap.keys()]
      .filter((s) => !fixedSlugSet.has(s))
      .sort();
    const extras = extraSlugs.map((slug, idx) => {
      const p = pairMap.get(slug)!;
      const primary = p.skaliert ?? p.weiss ?? null;
      const secondary =
        p.skaliert && p.weiss ? p.weiss : null;
      return {
        slotSlug: slug,
        token: primary,
        tokenSecondary: secondary,
        col: 4,
        row: 1 + idx,
        supplemental: true,
      };
    });

    return [...fixed, ...extras];
  }

  const slotToToken = new Map<string, string>();
  /** Mehrere Basis-Tokens gleichen Standardslugs oder Zusatzwinkel → 4. Spalte */
  const extraTokens: string[] = [];

  for (const token of tokens) {
    const slug = normalizeSlug(viewPathSlug(token));
    if (FIXED_VIEW_SLOT_SET.has(slug) && !slotToToken.has(slug)) {
      slotToToken.set(slug, token);
    } else {
      extraTokens.push(token);
    }
  }

  const fixed = FIXED_VIEW_SLOT_LAYOUT.map((slot) => ({
    slotSlug: slot.slotSlug,
    token: slotToToken.get(slot.slotSlug) ?? null,
    col: slot.col,
    row: slot.row,
    supplemental: false,
  }));

  const extras = extraTokens.map((token, idx) => ({
    slotSlug: normalizeSlug(viewPathSlug(token)),
    token,
    col: 4,
    row: 1 + idx,
    supplemental: true,
  }));

  return [...fixed, ...extras];
}

/**
 * `controll_status` mit laufender Korrektur-Generierung (check 0/1) zählt in
 * der Liste mit (z. B. 9/8), bevor `views` das neue Bild enthält. Fehlt der
 * Slot sonst im Raster (kein Standard-Slot), erscheint hier ein Platzhalter
 * in Spalte 4 — dieselbe leere-Kachel-Logik wie bei den 8 Fix-Slots.
 */
function mergeKorrekturGeneratingPlaceholderEntries(
  entries: ViewGridEntry[],
  statuses: ControllStatusRow[] | undefined | null,
  viewsMode: ControlPlatformViewsMode,
  korrekturTokensFromViews: readonly string[],
): ViewGridEntry[] {
  if (viewsMode !== "korrektur" || !statuses?.length) return entries;

  const slugHasKorrekturImage = new Set(
    korrekturTokensFromViews.map((t) => normalizeSlug(viewPathSlug(t))),
  );
  const slugsWithGridCell = new Set(
    entries.map((e) => normalizeSlug(e.slotSlug)),
  );

  const pendingSlugs = new Set<string>();
  for (const s of statuses) {
    if ((s.mode ?? "").toLowerCase() !== "correction") continue;
    const ch = Number(s.check);
    if (ch !== 0 && ch !== 1) continue;
    const rawTok = (s.view_token ?? "").trim();
    if (rawTok.includes("#")) continue;
    const slug = normalizeSlug(parseViewSlot(s.view_token).slug);
    if (!slug) continue;
    if (slugHasKorrekturImage.has(slug)) continue;
    if (slugsWithGridCell.has(slug)) continue;
    pendingSlugs.add(slug);
  }
  if (pendingSlugs.size === 0) return entries;

  const sorted = [...pendingSlugs].sort();
  const base = [...entries];
  const toAdd: ViewGridEntry[] = [];
  for (const slug of sorted) {
    const pool = base.concat(toAdd);
    const col4Rows = pool.filter((e) => e.col === 4).map((e) => e.row);
    const nextRow = col4Rows.length ? Math.max(...col4Rows) + 1 : 1;
    toAdd.push({
      slotSlug: slug,
      token: null,
      col: 4,
      row: nextRow,
      supplemental: true,
    });
  }
  return [...base, ...toAdd];
}

/**
 * Jedes auf `true` gesetztes Slug in `settings.generation_views` soll eine
 * Kachel haben — nicht nur die 8 Umriss-Slots (`FIXED_VIEW_SLOT_LAYOUT`).
 * Z. B. `dashboard` liegt außerhalb des Umrisses und erhält ohne diese
 * Ergänzung gar keinen „+“-Platzhalter.
 */
function mergeGenerationViewsConfigSlots(
  entries: ViewGridEntry[],
  config: GenerationViewsConfig | null | undefined,
): ViewGridEntry[] {
  if (!config) return entries;

  const covered = new Set(
    entries.map((e) => normalizeSlug(e.slotSlug)),
  );
  const toAdd: ViewGridEntry[] = [];

  const extraSlugs = Object.entries(config)
    .filter(([, enabled]) => enabled === true)
    .map(([slug]) => normalizeSlug(slug))
    .filter((slug) => slug.length > 0 && !covered.has(slug))
    .sort((a, b) => a.localeCompare(b));

  for (const slug of extraSlugs) {
    covered.add(slug);
    const pool = [...entries, ...toAdd];
    const col4Rows = pool.filter((e) => e.col === 4).map((e) => e.row);
    const nextRow = col4Rows.length ? Math.max(...col4Rows) + 1 : 1;
    toAdd.push({
      slotSlug: slug,
      token: null,
      col: 4,
      row: nextRow,
      supplemental: true,
    });
  }

  return toAdd.length === 0 ? entries : [...entries, ...toAdd];
}

/** Modus-Mapping zwischen Frontend-Auswahl und `controll_status.mode`. */
function controllModeForViewsMode(
  m: ControlPlatformViewsMode,
): "correction" | "scaling" | "shadow" | "transparency" {
  if (m === "korrektur") return "correction";
  if (m === "skalierung") return "scaling";
  if (m === "schatten") return "shadow";
  return "transparency";
}

/** Lookup-Schlüssel für `controll_status` (case-insensitiv pro view_token). */
function statusKey(viewToken: string, mode: string): string {
  return `${viewToken.trim().toLowerCase()}::${mode.trim().toLowerCase()}`;
}

function buildStatusMap(
  statuses: ControllStatusRow[] | undefined,
): Map<string, ControllStatusRow> {
  const m = new Map<string, ControllStatusRow>();
  for (const s of statuses ?? []) {
    m.set(statusKey(s.view_token, s.mode), s);
  }
  return m;
}

/** UI-Flag-Satz wie im Lightbox-Strip / Raster (inkl. inside vs. Korrektur). */
type ControllStripVisualFlags = {
  hasStatus: boolean;
  checkVal: number | null;
  statusValue: string | null;
  isApproved: boolean;
  isInProgress: boolean;
  isCheckPending: boolean;
  isTransferred: boolean;
  isErrored: boolean;
  isLocked: boolean;
};

function emptyStripVisualFlags(): ControllStripVisualFlags {
  return {
    hasStatus: false,
    checkVal: null,
    statusValue: null,
    isApproved: false,
    isInProgress: false,
    isCheckPending: false,
    isTransferred: false,
    isErrored: false,
    isLocked: false,
  };
}

/** Priorität: `inside`-Zeile, sonst weiterhin Korrektur (z. B. Vertex-Job vor Freigabe). */
function korrekturStatusRowForToken(
  raw: string,
  insideViewsSet: Set<string>,
  statusMap: Map<string, ControllStatusRow>,
): ControllStatusRow | undefined {
  const slug = normalizeSlug(parseViewSlot(raw).slug);
  if (!insideViewsSet.has(slug)) {
    return statusMap.get(statusKey(raw, "correction"));
  }
  return (
    statusMap.get(statusKey(raw, "inside")) ??
    statusMap.get(statusKey(raw, "correction"))
  );
}

function resolveStatusRowForToken(
  viewsMode: ControlPlatformViewsMode,
  raw: string,
  insideViewsSet: Set<string>,
  statusMap: Map<string, ControllStatusRow>,
  controllMode: ReturnType<typeof controllModeForViewsMode>,
): ControllStatusRow | undefined {
  if (viewsMode === "korrektur") {
    return korrekturStatusRowForToken(raw, insideViewsSet, statusMap);
  }
  return statusMap.get(statusKey(raw, controllMode));
}

function resolveWriteControllMode(
  viewsMode: ControlPlatformViewsMode,
  rawToken: string,
  insideViewsSet: Set<string>,
): "correction" | "inside" | "scaling" | "shadow" | "transparency" {
  const base = controllModeForViewsMode(viewsMode);
  if (viewsMode !== "korrektur") return base;
  const slug = normalizeSlug(parseViewSlot(rawToken).slug);
  return insideViewsSet.has(slug) ? "inside" : "correction";
}

function controllStripFlagsFromRow(
  statusRow: ControllStatusRow | undefined,
  viewsMode: ControlPlatformViewsMode,
): ControllStripVisualFlags {
  if (!statusRow) return emptyStripVisualFlags();
  const rawCheck = Number(statusRow.check);
  const checkVal = Number.isFinite(rawCheck) ? rawCheck : null;
  const statusValueRaw = statusRow.status ?? null;
  const sv = (statusValueRaw ?? "").trim().toLowerCase();
  const md = (statusRow.mode ?? "").trim().toLowerCase();

  if (viewsMode === "skalierung") {
    const isTransferred =
      checkVal === 6 && md === "scaling" && sv === "correct";
    const isErrored =
      checkVal != null && checkVal >= 3 && !isTransferred;
    const isApproved = checkVal === 2;
    const isInProgress = checkVal === 1;
    const isCheckPending = checkVal === 0;
    return {
      hasStatus: true,
      checkVal,
      statusValue: statusValueRaw,
      isApproved,
      isInProgress,
      isCheckPending,
      isTransferred,
      isErrored,
      isLocked: !isApproved,
    };
  }

  const isApproved =
    md === "inside" ?
      checkVal === 0 && sv === "correct"
    : checkVal === 2 && sv === "correct";
  const isInProgress = checkVal === 1;
  const isCheckPending =
    checkVal === 0 && !(md === "inside" && sv === "correct");
  const isTransferred = false;
  const isErrored =
    checkVal != null && checkVal >= 3 && !isTransferred;

  return {
    hasStatus: true,
    checkVal,
    statusValue: statusValueRaw,
    isApproved,
    isInProgress,
    isCheckPending,
    isTransferred,
    isErrored,
    isLocked: !isApproved,
  };
}

/**
 * Korrektur-Eintrag zu einem Raster-Slot (`front`, `rear_left`, …),
 * unabhängig davon, ob `view_token` exakt dem Slug entspricht (Normalisierung
 * über `parseViewSlot().slug`).
 */
function findCorrectionStatusForSlotSlug(
  statuses: ControllStatusRow[] | undefined,
  slotSlug: string,
): ControllStatusRow | undefined {
  const n = normalizeSlug(slotSlug);
  for (const s of statuses ?? []) {
    if ((s.mode ?? "").toLowerCase() !== "correction") continue;
    if (normalizeSlug(parseViewSlot(s.view_token).slug) === n) return s;
  }
  return undefined;
}

function isCorrectionDoneRow(row: ControllStatusRow): boolean {
  return (
    Number(row.check) === 2 &&
    (row.status ?? "").trim().toLowerCase() === "correct"
  );
}

function isInsideDoneRow(row: ControllStatusRow): boolean {
  return (
    (row.mode ?? "").trim().toLowerCase() === "inside" &&
    Number(row.check) === 0 &&
    (row.status ?? "").trim().toLowerCase() === "correct"
  );
}

/**
 * Für Zusatz-Slots/Skalierung: Basis-Korrektur als `correction.done` oder
 * (Inside-Konfiguration) `inside.correct`/`check 0`.
 */
function isImageryCorrectionSlotApproved(
  statuses: ControllStatusRow[] | undefined,
  slotSlug: string,
): boolean {
  const n = normalizeSlug(slotSlug);
  for (const s of statuses ?? []) {
    const m = (s.mode ?? "").trim().toLowerCase();
    if (
      normalizeSlug(parseViewSlot(s.view_token).slug) !== n
    ) continue;
    if (m === "correction" && isCorrectionDoneRow(s)) return true;
    if (m === "inside" && isInsideDoneRow(s)) return true;
  }
  return false;
}

/**
 * Ob für den Slot bereits eine Korrektur-/Basis-Ansicht in `vehicle.views`
 * eingetragen ist (Token ohne #skaliert/#trp/#shadow), z. B. `front`.
 * Im Skalierungsmodus: dann kein „Generieren“-Plus — nur Platzhalter.
 */
function hasBaseKorrekturViewForSlot(
  views: string | null | undefined,
  slotSlug: string,
): boolean {
  const n = normalizeSlug(slotSlug);
  for (const t of parseViewTokens(views)) {
    if (!tokenMatchesMode(t, "korrektur")) continue;
    if (normalizeSlug(parseViewSlot(t).slug) === n) return true;
  }
  return false;
}

/**
 * Aggregierter „Schwerpunkt-Status" pro Fahrzeug (für Tag/Tint).
 * Reihenfolge der Priorität (von dominant zu schwach):
 *   1. `errored` – mind. ein `check >= 3` außer 6
 *   2. `transferred` – alle vorhandenen Statuses sind `check === 6`
 *   3. `done` – alle vorhandenen Statuses sind `check ∈ {2, 6}` (mind. 1 Status)
 *   4. `inProgress` – mind. ein `check === 1`
 *   5. `pending` – mind. ein `check === 0`
 *   6. `none` – keine Statuses
 */
type SidebarAggregatedStatus =
  | "errored"
  | "transferred"
  | "done"
  | "inProgress"
  | "pending"
  | "none";

type SidebarRowCounts = {
  done: number;
  errored: number;
  transferred: number;
  inProgress: number;
  pending: number;
  total: number;
};

function aggregateSidebarStatus(
  counts: SidebarRowCounts | null | undefined,
): SidebarAggregatedStatus {
  if (!counts || counts.total <= 0) return "none";
  if (counts.errored > 0) return "errored";
  if (counts.transferred === counts.total) return "transferred";
  if (counts.done + counts.transferred === counts.total) return "done";
  if (counts.inProgress > 0) return "inProgress";
  if (counts.pending > 0) return "pending";
  return "none";
}

const SIDEBAR_STATUS_STYLE: Record<
  SidebarAggregatedStatus,
  { tag: string; label: string; tint: string }
> = {
  errored: {
    tag: "bg-red-500",
    label: "errored",
    tint: "bg-red-50/60",
  },
  transferred: {
    tag: "bg-violet-500",
    label: "übertragen",
    tint: "bg-violet-50/60",
  },
  done: {
    tag: "bg-emerald-500",
    label: "done",
    tint: "bg-emerald-50/60",
  },
  inProgress: {
    tag: "bg-sky-500",
    label: "in Bearb.",
    tint: "bg-sky-50/60",
  },
  pending: {
    tag: "bg-zinc-400",
    label: "lock",
    tint: "bg-zinc-50/60",
  },
  none: {
    tag: "bg-transparent",
    label: "",
    tint: "",
  },
};

/** UI-Labels für Sort-Optionen. */
const SORT_LABELS: Record<ControllListSortOption, string> = {
  default: "zuletzt geändert",
  not_done_desc: "noch offen ↓",
  id_desc: "ID ↓",
  id_asc: "ID ↑",
  done_desc: "done (Anzahl) ↓",
  errored_desc: "errored (Anzahl) ↓",
  transferred_desc: "übertragen (Anzahl) ↓",
  inProgress_desc: "in Bearbeitung (Anzahl) ↓",
  pending_desc: "lock/pending (Anzahl) ↓",
  total_desc: "Status-Gesamt ↓",
};

/** UI-Labels für Status-Filter. */
const STATUS_FILTER_LABELS: Record<ControllListStatusFilter, string> = {
  open: "Offen",
  all: "Alle",
  done: "Komplett done",
};

const SORT_STORAGE_KEY = "controlPlatform.list.sort";
const FILTER_STORAGE_KEY = "controlPlatform.list.statusFilter";
const EASY_MODE_STORAGE_KEY = "controlPlatform.lightbox.easyMode";

function readEasyModeFromStorage(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const v = window.localStorage.getItem(EASY_MODE_STORAGE_KEY);
    if (v === "1" || v === "true") return true;
    if (v === "0" || v === "false") return false;
  } catch {
    /* noop */
  }
  return false;
}

function readSortFromStorage(): ControllListSortOption {
  // Default: nach "noch offen" absteigend, damit Fahrzeuge mit der
  // meisten zu erledigenden Arbeit oben stehen.
  const fallback: ControllListSortOption = "not_done_desc";
  if (typeof window === "undefined") return fallback;
  try {
    const v = window.localStorage.getItem(SORT_STORAGE_KEY);
    if (v && (CONTROLL_LIST_SORT_OPTIONS as readonly string[]).includes(v)) {
      return v as ControllListSortOption;
    }
  } catch {
    /* noop */
  }
  return fallback;
}

function readFilterFromStorage(): ControllListStatusFilter {
  // Default: "Offen" – Fokus auf alle Fahrzeuge, die im aktuellen Modus
  // noch Arbeit haben.
  const fallback: ControllListStatusFilter = "open";
  if (typeof window === "undefined") return fallback;
  try {
    const v = window.localStorage.getItem(FILTER_STORAGE_KEY);
    if (
      v &&
      (CONTROLL_LIST_STATUS_FILTERS as readonly string[]).includes(v)
    ) {
      return v as ControllListStatusFilter;
    }
    // Migration: alte Filter-Werte (any/not_done/errored/...) auf die
    // neue, vereinfachte Auswahl mappen.
    if (v) {
      const migrated: Record<string, ControllListStatusFilter> = {
        any: "all",
        not_done: "open",
        errored: "open",
        transferred: "done",
        done: "done",
        inProgress: "open",
        pending: "open",
        none: "all",
      };
      const m = migrated[v];
      if (m) return m;
    }
  } catch {
    /* noop */
  }
  return fallback;
}

export default function ControlPlatformPage() {
  const { viewsMode, liveEnabled, liveIntervalMs } =
    useControlPlatformViewsMode();
  const livePollMs = liveEnabled ? liveIntervalMs : 0;
  const [qIn, setQIn] = useState("");
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const [sort, setSort] = useState<ControllListSortOption>(() =>
    readSortFromStorage(),
  );
  const [statusFilter, setStatusFilter] = useState<ControllListStatusFilter>(
    () => readFilterFromStorage(),
  );
  // „Easy Mode" der Lightbox: beim Vehicle-Wechsel werden Fahrzeuge
  // übersprungen, in denen es im aktuellen Modus keine bearbeitbare
  // Ansicht mehr gibt (alle erwarteten Views haben bereits einen Status).
  const [easyMode, setEasyMode] = useState<boolean>(() =>
    readEasyModeFromStorage(),
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(SORT_STORAGE_KEY, sort);
    } catch {
      /* noop */
    }
  }, [sort]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        EASY_MODE_STORAGE_KEY,
        easyMode ? "1" : "0",
      );
    } catch {
      /* noop */
    }
  }, [easyMode]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(FILTER_STORAGE_KEY, statusFilter);
    } catch {
      /* noop */
    }
  }, [statusFilter]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [imagePreview, setImagePreview] = useState<{ index: number } | null>(
    null,
  );
  const activePreviewThumbRef = useRef<HTMLButtonElement | null>(null);
  const [submittingAction, setSubmittingAction] =
    useState<ControllActionStub | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [lastActionToken, setLastActionToken] = useState<{
    raw: string;
    status: string;
  } | null>(null);

  const [scalingStripFocus, setScalingStripFocus] = useState<
    "skaliert" | "weiss"
  >("skaliert");

  // Resizable Strip in der Lightbox: Breite in px, persistent in localStorage.
  const PREVIEW_STRIP_MIN_PX = 72;
  const PREVIEW_STRIP_MAX_PX = 640;
  const PREVIEW_STRIP_DEFAULT_PX = 144;
  const PREVIEW_STRIP_STORAGE_KEY = "controlPlatform.preview.stripWidthPx";
  const [previewStripWidth, setPreviewStripWidth] = useState<number>(() => {
    if (typeof window === "undefined") return PREVIEW_STRIP_DEFAULT_PX;
    try {
      const v = window.localStorage.getItem(PREVIEW_STRIP_STORAGE_KEY);
      const n = v == null ? NaN : Number(v);
      if (!Number.isFinite(n)) return PREVIEW_STRIP_DEFAULT_PX;
      return Math.min(
        PREVIEW_STRIP_MAX_PX,
        Math.max(PREVIEW_STRIP_MIN_PX, Math.round(n)),
      );
    } catch {
      return PREVIEW_STRIP_DEFAULT_PX;
    }
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        PREVIEW_STRIP_STORAGE_KEY,
        String(previewStripWidth),
      );
    } catch {
      /* noop */
    }
  }, [previewStripWidth]);
  const stripResizeStartRef = useRef<{
    startX: number;
    startWidth: number;
  } | null>(null);
  const handleStripResizePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      const target = e.currentTarget;
      target.setPointerCapture(e.pointerId);
      stripResizeStartRef.current = {
        startX: e.clientX,
        startWidth: previewStripWidth,
      };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [previewStripWidth],
  );
  const handleStripResizePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const start = stripResizeStartRef.current;
      if (!start) return;
      const dx = e.clientX - start.startX;
      const next = Math.min(
        PREVIEW_STRIP_MAX_PX,
        Math.max(PREVIEW_STRIP_MIN_PX, Math.round(start.startWidth + dx)),
      );
      setPreviewStripWidth(next);
    },
    [],
  );
  const handleStripResizePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      stripResizeStartRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    },
    [],
  );

  useEffect(() => {
    const t = setTimeout(() => setQ(qIn), 400);
    return () => clearTimeout(t);
  }, [qIn]);

  useEffect(() => {
    setOffset(0);
    setSelectedId(null);
  }, [q, viewsMode, sort, statusFilter]);

  // Beim Wechsel zwischen Fahrzeugen via Lightbox („nächstes/voriges Auto")
  // wird der Index im imagePreview erst gesetzt, wenn die neuen Strip-Items
  // geladen sind. Das Pending-Slot-Ref steuert, ob nach dem Vehicle-Switch
  // an den Anfang oder ans Ende der neuen Liste gesprungen werden soll.
  const pendingPreviewSlotRef = useRef<"first" | "last" | null>(null);

  /**
   * Cache-Buster pro `(vehicleId, view_token, mode)`. Wird inkrementiert,
   * sobald sich der zugehörige `controll_status` ändert oder ganz
   * verschwindet — das ist das Signal, dass der Worker im Hintergrund
   * ein neues Bild unter dem gleichen R2-Key abgelegt hat. Wir hängen
   * den Counter als zusätzlichen Query-Parameter an die Bild-URL, damit
   * der Browser-/CDN-Cache umgangen wird.
   */
  const [imageReloadByKey, setImageReloadByKey] = useState<
    Record<string, number>
  >({});
  /** Letzter gesehener Hash pro `(vehicleId, view_token, mode)`. */
  const lastStatusHashRef = useRef<Map<string, string>>(new Map());

  /**
   * Hängt einen `&_v=N`-Cache-Buster an eine Bild-URL an, falls für die
   * Kombination `(vehicleId, view_token, mode)` mindestens ein Reload-
   * Event registriert wurde. Der CDN-/Browser-Cache wird so frischen
   * Inhalt holen, ohne dass die Seite neu geladen werden muss.
   */
  const buildImageSrcWithReload = useCallback(
    (
      href: string,
      vehicleId: number,
      viewToken: string,
      mode: string,
    ): string => {
      const key = `${vehicleId}__${viewToken}__${mode}`;
      const tok = imageReloadByKey[key];
      if (!tok) return href;
      const sep = href.includes("?") ? "&" : "?";
      return `${href}${sep}_v=${tok}`;
    },
    [imageReloadByKey],
  );

  useEffect(() => {
    setActionError(null);
    setLastActionToken(null);
    // Lightbox NICHT schließen, wenn der Vehicle-Wechsel aus der Lightbox
    // selbst kommt – dann übernimmt der Effekt unten den Index-Switch.
    if (pendingPreviewSlotRef.current == null) {
      setImagePreview(null);
    }
  }, [selectedId]);

  const listUrl = useMemo(
    () =>
      vehicleImageryListUrl(
        {
          q,
          limit: PAGE_SIZE,
          offset,
          active: "1",
          views_mode: viewsMode,
          sort,
          status_filter: statusFilter,
        },
        VEHICLE_IMAGERY_CONTROLLING_API,
      ),
    [q, offset, viewsMode, sort, statusFilter],
  );
  const listApi = useApi<VehicleImageryListResponse>(listUrl, {
    pollMs: livePollMs,
  });

  const rows = listApi.data?.rows ?? [];
  const total = listApi.data?.total ?? 0;
  const limit = listApi.data?.limit ?? PAGE_SIZE;

  useEffect(() => {
    if (selectedId != null) return;
    const first = rows[0]?.id;
    if (first != null) setSelectedId(first);
  }, [rows, selectedId]);

  const detailUrl = useMemo(() => {
    if (selectedId == null || selectedId < 1) return null;
    return vehicleImageryOneUrl(selectedId, VEHICLE_IMAGERY_CONTROLLING_API);
  }, [selectedId]);
  const detailApi = useApi<VehicleImageryOneResponse>(detailUrl, {
    pollMs: livePollMs,
  });

  useEffect(() => {
    if (selectedId == null) return;
    const statuses = detailApi.data?.statuses ?? [];
    const seenKeys = new Set<string>();
    const changedKeys: string[] = [];
    const prefix = `${selectedId}__`;

    for (const s of statuses) {
      const key = `${selectedId}__${s.view_token}__${s.mode}`;
      seenKeys.add(key);
      const hash = `${s.updated_at ?? ""}__${s.status ?? ""}__${s.check ?? ""}`;
      const lastHash = lastStatusHashRef.current.get(key);
      // Nur bumpen, wenn wir den Status schon mal gesehen haben und er
      // sich seither verändert hat. Beim ersten Sehen merken wir nur.
      if (lastHash != null && lastHash !== hash) {
        changedKeys.push(key);
      }
      lastStatusHashRef.current.set(key, hash);
    }

    // Verschwundene Status-Einträge des aktuellen Fahrzeugs
    // (= Worker hat den Job abgeschlossen und Eintrag entfernt) ebenfalls
    // als „Bild neu" werten.
    for (const key of Array.from(lastStatusHashRef.current.keys())) {
      if (key.startsWith(prefix) && !seenKeys.has(key)) {
        changedKeys.push(key);
        lastStatusHashRef.current.delete(key);
      }
    }

    if (changedKeys.length > 0) {
      setImageReloadByKey((prev) => {
        const next = { ...prev };
        for (const k of changedKeys) {
          next[k] = (next[k] ?? 0) + 1;
        }
        return next;
      });
    }
  }, [selectedId, detailApi.data?.statuses]);

  const row = detailApi.data?.row;
  const cdnBase = (
    detailApi.data?.cdnBase ??
    listApi.data?.cdnBase ??
    VEHICLE_IMAGERY_CONTROLLING_CDN_FALLBACK
  ).replace(/\/$/, "");
  const imageUrlQuery =
    detailApi.data?.imageUrlQuery ?? listApi.data?.imageUrlQuery ?? "";

  const filteredViewTokens =
    row ?
      parseViewTokens(row.views).filter((t) => tokenMatchesMode(t, viewsMode))
    : [];

  const generationViewsApi = useApi<GenerationViewsApiResponse>(
    GENERATION_VIEWS_SETTINGS_PATH,
  );
  const generationViewsConfig = generationViewsApi.data?.views ?? null;

  const viewGridEntries = useMemo(() => {
    let base = buildViewGridEntries(filteredViewTokens, viewsMode);
    base = mergeGenerationViewsConfigSlots(base, generationViewsConfig);
    return mergeKorrekturGeneratingPlaceholderEntries(
      base,
      detailApi.data?.statuses,
      viewsMode,
      filteredViewTokens,
    );
  }, [
    filteredViewTokens,
    viewsMode,
    detailApi.data?.statuses,
    generationViewsConfig,
  ]);

  const gridHasSupplementalColumn = useMemo(
    () => viewGridEntries.some((e) => e.supplemental),
    [viewGridEntries],
  );

  const gridGalleryClassName =
    gridHasSupplementalColumn ?
      "grid grid-cols-[repeat(4,minmax(8rem,11rem))] gap-2 sm:grid-cols-[repeat(4,minmax(9rem,12rem))] lg:grid-cols-[repeat(4,minmax(10rem,13rem))]"
    : "grid grid-cols-[repeat(3,minmax(9rem,11rem))] gap-2 sm:grid-cols-[repeat(3,minmax(10rem,12rem))] lg:grid-cols-[repeat(3,minmax(12rem,14rem))]";

  const statusMap = useMemo(
    () => buildStatusMap(detailApi.data?.statuses),
    [detailApi.data?.statuses],
  );
  const controllMode = controllModeForViewsMode(viewsMode);

  const controllButtonsApi = useApi<ControllButtonsSettingsApiResponse>(
    CONTROLL_BUTTONS_SETTINGS_PATH,
  );

  // Preview-Overlay: lazy geladen (erst beim ersten Klick auf den Button),
  // dann pro Session in `previewImagesUrl` und damit im React-State gecacht.
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImagesUrl, setPreviewImagesUrl] = useState<string | null>(
    null,
  );
  const previewImagesApi = useApi<PreviewImagesSettingsApiResponse>(
    previewImagesUrl,
  );
  const previewImagesMap = previewImagesApi.data?.images ?? null;

  // `settings.google_image_search` einmalig laden (Template).
  const googleSearchApi = useApi<GoogleImageSearchApiResponse>(
    GOOGLE_IMAGE_SEARCH_SETTINGS_PATH,
  );
  const googleSearchTemplate = googleSearchApi.data?.template ?? "";

  // `settings.first_views` einmalig laden (Liste der Pflicht-Ansichten).
  const firstViewsApi = useApi<FirstViewsApiResponse>(
    FIRST_VIEWS_SETTINGS_PATH,
  );
  const firstViewsList = firstViewsApi.data?.views ?? null;
  const firstViewsSet = useMemo(
    () => makeFirstViewsSet(firstViewsList),
    [firstViewsList],
  );

  const insideViewsApi = useApi<InsideViewsApiResponse>(
    INSIDE_VIEWS_SETTINGS_PATH,
  );
  const insideViewsList = insideViewsApi.data?.views ?? null;
  const insideViewsSet = useMemo(
    () => makeInsideViewsSet(insideViewsList),
    [insideViewsList],
  );

  // Sind alle first_views-Pflicht-Slots erledigt? Bis dahin gilt für alle
  // **anderen** Slots: Großansicht erlaubt, Control-Buttons aus (Raster + Shortcuts).
  const firstViewsReady = useMemo(
    () => areFirstViewsReady(firstViewsSet, detailApi.data?.statuses),
    [firstViewsSet, detailApi.data?.statuses],
  );

  const [generationSubmittingSlot, setGenerationSubmittingSlot] = useState<
    string | null
  >(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  const controllButtonsResolved = useMemo(() => {
    if (controllButtonsApi.data?.buttons) {
      return { buttons: controllButtonsApi.data.buttons };
    }
    return DEFAULT_CONTROLL_BUTTONS_CONFIG;
  }, [controllButtonsApi.data]);

  const toolbarDefsVisible = useMemo(() => {
    const modeKey = CONTROL_PLATFORM_MODE_TO_SETTING[viewsMode];
    const flags =
      controllButtonsResolved.buttons[modeKey] ??
      DEFAULT_CONTROLL_BUTTONS_CONFIG.buttons[modeKey];
    return controlPlatformToolbarDefs(viewsMode).filter(
      (d) => flags[d.configKey] === true,
    );
  }, [controllButtonsResolved, viewsMode]);

  const shortcutsFooter = useMemo(() => {
    const parts = toolbarDefsVisible.map((d) =>
      d.hint.replace(/ \/ Del$/, ""),
    );
    return parts.length ? parts.join(" · ") : null;
  }, [toolbarDefsVisible]);

  const imagePreviewStripItems = useMemo(() => {
    if (!row) return [];
    type Row = {
      key: string;
      src: string;
      title: string;
      slotLabel: string;
      imageFileLabel: string;
      raw: string;
      hasStatus: boolean;
      isApproved: boolean;
      isLocked: boolean;
      isFirstViewsLocked: boolean;
      isCheckPending: boolean;
      isInProgress: boolean;
      isTransferred: boolean;
      isErrored: boolean;
      checkVal: number | null;
      statusValue: string | null;
      isMain: boolean;
      hasTransparencyHint: boolean;
      hasScalingHint: boolean;
      hasShadowHint: boolean;
      sortRank: number;
      sortIdx: number;
      rawSecondary: string | null;
      srcSecondary: string | null;
      imageFileLabelSecondary: string | null;
      hasStatusSecondary: boolean;
      isApprovedSecondary: boolean;
      isLockedSecondary: boolean;
      isCheckPendingSecondary: boolean;
      isInProgressSecondary: boolean;
      isTransferredSecondary: boolean;
      isErroredSecondary: boolean;
      checkValSecondary: number | null;
      statusValueSecondary: string | null;
    };

    const flagsFor = (raw: string) => {
      const resolvedRow = resolveStatusRowForToken(
        viewsMode,
        raw,
        insideViewsSet,
        statusMap,
        controllMode,
      );
      return controllStripFlagsFromRow(resolvedRow, viewsMode);
    };

    const internal: Row[] = [];
    for (let idx = 0; idx < viewGridEntries.length; idx++) {
      const entry = viewGridEntries[idx];
      if (!entry.token) continue;
      const primaryRaw = entry.token;
      const secRaw = entry.tokenSecondary ?? null;
      const slot = parseViewSlot(primaryRaw);
      const slugLabel = normalizeSlug(entry.slotSlug);

      const baseHrefP = buildVehicleImageUrl(
        cdnBase,
        row,
        primaryRaw,
        imageUrlQuery,
      );
      const srcP = buildImageSrcWithReload(
        baseHrefP,
        row.id,
        primaryRaw,
        controllMode,
      );
      const fp = flagsFor(primaryRaw);
      const secFlags = secRaw ? flagsFor(secRaw) : null;
      const srcS =
        secRaw ?
          buildImageSrcWithReload(
            buildVehicleImageUrl(cdnBase, row, secRaw, imageUrlQuery),
            row.id,
            secRaw,
            controllMode,
          )
        : null;

      const supplemental = entry.supplemental === true;
      const isFirstViewsLocked =
        !supplemental &&
        isSlotBlockedByFirstViews(
          firstViewsSet,
          firstViewsReady,
          slugLabel,
        );
      const isMain = isMainViewSlug(slugLabel);
      const imageFileLabel = viewTokenImageFileName(primaryRaw, row.format);

      internal.push({
        key: `${row.id}-pair-${slugLabel}-${idx}`,
        src: srcP,
        title:
          secRaw ?
            `${rowTitle(row)} · ${entry.slotSlug} (#skaliert + #skaliert_weiß)`
          : `${rowTitle(row)} · ${imageFileLabel}`,
        slotLabel: slugLabel,
        imageFileLabel,
        raw: primaryRaw,
        hasStatus: fp.hasStatus,
        isApproved: fp.isApproved,
        isLocked: fp.isLocked,
        isFirstViewsLocked,
        isCheckPending: fp.isCheckPending,
        isInProgress: fp.isInProgress,
        isTransferred: fp.isTransferred,
        isErrored: fp.isErrored,
        checkVal: fp.checkVal,
        statusValue: fp.statusValue,
        isMain,
        hasTransparencyHint: slot.hasTransparencyHint,
        hasScalingHint: slot.hasScalingHint,
        hasShadowHint: slot.hasShadowHint,
        sortRank: lightboxStripSortRank(entry.slotSlug),
        sortIdx: idx,
        rawSecondary: secRaw,
        srcSecondary: srcS,
        imageFileLabelSecondary:
          secRaw ? viewTokenImageFileName(secRaw, row.format) : null,
        hasStatusSecondary: secFlags?.hasStatus ?? false,
        isApprovedSecondary: secFlags?.isApproved ?? false,
        isLockedSecondary: secFlags?.isLocked ?? false,
        isCheckPendingSecondary: secFlags?.isCheckPending ?? false,
        isInProgressSecondary: secFlags?.isInProgress ?? false,
        isTransferredSecondary: secFlags?.isTransferred ?? false,
        isErroredSecondary: secFlags?.isErrored ?? false,
        checkValSecondary: secFlags?.checkVal ?? null,
        statusValueSecondary: secFlags?.statusValue ?? null,
      });
    }
    internal.sort((a, b) =>
      a.sortRank !== b.sortRank ? a.sortRank - b.sortRank : a.sortIdx - b.sortIdx,
    );
    return internal.map(({ sortRank: _r, sortIdx: _i, ...item }) => item);
  }, [
    row,
    viewGridEntries,
    cdnBase,
    imageUrlQuery,
    controllMode,
    statusMap,
    viewsMode,
    insideViewsSet,
    firstViewsSet,
    firstViewsReady,
    buildImageSrcWithReload,
  ]);

  /**
   * Wechselt im Lightbox-Modus zum nächsten/vorigen Fahrzeug der aktuellen
   * Liste (`rows`). Beim Wechsel wird das `imagePreview` so gesetzt, dass
   * direkt das erste (next) bzw. letzte (prev) Bild des neuen Fahrzeugs
   * im Großbild geöffnet wird, sobald dessen Strip-Items geladen sind.
   *
   * Im **Easy Mode** werden Fahrzeuge übersprungen, in denen alle
   * erwarteten Views bereits einen `controll_status`-Eintrag haben –
   * dort kann der Nutzer ohnehin keine Buttons mehr drücken.
   *
   * Funktioniert nur innerhalb der aktuellen Pagination-Seite; ist man
   * an einer Page-Grenze, wird kein Wechsel durchgeführt (Rückgabewert
   * `false`).
   */
  const navigateToSiblingVehicle = useCallback(
    (direction: "next" | "prev") => {
      if (rows.length === 0 || selectedId == null) return false;
      const idx = rows.findIndex((r) => r.id === selectedId);
      if (idx < 0) return false;
      const step = direction === "next" ? 1 : -1;
      let targetIdx = idx + step;
      while (targetIdx >= 0 && targetIdx < rows.length) {
        const candidate = rows[targetIdx];
        // Im Easy Mode überspringen, wenn alle erwarteten Views bereits
        // einen Status-Eintrag haben (= total >= n_expected).
        if (easyMode) {
          const nExp =
            viewsMode === "skalierung" ?
              countScalingViewPairsInViews(candidate.views)
            : parseViewTokens(candidate.views).filter((t) =>
                tokenMatchesMode(t, viewsMode),
              ).length;
          const total = candidate.controllStatusCounts?.total ?? 0;
          if (nExp > 0 && total >= nExp) {
            targetIdx += step;
            continue;
          }
        }
        pendingPreviewSlotRef.current =
          direction === "next" ? "first" : "last";
        setSelectedId(candidate.id);
        return true;
      }
      return false;
    },
    [rows, selectedId, easyMode, viewsMode],
  );

  // Pending-Slot auflösen, sobald die Strip-Items des neuen Fahrzeugs
  // bereitstehen. Schaltet danach das Ref zurück auf null.
  useEffect(() => {
    if (pendingPreviewSlotRef.current == null) return;
    if (imagePreviewStripItems.length === 0) return;
    const slot = pendingPreviewSlotRef.current;
    pendingPreviewSlotRef.current = null;
    setImagePreview({
      index: slot === "first" ? 0 : imagePreviewStripItems.length - 1,
    });
  }, [imagePreviewStripItems]);

  /** Schreibt eine Control-Aktion in `controll_status` und lädt die Statuses neu.
   * Springt nach Erfolg zur nächsten Ansicht, die noch bearbeitbar ist
   * (kein `controll_status`-Eintrag in `view_token + mode`). Wenn im
   * aktuellen Fahrzeug nichts mehr bearbeitbar ist, wird automatisch zum
   * nächsten Fahrzeug der Liste gesprungen.
   */
  const submitControllAction = useCallback(
    async (
      action: ControllActionStub,
      ctx: { rawToken: string; imageHref: string; index: number },
      origin: "shortcut" | "toolbar" = "toolbar",
    ) => {
      if (selectedId == null) return;
      const status = CONTROLL_ACTION_TO_STATUS[action];
      if (!status) return;
      const r2Key = r2KeyFromImageUrl(cdnBase, ctx.imageHref);
      setSubmittingAction(action);
      setActionError(null);
      try {
        const items = imagePreviewStripItems;
        const curItem = items[ctx.index];
        const pairRawSec = curItem?.rawSecondary ?? null;
        const pairSrcSec = curItem?.srcSecondary ?? null;
        const scalingPairRichtig =
          controllMode === "scaling" &&
          action === "richtig" &&
          curItem != null &&
          pairRawSec != null &&
          pairSrcSec != null;

        if (scalingPairRichtig) {
          const kPrimary = r2KeyFromImageUrl(cdnBase, curItem.src);
          const kSecondary = r2KeyFromImageUrl(cdnBase, pairSrcSec);
          await postControllStatus({
            vehicleId: selectedId,
            viewToken: curItem.raw,
            mode: controllMode,
            status,
            key: kPrimary,
          });
          const res = await postControllStatus({
            vehicleId: selectedId,
            viewToken: pairRawSec,
            mode: controllMode,
            status,
            key: kSecondary,
          });
          setLastActionToken({
            raw: res.row.view_token,
            status: res.row.status,
          });
        } else {
          const res = await postControllStatus({
            vehicleId: selectedId,
            viewToken: ctx.rawToken,
            mode: resolveWriteControllMode(
              viewsMode,
              ctx.rawToken,
              insideViewsSet,
            ),
            status,
            key: r2Key,
          });
          setLastActionToken({
            raw: res.row.view_token,
            status: res.row.status,
          });
        }

        const keyForAnalytics =
          scalingPairRichtig && curItem ?
            r2KeyFromImageUrl(cdnBase, curItem.src)
          : r2Key;

        postControllPlatformAnalyticsFireAndForget({
          actionLabel: `${origin}:${status}`,
          viewsModeLabel: CONTROL_PLATFORM_MODE_LABEL[viewsMode],
          imageKey: keyForAnalytics,
          metaJson: JSON.stringify({
            vehicleId: selectedId,
            viewToken: ctx.rawToken,
          }),
        });

        if (
          viewsMode === "skalierung" &&
          curItem?.rawSecondary &&
          ctx.rawToken === curItem.raw &&
          !scalingPairRichtig
        ) {
          setScalingStripFocus("weiss");
          detailApi.reload();
          return;
        }

        const pairStillEditable = (it: (typeof items)[number]) => {
          if (!it || it.isFirstViewsLocked) return false;
          if (!it.rawSecondary) return !it.hasStatus;
          return !it.hasStatus || !it.hasStatusSecondary;
        };

        const isEditable = (i: number) => {
          const it = items[i];
          if (!it || i === ctx.index || it.isFirstViewsLocked) return false;
          return pairStillEditable(it);
        };
        let nextIdx: number | null = null;
        for (let i = ctx.index + 1; i < items.length; i++) {
          if (isEditable(i)) {
            nextIdx = i;
            break;
          }
        }
        if (nextIdx == null) {
          for (let i = 0; i < ctx.index; i++) {
            if (isEditable(i)) {
              nextIdx = i;
              break;
            }
          }
        }
        if (nextIdx != null) {
          setImagePreview({ index: nextIdx });
        } else {
          // Im aktuellen Fahrzeug ist nichts mehr bearbeitbar →
          // direkt zum nächsten Fahrzeug der Liste springen.
          navigateToSiblingVehicle("next");
        }

        detailApi.reload();
      } catch (err) {
        setActionError(err instanceof Error ? err.message : String(err));
      } finally {
        setSubmittingAction(null);
      }
    },
    [
      selectedId,
      cdnBase,
      controllMode,
      detailApi,
      imagePreviewStripItems,
      navigateToSiblingVehicle,
      viewsMode,
      insideViewsSet,
    ],
  );

  /**
   * „+"-Button für fehlende Ansichten: schreibt einen `regen_vertex`-Job
   * mit `mode = "correction"` in die `controll_status`-Tabelle. Der `key`
   * wird aus der Ziel-URL (gleiche Pfad-Struktur wie die anderen Views
   * dieses Fahrzeugs, nur mit dem neuen Slug als Datei-Name) abgeleitet,
   * damit der Worker später weiß, in welche R2-Datei er das gerenderte
   * Bild ablegen soll.
   *
   * Es findet keine Auto-Navigation statt – der Button erzeugt nur den
   * Job und triggert ein detail/list-Reload.
   */
  const submitGenerationJob = useCallback(
    async (slotSlug: string, imageHref: string) => {
      if (selectedId == null) return;
      if (generationSubmittingSlot != null) return;
      const trimmed = slotSlug.trim().toLowerCase();
      if (!trimmed) return;
      const r2Key = r2KeyFromImageUrl(cdnBase, imageHref);
      setGenerationSubmittingSlot(trimmed);
      setGenerationError(null);
      try {
        await postControllStatus({
          vehicleId: selectedId,
          viewToken: trimmed,
          mode: "correction",
          status: "regen_vertex",
          key: r2Key,
        });
        detailApi.reload();
        listApi.reload();
      } catch (err) {
        setGenerationError(
          err instanceof Error ? err.message : String(err),
        );
      } finally {
        setGenerationSubmittingSlot(null);
      }
    },
    [selectedId, generationSubmittingSlot, cdnBase, detailApi, listApi],
  );

  useEffect(() => {
    if (!imagePreview || imagePreviewStripItems.length === 0) return;
    const n = imagePreviewStripItems.length;
    const modeKey = CONTROL_PLATFORM_MODE_TO_SETTING[viewsMode];
    const flags =
      controllButtonsResolved.buttons[modeKey] ??
      DEFAULT_CONTROLL_BUTTONS_CONFIG.buttons[modeKey];
    const shortcuts = controlPlatformShortcutKeys(viewsMode);
    const defs = controlPlatformToolbarDefs(viewsMode);

    const onKey = (e: KeyboardEvent) => {
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "Escape") {
        setImagePreview(null);
        return;
      }

      const curIdx = Math.min(
        Math.max(0, imagePreview.index),
        imagePreviewStripItems.length - 1,
      );
      const cur = imagePreviewStripItems[curIdx];
      let actRaw = cur?.raw ?? "";
      let actSrc = cur?.src ?? "";
      let actHasStatus = cur?.hasStatus ?? true;
      if (
        cur &&
        viewsMode === "skalierung" &&
        cur.rawSecondary &&
        cur.srcSecondary &&
        scalingStripFocus === "weiss"
      ) {
        actRaw = cur.rawSecondary;
        actSrc = cur.srcSecondary;
        actHasStatus = cur.hasStatusSecondary;
      }
      const curEditable =
        !!cur && !actHasStatus && !cur.isFirstViewsLocked;

      for (const def of defs) {
        if (flags[def.configKey] !== true) continue;
        const list = shortcuts[def.configKey];
        if (!list) continue;
        if (matchesShortcutKey(e.key, list)) {
          e.preventDefault();
          if (submittingAction) return;
          if (!cur || !curEditable) return;
          void submitControllAction(def.stub, {
            rawToken: actRaw,
            imageHref: actSrc,
            index: curIdx,
          }, "shortcut");
          return;
        }
      }

      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        if (curIdx >= n - 1) {
          // Am Ende der Strip-Liste → versuche, ins nächste Fahrzeug
          // zu springen. Klappt das nicht (z. B. letztes Fahrzeug auf
          // der Seite), bleibt der Index unverändert.
          navigateToSiblingVehicle("next");
          return;
        }
        setImagePreview((p) => {
          if (!p) return p;
          return { index: Math.min(p.index + 1, n - 1) };
        });
        return;
      }
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        if (curIdx <= 0) {
          // Am Anfang der Strip-Liste → ins vorige Fahrzeug,
          // dort an die letzte Ansicht.
          navigateToSiblingVehicle("prev");
          return;
        }
        setImagePreview((p) => {
          if (!p) return p;
          return { index: Math.max(p.index - 1, 0) };
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    imagePreview,
    imagePreviewStripItems,
    submitControllAction,
    navigateToSiblingVehicle,
    submittingAction,
    viewsMode,
    controllButtonsResolved,
    scalingStripFocus,
  ]);

  const previewIndexClamped =
    imagePreview && imagePreviewStripItems.length > 0 ?
      Math.min(
        Math.max(0, imagePreview.index),
        imagePreviewStripItems.length - 1,
      )
    : 0;
  const currentPreviewItem = imagePreviewStripItems[previewIndexClamped];

  const scalingActiveSide = useMemo(() => {
    const it = currentPreviewItem;
    if (!it) return null;
    if (
      viewsMode === "skalierung" &&
      it.rawSecondary &&
      it.srcSecondary &&
      scalingStripFocus === "weiss"
    ) {
      return {
        raw: it.rawSecondary,
        src: it.srcSecondary,
        hasStatus: it.hasStatusSecondary,
        imageFileLabel: it.imageFileLabelSecondary ?? "",
        checkVal: it.checkValSecondary,
        statusValue: it.statusValueSecondary,
        isErrored: it.isErroredSecondary,
        isTransferred: it.isTransferredSecondary,
        isApproved: it.isApprovedSecondary,
        isCheckPending: it.isCheckPendingSecondary,
        isInProgress: it.isInProgressSecondary,
      };
    }
    return {
      raw: it.raw,
      src: it.src,
      hasStatus: it.hasStatus,
      imageFileLabel: it.imageFileLabel,
      checkVal: it.checkVal,
      statusValue: it.statusValue,
      isErrored: it.isErrored,
      isTransferred: it.isTransferred,
      isApproved: it.isApproved,
      isCheckPending: it.isCheckPending,
      isInProgress: it.isInProgress,
    };
  }, [currentPreviewItem, viewsMode, scalingStripFocus]);

  useEffect(() => {
    setScalingStripFocus("skaliert");
  }, [imagePreview, selectedId, previewIndexClamped]);

  useEffect(() => {
    if (!imagePreview) return;
    activePreviewThumbRef.current?.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
  }, [imagePreview, previewIndexClamped]);

  const atEnd = offset + rows.length >= total;
  const pageLabel =
    total === 0 ?
      "0 / 0"
    : `${offset + 1}–${offset + rows.length} / ${fmtNumber(total)}`;

  const sidebarSelectedOnPage =
    selectedId != null && rows.some((r) => r.id === selectedId);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col border border-hair bg-white lg:flex-row">
      <aside
        className={`flex max-h-[48vh] w-full min-h-0 shrink-0 flex-col border-b border-hair lg:h-full lg:max-h-none lg:w-[240px] lg:border-b-0 lg:border-r lg:border-hair ${
          viewsMode === "skalierung" && imagePreview ? "hidden" : ""
        }`}
      >
        <div className="shrink-0 border-b border-hair px-1.5 py-1.5">
          <label className="sr-only" htmlFor="control-platform-search">
            Einträge filtern
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-ink-400" />
            <input
              id="control-platform-search"
              type="search"
              value={qIn}
              onChange={(e) => setQIn(e.target.value)}
              placeholder="Suche…"
              className="w-full border border-hair bg-paper py-1 pl-6 pr-1 text-[11.5px] text-ink-800 placeholder:text-ink-400 focus:border-ink-800 focus:outline-none focus:ring-0"
            />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <label
              className="sr-only"
              htmlFor="control-platform-list-sort"
            >
              Sortierung
            </label>
            <select
              id="control-platform-list-sort"
              aria-label="Sortierung"
              title="Sortierung"
              value={sort}
              onChange={(e) =>
                setSort(e.target.value as ControllListSortOption)
              }
              className="min-w-0 flex-1 border border-hair bg-paper py-0.5 pl-1.5 pr-5 text-[10.5px] text-ink-700 focus:border-ink-600 focus:outline-none"
            >
              {CONTROLL_LIST_SORT_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {SORT_LABELS[s]}
                </option>
              ))}
            </select>
            <label
              className="sr-only"
              htmlFor="control-platform-list-filter"
            >
              Filter
            </label>
            <select
              id="control-platform-list-filter"
              aria-label="Filter"
              title="Status-Filter"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value as ControllListStatusFilter,
                )
              }
              className={`min-w-0 flex-1 border py-0.5 pl-1.5 pr-5 text-[10.5px] focus:outline-none ${
                statusFilter === "open"
                  ? "border-hair bg-paper text-ink-700 focus:border-ink-600"
                  : "border-ink-700 bg-ink-50 text-ink-900 focus:border-ink-800"
              }`}
            >
              {CONTROLL_LIST_STATUS_FILTERS.map((f) => (
                <option key={f} value={f}>
                  {STATUS_FILTER_LABELS[f]}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <p className="text-[10px] tabular-nums text-ink-500">{pageLabel}</p>
            {listApi.loading && (
              <span className="text-[10px] text-ink-400">lädt…</span>
            )}
          </div>
          {listApi.error && (
            <p className="mt-1 text-[10px] text-accent-rose">{listApi.error}</p>
          )}
          <div className="mt-1 flex items-center gap-0.5">
            <button
              type="button"
              disabled={offset === 0 || listApi.loading}
              onClick={() => setOffset((o) => Math.max(0, o - limit))}
              className="inline-flex h-7 w-7 items-center justify-center border border-hair bg-paper text-ink-600 disabled:opacity-40"
              aria-label="Vorherige Seite"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              disabled={atEnd || listApi.loading}
              onClick={() => setOffset((o) => o + limit)}
              className="inline-flex h-7 w-7 items-center justify-center border border-hair bg-paper text-ink-600 disabled:opacity-40"
              aria-label="Nächste Seite"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain" role="listbox" aria-label="Einträge">
          {rows.map((r) => {
            const selected = sidebarSelectedOnPage && r.id === selectedId;
            const nViewsForMode =
              viewsMode === "skalierung" ?
                countScalingViewPairsInViews(r.views)
              : parseViewTokens(r.views).filter((t) =>
                  tokenMatchesMode(t, viewsMode),
                ).length;
            const rawCounts = r.controllStatusCounts;
            const counts: SidebarRowCounts = rawCounts
              ? {
                  done: Number(rawCounts.done) || 0,
                  errored: Number(rawCounts.errored) || 0,
                  transferred: Number(rawCounts.transferred) || 0,
                  inProgress: Number(rawCounts.inProgress) || 0,
                  pending: Number(rawCounts.pending) || 0,
                  total: Number(rawCounts.total) || 0,
                }
              : {
                  done: 0,
                  errored: 0,
                  transferred: 0,
                  inProgress: 0,
                  pending: 0,
                  total: 0,
                };
            const aggStatus = aggregateSidebarStatus(counts);
            const aggStyle = SIDEBAR_STATUS_STYLE[aggStatus];
            // Bar-Skala: bevorzugt erwartete Bilder im Modus,
            // ansonsten total der vorhandenen Statuses (falls > Erwartung).
            const barDenominator = Math.max(
              nViewsForMode,
              counts.total,
              1,
            );
            const sidebarCountTotal = Math.max(
              nViewsForMode,
              counts.total,
              1,
            );
            const segments: { className: string; n: number }[] = [
              { className: "bg-emerald-500", n: counts.done },
              { className: "bg-violet-500", n: counts.transferred },
              { className: "bg-red-500", n: counts.errored },
              { className: "bg-sky-500", n: counts.inProgress },
              { className: "bg-zinc-400", n: counts.pending },
            ];
            const tooltip = `${rowTitle(r)}
done ${counts.done} · errored ${counts.errored} · übertragen ${counts.transferred}
in Bearbeitung ${counts.inProgress} · lock ${counts.pending}
${counts.total} / ${sidebarCountTotal} im aktuellen Modus (erwartete Bilder laut views-Feld: ${nViewsForMode}${counts.total > nViewsForMode ? " · es läuft u. U. noch eine Generierung ohne Eintrag im views-Feld" : ""})`;
            return (
              <li key={r.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => setSelectedId(r.id)}
                  title={tooltip}
                  className={`relative flex w-full items-center gap-1 border-b border-hair py-2 pl-1.5 pr-1.5 text-left text-[12px] transition-colors hover:bg-ink-50/80 ${
                    selected ? "bg-ink-50" : aggStyle.tint
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium leading-tight text-ink-900">
                      {rowTitle(r)}
                    </span>
                    <span className="mt-0.5 block truncate font-mono text-[10px] leading-tight text-ink-500">
                      #{r.id} · {rowSubtitle(r)}
                    </span>
                    <span className="mt-1 flex items-center gap-1 text-[10px] text-ink-500">
                      <span className="tabular-nums">
                        {counts.total}/{sidebarCountTotal}
                      </span>
                      {aggStatus !== "none" ? (
                        <span
                          className={`inline-flex items-center rounded px-1 py-px font-mono text-[9px] font-semibold uppercase tracking-wide leading-none text-white ${aggStyle.tag}`}
                        >
                          {aggStyle.label}
                        </span>
                      ) : null}
                    </span>
                    <span
                      aria-hidden
                      className="mt-1 flex h-1.5 w-full overflow-hidden rounded-sm bg-ink-100"
                    >
                      {segments.map((seg, i) => {
                        if (seg.n <= 0) return null;
                        const pct = (seg.n / barDenominator) * 100;
                        return (
                          <span
                            key={i}
                            className={seg.className}
                            style={{ width: `${pct}%` }}
                          />
                        );
                      })}
                    </span>
                  </span>
                  <ChevronRight
                    className={`h-3.5 w-3.5 shrink-0 text-ink-400 ${
                      selected ? "text-ink-800" : ""
                    }`}
                  />
                </button>
              </li>
            );
          })}
          {!listApi.loading && rows.length === 0 && (
            <li className="px-1.5 py-6 text-center text-[11px] text-ink-500">
              Keine Einträge.
            </li>
          )}
        </ul>
      </aside>

      <section className="flex min-h-0 min-w-0 flex-1 flex-col lg:h-full">
        {detailApi.error && (
          <div className="border-b border-hair bg-accent-rose/5 px-2 py-1.5 text-[11.5px] text-accent-rose">
            {detailApi.error}
          </div>
        )}

        {row ?
          <>
            <div className="shrink-0 border-b border-hair px-2 py-1.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h1 className="font-display text-base font-semibold leading-tight tracking-tight text-ink-900">
                    {rowTitle(row)}
                  </h1>
                  <p className="mt-0.5 font-mono text-[10px] text-ink-500">
                    #{row.id} · {rowSubtitle(row)}
                  </p>
                  <p className="mt-1 text-[10px] text-ink-500">
                    Aktualisiert {fmtWhen(row.last_updated)}
                    {"genehmigt" in row && row.genehmigt !== undefined ? (
                      <>
                        <span className="mx-1 text-ink-300">·</span>
                        genehmigt{" "}
                        <span className="font-mono">
                          {row.genehmigt === 1 ? "ja" : "nein"}
                        </span>
                      </>
                    ) : null}
                  </p>
                </div>
                <Link
                  to={`/dashboard/databases/production/${row.id}`}
                  className="inline-flex shrink-0 items-center gap-0.5 text-[11px] text-brand-600 hover:underline"
                >
                  DB
                  <ExternalLink className="h-2.5 w-2.5" />
                </Link>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1.5 py-1.5">
              <h2 className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-ink-400">
                Ansichten ({filteredViewTokens.length})
              </h2>

              {generationError ?
                <div
                  role="alert"
                  className="mb-1.5 flex items-center gap-1.5 rounded border border-red-300 bg-red-50 px-2 py-1 text-[11px] text-red-700"
                >
                  <span className="font-mono text-[10px] uppercase tracking-wide">
                    Fehler
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {generationError}
                  </span>
                  <button
                    type="button"
                    onClick={() => setGenerationError(null)}
                    className="rounded px-1 text-[10px] text-red-700 hover:bg-red-100"
                    aria-label="Fehlermeldung schließen"
                  >
                    ×
                  </button>
                </div>
              : null}

              {filteredViewTokens.length === 0 ?
                <p className="text-[12px] text-ink-500">
                  {parseViewTokens(row.views).length === 0 ?
                    "Keine Ansichten in der Datenbank."
                  : "Keine Ansichten für diesen Modus."}
                </p>
              : <ul className={gridGalleryClassName}>
                  {viewGridEntries.map((entry, idx) => {
                    if (!entry.token) {
                      // „+"-Button: nur, wenn die Ansicht in
                      // settings.generation_views als true markiert ist.
                      // Korrektur-Modus: kein Plus, sobald ein passender
                      // Korrektur-Job (`correction`-Zeile) existiert (Vertex usw.).
                      // Skalierungs-Modus: Plus nur, wenn noch eine offene Basis-Korrektur
                      // aktiv ist — abgeschlossen bedeutet correction/check 2 + status
                      // „correct“, oder inside/check 0 + „correct“ (Slug in inside_views).
                      // Zusätzlich: Wenn die Basis-Ansicht schon in `row.views`
                      // steht (#skaliert fehlt nur), kein Generieren — nur Platzhalter.
                      const slug = entry.slotSlug;
                      const allowedForGen = isGenerationAllowedForSlug(
                        generationViewsConfig,
                        slug,
                      );
                      const existingGenStatus = findCorrectionStatusForSlotSlug(
                        detailApi.data?.statuses,
                        slug,
                      );
                      const correctionApproved =
                        isImageryCorrectionSlotApproved(
                          detailApi.data?.statuses,
                          slug,
                        );
                      const correctionDone =
                        existingGenStatus ?
                          isCorrectionDoneRow(existingGenStatus)
                        : false;
                      const genBlockedByCorrection =
                        existingGenStatus != null &&
                        (viewsMode !== "skalierung" ||
                          !correctionApproved);
                      const scalingBaseInViewsBlocksGen =
                        viewsMode === "skalierung" &&
                        hasBaseKorrekturViewForSlot(row.views, slug);
                      const isGenSubmitting =
                        generationSubmittingSlot === slug;
                      /** Wie Bild-Kacheln in Spalte 4: kein Pflichtreihenfolge-Gate für Zusatz-Slots */
                      const supplemental = entry.supplemental === true;
                      const slotBlocked =
                        !supplemental &&
                        isSlotBlockedByFirstViews(
                          firstViewsSet,
                          firstViewsReady,
                          slug,
                        );
                      const showPlus =
                        allowedForGen &&
                        !genBlockedByCorrection &&
                        !slotBlocked &&
                        !scalingBaseInViewsBlocksGen;
                      const showInProgress =
                        !!existingGenStatus &&
                        !correctionDone &&
                        !scalingBaseInViewsBlocksGen;
                      const showLockedHint =
                        allowedForGen &&
                        !existingGenStatus &&
                        slotBlocked;
                      return (
                        <li
                          key={`${row.id}-slot-${entry.slotSlug}-${idx}`}
                          style={{
                            gridColumn: entry.col,
                            gridRow: entry.row,
                          }}
                        >
                          <article className="flex w-full flex-col border border-dashed border-hair bg-paper/50">
                            <div
                              className={`relative flex aspect-[3/2] items-center justify-center overflow-hidden ${
                                viewsMode === "skalierung" ?
                                  ""
                                : "bg-ink-50/40"
                              }`}
                              style={
                                viewsMode === "skalierung" ?
                                  SCALING_MODE_VEHICLE_BACKDROP_STYLE
                                : undefined
                              }
                            >
                              <span className="pointer-events-none absolute left-1 top-1 z-10 max-w-[calc(100%-0.5rem)] truncate font-mono text-[9px] text-ink-400">
                                {entry.slotSlug}
                              </span>
                              {showPlus ?
                                <button
                                  type="button"
                                  onClick={() => {
                                    // Ziel-URL nach gleichem Schema wie
                                    // existierende Views des Fahrzeugs
                                    // erzeugen, sodass `r2KeyFromImageUrl`
                                    // den passenden R2-Pfad liefern kann.
                                    const targetHref = buildVehicleImageUrl(
                                      cdnBase,
                                      row,
                                      slug,
                                      imageUrlQuery,
                                    );
                                    void submitGenerationJob(
                                      slug,
                                      targetHref,
                                    );
                                  }}
                                  disabled={
                                    generationSubmittingSlot != null
                                  }
                                  title={`Generierung anstoßen (regen_vertex · ${slug})`}
                                  aria-label={`Generierung für ${slug} anstoßen`}
                                  className="group flex h-full w-full items-center justify-center bg-emerald-50/40 transition hover:bg-emerald-100/70 focus:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500 disabled:cursor-progress disabled:opacity-60"
                                >
                                  {isGenSubmitting ?
                                    <Loader2 className="h-7 w-7 animate-spin text-emerald-600" />
                                  : <Plus
                                      className="h-9 w-9 text-emerald-500 transition group-hover:scale-110 group-hover:text-emerald-600"
                                      strokeWidth={2.25}
                                    />
                                  }
                                </button>
                              : showInProgress ?
                                <div className="flex flex-col items-center gap-1 text-ink-400">
                                  <Loader2 className="h-6 w-6 animate-spin text-sky-500" />
                                  <span className="font-mono text-[8px] uppercase tracking-wide">
                                    in Bearbeitung
                                  </span>
                                </div>
                              : showLockedHint ?
                                <div className="flex flex-col items-center gap-1 text-zinc-500">
                                  <Lock className="h-5 w-5" />
                                  <span className="font-mono text-[8px] uppercase tracking-wide">
                                    gesperrt
                                  </span>
                                </div>
                              : <ImageIcon className="h-8 w-8 text-ink-200/80" />
                              }
                            </div>
                            <div className="flex min-h-[2rem] items-center gap-1 border-t border-hair px-1 py-0.5">
                              <span className="min-w-0 flex-1 truncate font-mono text-[9px] leading-tight text-ink-400">
                                {showPlus ?
                                  isGenSubmitting ? "wird gesendet…"
                                  : "Generierung anstoßen"
                                : showInProgress ?
                                  `Generierung · ${(existingGenStatus?.status ?? "regen_vertex").slice(0, 28)}`
                                : showLockedHint
                                  ? "wartet auf Pflicht-Ansichten"
                                : scalingBaseInViewsBlocksGen
                                  ? "Basis vorhanden · kein #skaliert"
                                : "—"}
                              </span>
                            </div>
                          </article>
                        </li>
                      );
                    }

                    const token = entry.token;
                    const slot = parseViewSlot(token);
                    const secTok = entry.tokenSecondary ?? null;
                    const baseHref = buildVehicleImageUrl(
                      cdnBase,
                      row,
                      slot.raw,
                      imageUrlQuery,
                    );
                    const href = buildImageSrcWithReload(
                      baseHref,
                      row.id,
                      slot.raw,
                      controllMode,
                    );
                    const resolvedRowP = resolveStatusRowForToken(
                      viewsMode,
                      slot.raw,
                      insideViewsSet,
                      statusMap,
                      controllMode,
                    );
                    const fp = controllStripFlagsFromRow(
                      resolvedRowP,
                      viewsMode,
                    );

                    const resolvedRowS =
                      secTok ?
                        resolveStatusRowForToken(
                          viewsMode,
                          secTok,
                          insideViewsSet,
                          statusMap,
                          controllMode,
                        )
                      : undefined;
                    const fs = secTok
                      ? controllStripFlagsFromRow(
                          resolvedRowS,
                          viewsMode,
                        )
                      : null;

                    const isApprovedP = fp.isApproved;
                    const isInProgressP = fp.isInProgress;
                    const isCheckPendingP = fp.isCheckPending;
                    const isTransferredP = fp.isTransferred;
                    const isErroredP = fp.isErrored;

                    const isApprovedS = fs?.isApproved ?? false;
                    const isInProgressS = fs?.isInProgress ?? false;
                    const isCheckPendingS = fs?.isCheckPending ?? false;
                    const isTransferredS = fs?.isTransferred ?? false;
                    const isErroredS = fs?.isErrored ?? false;

                    const isApproved =
                      isApprovedP && (!secTok || isApprovedS);
                    const isInProgress = isInProgressP || isInProgressS;
                    const isCheckPending = isCheckPendingP || isCheckPendingS;
                    const isTransferred =
                      isTransferredP && (!secTok || isTransferredS);
                    const isErrored = isErroredP || isErroredS;

                    const supplemental = entry.supplemental === true;
                    const isFirstViewsLocked =
                      !supplemental &&
                      isSlotBlockedByFirstViews(
                        firstViewsSet,
                        firstViewsReady,
                        normalizeSlug(entry.slotSlug),
                      );
                    const imageFileLabel = viewTokenImageFileName(
                      slot.raw,
                      row.format,
                    );
                    const hrefS =
                      secTok ?
                        buildImageSrcWithReload(
                          buildVehicleImageUrl(
                            cdnBase,
                            row,
                            secTok,
                            imageUrlQuery,
                          ),
                          row.id,
                          secTok,
                          controllMode,
                        )
                      : null;
                    const imageFileLabelS =
                      secTok ?
                        viewTokenImageFileName(secTok, row.format)
                      : null;
                    const pairStripIndex = imagePreviewStripItems.findIndex(
                      (it) =>
                        it.raw === slot.raw &&
                        (secTok ?
                          it.rawSecondary === secTok
                        : (it.rawSecondary == null || it.rawSecondary === "")),
                    );
                    return (
                      <li
                        key={`${row.id}-${idx}-${entry.slotSlug}-${slot.raw}${secTok ? `-${secTok}` : ""}`}
                        style={{
                          gridColumn: entry.col,
                          gridRow: entry.row,
                        }}
                      >
                        <article
                          title={
                            isFirstViewsLocked ?
                              `${slot.raw}${secTok ? ` · ${secTok}` : ""} · Großansicht möglich · Steuerung bis Pflicht-Ansichten gesperrt`
                            : `${slot.raw}${secTok ? ` · ${secTok}` : ""}`
                          }
                          className={`flex w-full flex-col bg-paper transition-colors ${
                            isFirstViewsLocked
                              ? "border border-dashed border-zinc-300 opacity-60"
                              : isErrored
                              ? "border-2 border-red-400"
                              : isTransferred
                              ? "border-2 border-violet-400"
                              : isApproved
                              ? "border-2 border-accent-mint"
                              : isInProgress
                              ? "border border-sky-300"
                              : isCheckPending
                              ? "border border-zinc-400"
                              : "border border-hair"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setImagePreview({
                                index:
                                  pairStripIndex >= 0 ? pairStripIndex : 0,
                              });
                            }}
                            aria-label={
                              isFirstViewsLocked
                                ? `${entry.slotSlug} groß anzeigen (nur Ansehen – zuerst Pflicht-Ansichten aus first_views)`
                                : secTok ?
                                  `${entry.slotSlug}: #skaliert + #skaliert_weiß groß anzeigen`
                                : `${imageFileLabel} groß anzeigen`
                            }
                            className={`group relative flex aspect-[3/2] w-full overflow-hidden outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ink-800 ${
                              hrefS ?
                                "flex-row divide-x divide-ink-300/40"
                              : "items-center justify-center"
                            } ${
                              viewsMode === "skalierung" ? "" : "bg-ink-50"
                            } cursor-zoom-in`}
                            style={
                              viewsMode === "skalierung" ?
                                SCALING_MODE_VEHICLE_BACKDROP_STYLE
                              : undefined
                            }
                          >
                            {hrefS ?
                              <>
                                <div className="relative flex min-h-0 min-w-0 flex-1 items-center justify-center">
                                  <img
                                    src={href}
                                    alt={imageFileLabel}
                                    loading="lazy"
                                    decoding="async"
                                    className={`max-h-full max-w-full object-contain ${
                                      isApprovedP
                                        ? "opacity-30 grayscale"
                                        : ""
                                    }`}
                                    onError={(ev) => {
                                      ev.currentTarget.classList.add(
                                        "hidden",
                                      );
                                    }}
                                  />
                                  <span className="pointer-events-none absolute bottom-0.5 left-0.5 max-w-[calc(100%-0.25rem)] truncate font-mono text-[7px] text-ink-600">
                                    #skaliert
                                  </span>
                                </div>
                                <div className="relative flex min-h-0 min-w-0 flex-1 items-center justify-center">
                                  <img
                                    src={hrefS}
                                    alt={imageFileLabelS ?? ""}
                                    loading="lazy"
                                    decoding="async"
                                    className={`max-h-full max-w-full object-contain ${
                                      isApprovedS
                                        ? "opacity-30 grayscale"
                                        : ""
                                    }`}
                                    onError={(ev) => {
                                      ev.currentTarget.classList.add(
                                        "hidden",
                                      );
                                    }}
                                  />
                                  <span className="pointer-events-none absolute bottom-0.5 left-0.5 max-w-[calc(100%-0.25rem)] truncate font-mono text-[7px] text-ink-600">
                                    #skaliert_weiß
                                  </span>
                                </div>
                              </>
                            : <>
                                <img
                                  src={href}
                                  alt={imageFileLabel}
                                  loading="lazy"
                                  decoding="async"
                                  className={`max-h-full max-w-full object-contain ${
                                    isApproved
                                      ? "opacity-30 grayscale"
                                      : ""
                                  }`}
                                  onError={(ev) => {
                                    ev.currentTarget.classList.add("hidden");
                                    const ph =
                                      ev.currentTarget.nextElementSibling;
                                    if (ph instanceof HTMLElement) {
                                      ph.classList.remove("hidden");
                                    }
                                  }}
                                />
                                <div className="hidden grid place-items-center px-1">
                                  <ImageIcon className="h-8 w-8 text-ink-200" />
                                </div>
                              </>
                            }
                            {isFirstViewsLocked ?
                              <span className="pointer-events-none absolute left-1 top-8 z-[1] max-w-[calc(100%-0.5rem)] truncate rounded bg-amber-600/95 px-1 py-0.5 font-mono text-[7px] font-semibold uppercase tracking-wide text-white shadow sm:text-[8px]">
                                <Lock className="relative -top-px mr-px inline h-2.5 w-2.5" />
                                nur Ansehen
                              </span>
                            : null}
                            {!hrefS ?
                              <>
                                <span className="pointer-events-none absolute left-1 top-1 max-w-[calc(100%-0.5rem)] truncate font-mono text-[9px] text-ink-600">
                                  {imageFileLabel}
                                </span>
                                <span className="pointer-events-none absolute right-1 top-1 flex max-w-[60%] flex-wrap justify-end gap-0.5">
                                  {isErrored ?
                                    <span className="rounded bg-red-600/95 px-1 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-wide text-white">
                                      errored
                                    </span>
                                  : null}
                                  {isTransferred ?
                                    <span className="rounded bg-violet-600/95 px-1 py-0.5 font-mono text-[8px] font-semibold tracking-wide text-white">
                                      übertragen
                                    </span>
                                  : null}
                                  {isApproved ?
                                    <span className="inline-flex items-center gap-0.5 rounded bg-accent-mint px-1 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-wide text-white">
                                      <Check className="h-2.5 w-2.5" />
                                      done
                                    </span>
                                  : null}
                                  {isInProgress ?
                                    <span className="rounded bg-sky-600/95 px-1 py-0.5 font-mono text-[8px] font-semibold tracking-wide text-white">
                                      in Bearbeitung
                                    </span>
                                  : null}
                                  {isCheckPending ?
                                    <span className="inline-flex items-center gap-0.5 rounded bg-ink-800/90 px-1 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-wide text-white">
                                      <Lock className="h-2.5 w-2.5" />
                                      lock
                                    </span>
                                  : null}
                                  {slot.hasTransparencyHint ?
                                    <span className="rounded bg-ink-800/90 px-1 py-0.5 font-mono text-[8px] font-medium uppercase text-white">
                                      trp
                                    </span>
                                  : null}
                                  {slot.hasScalingHint ?
                                    <span className="rounded bg-brand-600/95 px-1 py-0.5 font-mono text-[8px] font-medium text-white">
                                      sk
                                    </span>
                                  : null}
                                  {slot.hasShadowHint ?
                                    <span className="rounded bg-ink-500/95 px-1 py-0.5 font-mono text-[8px] font-medium text-white">
                                      sh
                                    </span>
                                  : null}
                                </span>
                              </>
                            : null}
                          </button>
                          <div className="flex min-h-[2rem] items-center gap-1 border-t border-hair px-1 py-0.5">
                            <span className="min-w-0 flex-1 truncate font-mono text-[9px] leading-tight text-ink-500">
                              {hrefS && imageFileLabelS ?
                                `${imageFileLabel} · ${imageFileLabelS}`
                              : imageFileLabel}
                            </span>
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 text-ink-400 transition hover:text-ink-700"
                              aria-label="Bild #skaliert in neuem Tab"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                            {hrefS ?
                              <a
                                href={hrefS}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="shrink-0 text-ink-400 transition hover:text-ink-700"
                                aria-label="Bild #skaliert_weiß in neuem Tab"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            : null}
                          </div>
                        </article>
                      </li>
                    );
                  })}
                </ul>
              }
            </div>
          </>
        : <div className="grid flex-1 place-items-center px-2 py-8 text-center text-[12px] text-ink-500">
            {detailApi.loading || listApi.loading ?
              "Laden…"
            : selectedId ?
              "Eintrag nicht gefunden."
            : "Keine Einträge."}
          </div>
        }
      </section>

      {imagePreview && currentPreviewItem ?
        <div
          className="fixed inset-0 z-[90] flex items-stretch justify-stretch bg-black"
          role="presentation"
        >
          <button
            type="button"
            className="absolute inset-0 z-0 cursor-default"
            aria-label="Schließen"
            onClick={() => setImagePreview(null)}
          />
          <div
            className="relative z-10 flex h-full w-full flex-col gap-1.5 bg-ink-950 p-2 shadow-2xl sm:gap-2 sm:p-3"
            role="dialog"
            aria-modal="true"
            aria-labelledby="control-platform-preview-title"
          >
            <div className="flex shrink-0 items-start justify-between gap-2">
              <p
                id="control-platform-preview-title"
                className="min-w-0 flex-1 truncate text-left font-mono text-[11px] text-white sm:text-[12px]"
              >
                {currentPreviewItem.title}
              </p>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    if (!previewImagesUrl) {
                      setPreviewImagesUrl(PREVIEW_IMAGES_SETTINGS_PATH);
                    }
                    setPreviewVisible((v) => !v);
                  }}
                  aria-pressed={previewVisible}
                  title={
                    previewVisible
                      ? "Preview-Overlay ausblenden"
                      : "Preview-Overlay einblenden"
                  }
                  className={`inline-flex items-center gap-0.5 rounded border px-2 py-1 text-[11px] transition ${
                    previewVisible
                      ? "border-emerald-500 bg-emerald-700 text-white hover:bg-emerald-600"
                      : "border-ink-600 bg-ink-800 text-white hover:bg-ink-700"
                  }`}
                >
                  {previewVisible ?
                    <EyeOff className="h-3 w-3" />
                  : <Eye className="h-3 w-3" />}
                  Preview
                </button>
                <button
                  type="button"
                  onClick={() => setEasyMode((v) => !v)}
                  aria-pressed={easyMode}
                  title={
                    easyMode
                      ? "Easy Mode aus: Fahrzeuge ohne offene Aktionen werden NICHT mehr übersprungen"
                      : "Easy Mode an: Fahrzeuge ohne offene Aktionen werden beim Wechsel übersprungen"
                  }
                  className={`inline-flex items-center gap-0.5 rounded border px-2 py-1 text-[11px] transition ${
                    easyMode
                      ? "border-amber-400 bg-amber-600 text-white hover:bg-amber-500"
                      : "border-ink-600 bg-ink-800 text-white hover:bg-ink-700"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`inline-block h-1.5 w-1.5 rounded-full ${
                      easyMode ? "bg-white" : "bg-ink-400"
                    }`}
                  />
                  Easy Mode
                </button>
                {(() => {
                  const q = buildGoogleImageSearchQuery(googleSearchTemplate, {
                    marke: row?.marke,
                    modell: row?.modell,
                    jahr: row?.jahr,
                    body: row?.body,
                    trim: row?.trim,
                    farbe: row?.farbe,
                    ansicht: scalingActiveSide?.raw ?? currentPreviewItem.raw,
                  });
                  const disabled = !q;
                  const href = q ? googleImageSearchUrl(q) : undefined;
                  const className = `inline-flex items-center gap-0.5 rounded border px-2 py-1 text-[11px] transition ${
                    disabled
                      ? "cursor-not-allowed border-ink-700 bg-ink-900 text-ink-500"
                      : "border-ink-600 bg-ink-800 text-white hover:bg-ink-700"
                  }`;
                  if (disabled) {
                    return (
                      <button
                        type="button"
                        disabled
                        className={className}
                        title={
                          googleSearchTemplate
                            ? "Suchanfrage konnte nicht erzeugt werden (fehlende Felder)"
                            : "Kein Google-Image-Search-Template hinterlegt"
                        }
                      >
                        <Search className="h-3 w-3" />
                        Google
                      </button>
                    );
                  }
                  return (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={className}
                      title={`Google Bilder: „${q}"`}
                    >
                      <Search className="h-3 w-3" />
                      Google
                    </a>
                  );
                })()}
                <a
                  href={scalingActiveSide?.src ?? currentPreviewItem.src}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 rounded border border-ink-600 bg-ink-800 px-2 py-1 text-[11px] text-white transition hover:bg-ink-700"
                >
                  <ExternalLink className="h-3 w-3" />
                  Neuer Tab
                </a>
                <button
                  type="button"
                  onClick={() => setImagePreview(null)}
                  className="rounded border border-ink-600 bg-ink-800 p-1.5 text-white transition hover:bg-ink-700"
                  aria-label="Schließen"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-row gap-1.5 overflow-hidden sm:gap-2">
              <aside
                className="flex shrink-0 flex-col gap-1 overflow-hidden"
                style={{ width: `${previewStripWidth}px` }}
              >
                <p className="shrink-0 text-[8px] font-medium uppercase leading-tight tracking-[0.12em] text-zinc-400 sm:text-[9px]">
                  Ansichten ({imagePreviewStripItems.length})
                </p>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded border border-ink-600 bg-ink-900 p-1">
                  <ul
                    className="flex flex-col gap-1"
                    role="listbox"
                    aria-label="Ansicht wählen"
                  >
                    {imagePreviewStripItems.map((it, i) => {
                      const selected = i === previewIndexClamped;
                      return (
                        <li key={it.key} className="shrink-0">
                          <button
                            type="button"
                            role="option"
                            aria-selected={selected}
                            ref={selected ? activePreviewThumbRef : undefined}
                            onClick={() => setImagePreview({ index: i })}
                            title={it.title}
                            className={`flex w-full flex-col gap-0.5 rounded border p-1 text-left transition ${
                              selected ?
                                "border-white bg-ink-800"
                              : "border-ink-700 bg-ink-950 hover:border-ink-500 hover:bg-ink-900"
                            }`}
                          >
                            <span
                              className={`relative flex aspect-[3/2] w-full overflow-hidden rounded ${
                                it.srcSecondary ?
                                  "flex-row divide-x divide-zinc-600/60"
                                : "items-center justify-center"
                              } ${
                                viewsMode === "skalierung" ? "" : "bg-zinc-100"
                              }`}
                              style={
                                viewsMode === "skalierung" ?
                                  SCALING_MODE_VEHICLE_BACKDROP_STYLE
                                : undefined
                              }
                            >
                              {it.srcSecondary ?
                                <>
                                  <div className="relative flex min-h-0 min-w-0 flex-1 items-center justify-center">
                                    <img
                                      src={it.src}
                                      alt=""
                                      className={`max-h-full max-w-full object-contain ${
                                        it.isApproved
                                          ? "opacity-35 grayscale"
                                          : ""
                                      }`}
                                    />
                                  </div>
                                  <div className="relative flex min-h-0 min-w-0 flex-1 items-center justify-center">
                                    <img
                                      src={it.srcSecondary}
                                      alt=""
                                      className={`max-h-full max-w-full object-contain ${
                                        it.isApprovedSecondary
                                          ? "opacity-35 grayscale"
                                          : ""
                                      }`}
                                    />
                                  </div>
                                </>
                              : <>
                                  <img
                                    src={it.src}
                                    alt=""
                                    className={`max-h-full max-w-full object-contain ${
                                      it.isApproved
                                        ? "opacity-35 grayscale"
                                        : ""
                                    }`}
                                  />
                                  {it.isErrored ?
                                    <span className="pointer-events-none absolute right-0.5 top-0.5 rounded bg-red-600/95 px-0.5 py-px font-mono text-[6px] font-semibold uppercase tracking-wide leading-none text-white">
                                      errored
                                    </span>
                                  : it.isTransferred ?
                                    <span className="pointer-events-none absolute right-0.5 top-0.5 rounded bg-violet-600/95 px-0.5 py-px font-mono text-[6px] font-semibold tracking-wide leading-none text-white">
                                      übertragen
                                    </span>
                                  : it.isApproved ?
                                    <span className="pointer-events-none absolute right-0.5 top-0.5 inline-flex items-center gap-0.5 rounded bg-accent-mint px-0.5 py-px font-mono text-[6px] font-semibold uppercase tracking-wide leading-none text-white">
                                      <Check className="h-1.5 w-1.5" />
                                      done
                                    </span>
                                  : it.isInProgress ?
                                    <span className="pointer-events-none absolute right-0.5 top-0.5 rounded bg-sky-600/95 px-0.5 py-px font-mono text-[6px] font-semibold tracking-wide leading-none text-white">
                                      bearb.
                                    </span>
                                  : it.isFirstViewsLocked ?
                                    <span className="pointer-events-none absolute right-0.5 top-0.5 inline-flex items-center gap-0.5 rounded bg-amber-600/95 px-0.5 py-px font-mono text-[6px] font-semibold uppercase tracking-wide leading-none text-white">
                                      <Lock className="h-1.5 w-1.5" />
                                      ansehen
                                    </span>
                                  : it.isCheckPending ?
                                    <span className="pointer-events-none absolute right-0.5 top-0.5 inline-flex items-center gap-0.5 rounded bg-ink-800/95 px-0.5 py-px font-mono text-[6px] font-semibold uppercase tracking-wide leading-none text-white">
                                      <Lock className="h-1.5 w-1.5" />
                                      lock
                                    </span>
                                  : null}
                                </>
                              }
                            </span>
                            <span className="truncate px-px font-mono text-[8px] font-medium leading-none text-white sm:text-[9px]">
                              {it.srcSecondary ?
                                `${it.slotLabel} · skaliert + weiß`
                              : it.imageFileLabel}
                            </span>
                            <span className="flex min-h-[10px] flex-wrap gap-0.5">
                              {it.hasTransparencyHint ?
                                <span className="rounded bg-ink-700 px-0.5 py-px font-mono text-[6px] uppercase leading-none text-white">
                                  trp
                                </span>
                              : null}
                              {it.hasScalingHint ?
                                <span className="rounded bg-brand-700 px-0.5 py-px font-mono text-[6px] leading-none text-white">
                                  sk
                                </span>
                              : null}
                              {it.hasShadowHint ?
                                <span className="rounded bg-ink-600 px-0.5 py-px font-mono text-[6px] leading-none text-white">
                                  sh
                                </span>
                              : null}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </aside>

              <div
                role="separator"
                aria-orientation="vertical"
                aria-label="Vorschau-Spalte resizen"
                onPointerDown={handleStripResizePointerDown}
                onPointerMove={handleStripResizePointerMove}
                onPointerUp={handleStripResizePointerUp}
                onPointerCancel={handleStripResizePointerUp}
                onDoubleClick={() =>
                  setPreviewStripWidth(PREVIEW_STRIP_DEFAULT_PX)
                }
                title="Ziehen zum Verbreitern · Doppelklick = Standard"
                className="group relative -mx-1 flex w-3 shrink-0 cursor-col-resize touch-none select-none items-center justify-center"
              >
                <span
                  aria-hidden
                  className="h-10 w-0.5 rounded bg-ink-700 transition-colors group-hover:bg-ink-400 group-active:bg-white"
                />
              </div>

              <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden">
                <div
                  className={`relative flex min-h-0 flex-1 overflow-hidden rounded-lg border border-zinc-400 shadow-inner ${
                    viewsMode === "skalierung" ? "" : "bg-white"
                  }`}
                  style={
                    viewsMode === "skalierung" ?
                      SCALING_MODE_VEHICLE_BACKDROP_STYLE
                    : undefined
                  }
                >
                  <div className="flex h-full w-full items-center justify-center overflow-auto bg-transparent p-1 sm:p-2">
                    {currentPreviewItem.srcSecondary &&
                    viewsMode === "skalierung" ?
                      <div className="flex h-full max-h-full w-full max-w-full flex-row gap-1 sm:gap-2">
                        <button
                          type="button"
                          onClick={() => setScalingStripFocus("skaliert")}
                          title="Skaliert — Klick für Steuerung"
                          className={`flex min-h-0 min-w-0 flex-1 items-center justify-center rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                            scalingStripFocus === "skaliert" ?
                              "ring-2 ring-amber-400"
                            : "ring-1 ring-white/20"
                          }`}
                        >
                          <img
                            src={currentPreviewItem.src}
                            alt=""
                            className="max-h-full max-w-full object-contain"
                          />
                        </button>
                        <button
                          type="button"
                          onClick={() => setScalingStripFocus("weiss")}
                          title="Skaliert weiß — Klick für Steuerung"
                          className={`flex min-h-0 min-w-0 flex-1 items-center justify-center rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                            scalingStripFocus === "weiss" ?
                              "ring-2 ring-amber-400"
                            : "ring-1 ring-white/20"
                          }`}
                        >
                          <img
                            src={currentPreviewItem.srcSecondary}
                            alt=""
                            className="max-h-full max-w-full object-contain"
                          />
                        </button>
                      </div>
                    : <img
                        src={currentPreviewItem.src}
                        alt=""
                        className="max-h-full max-w-full object-contain"
                      />
                    }
                  </div>
                  {previewVisible ?
                    (() => {
                      const previewSrc = previewImageForSlug(
                        previewImagesMap,
                        currentPreviewItem.slotLabel,
                      );
                      const isLoading =
                        previewImagesApi.loading && !previewImagesMap;
                      return (
                        <div
                          className="pointer-events-none absolute right-2 top-2 z-10 flex max-h-[40%] w-[clamp(140px,22%,320px)] flex-col overflow-hidden rounded-md border-2 border-emerald-500 bg-white/95 shadow-lg backdrop-blur-sm"
                          aria-label="Referenz-Vorschau"
                        >
                          <div className="flex items-center justify-between gap-1 border-b border-emerald-200 bg-emerald-50 px-1.5 py-0.5">
                            <span className="font-mono text-[9px] font-semibold uppercase tracking-wide text-emerald-800">
                              Preview ·{" "}
                              {scalingActiveSide?.imageFileLabel ??
                                currentPreviewItem.imageFileLabel}
                            </span>
                          </div>
                          <div className="relative flex flex-1 items-center justify-center bg-zinc-50">
                            {isLoading ?
                              <span className="px-2 py-3 font-mono text-[10px] text-ink-500">
                                lädt…
                              </span>
                            : previewSrc ?
                              <img
                                src={previewSrc}
                                alt=""
                                loading="lazy"
                                decoding="async"
                                className="max-h-full max-w-full object-contain"
                              />
                            : previewImagesApi.error ?
                              <span className="px-2 py-3 text-center font-mono text-[10px] text-red-600">
                                Fehler beim Laden
                              </span>
                            : <span className="px-2 py-3 text-center font-mono text-[10px] text-ink-500">
                                kein Preview für „
                                {scalingActiveSide?.imageFileLabel ??
                                  currentPreviewItem.imageFileLabel}
                                "
                              </span>}
                          </div>
                        </div>
                      );
                    })()
                  : null}
                </div>

                <div className="flex shrink-0 flex-col gap-1">
                  {toolbarDefsVisible.length > 0 ?
                    <div
                      className="flex h-[4.25rem] shrink-0 flex-row items-stretch gap-2"
                      role="toolbar"
                      aria-label="Control-Aktionen"
                    >
                      {toolbarDefsVisible.map((def) => {
                        const isBusy = submittingAction === def.stub;
                        const disabled =
                          submittingAction !== null ||
                          (scalingActiveSide?.hasStatus ?? false) ||
                          currentPreviewItem.isFirstViewsLocked;
                        return (
                          <button
                            key={def.configKey}
                            type="button"
                            onClick={() =>
                              void submitControllAction(
                                def.stub,
                                {
                                  rawToken:
                                    scalingActiveSide?.raw ??
                                    currentPreviewItem.raw,
                                  imageHref:
                                    scalingActiveSide?.src ??
                                    currentPreviewItem.src,
                                  index: previewIndexClamped,
                                },
                                "toolbar",
                              )
                            }
                            disabled={disabled}
                            aria-busy={isBusy}
                            className={`flex h-full min-w-0 flex-1 basis-0 flex-col items-start justify-center gap-0.5 rounded-lg border-2 px-4 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${TOOLBAR_BUTTON_CLASSES[def.color]}`}
                          >
                            <span className="truncate text-[15px] font-semibold leading-tight sm:text-base">
                              {def.label}
                              {isBusy ?
                                <span className="ml-1.5 font-normal text-white/80">…</span>
                              : null}
                            </span>
                            <span
                              className={`font-mono text-[11px] ${TOOLBAR_HINT_CLASSES[def.color]}`}
                            >
                              {def.hint}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  : null}

                  <a
                    href={
                      scalingActiveSide?.src ?? currentPreviewItem.src
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    title={
                      scalingActiveSide?.src ?? currentPreviewItem.src
                    }
                    className="block min-h-0 min-w-0 max-w-full truncate font-mono text-[7px] leading-tight text-zinc-600 no-underline hover:text-zinc-500 sm:text-[8px]"
                  >
                    {scalingActiveSide?.src ?? currentPreviewItem.src}
                  </a>

                  <div className="flex min-h-[1rem] flex-col gap-0.5">
                    {currentPreviewItem.isFirstViewsLocked ?
                      <p className="inline-flex items-center gap-1 font-mono text-[10px] text-amber-200/95">
                        <Lock className="h-3 w-3 shrink-0" />
                        Steuerung gesperrt · zuerst die Pflicht-Ansichten aus{" "}
                        <span className="font-semibold">first_views</span>{" "}
                        (Vorschau und Großansicht bleiben möglich)
                      </p>
                    : null}
                    {scalingActiveSide?.hasStatus ?
                      <p
                        className={`font-mono text-[10px] ${
                          scalingActiveSide.isErrored
                            ? "text-red-300"
                            : scalingActiveSide.isTransferred
                            ? "text-violet-300"
                            : scalingActiveSide.isApproved
                            ? "text-emerald-300"
                            : scalingActiveSide.isCheckPending
                            ? "text-zinc-300"
                            : "text-sky-300"
                        }`}
                      >
                        {scalingActiveSide.isErrored
                          ? `errored (check ${scalingActiveSide.checkVal})`
                          : scalingActiveSide.isTransferred
                          ? "übertragen (check 6)"
                          : scalingActiveSide.isApproved ?
                            scalingActiveSide.checkVal === 0 ?
                              "done · inside · freigegeben (check 0)"
                            : "done · freigegeben (check 2)"
                          : scalingActiveSide.isCheckPending
                          ? "lock · wartet auf Prüfung (check 0)"
                          : "in Bearbeitung (check 1)"}
                        {scalingActiveSide.statusValue ?
                          <> · status: {scalingActiveSide.statusValue}</>
                        : null}
                      </p>
                    : actionError ?
                      <p className="font-mono text-[10px] text-red-300">
                        Fehler: {actionError}
                      </p>
                    : lastActionToken &&
                      scalingActiveSide &&
                      lastActionToken.raw === scalingActiveSide.raw ?
                      <p className="font-mono text-[10px] text-emerald-300">
                        gespeichert: {lastActionToken.status} ·{" "}
                        {lastActionToken.raw}
                      </p>
                    : null}
                  </div>
                </div>
              </div>
            </div>

            <p className="shrink-0 text-center text-[10px] text-zinc-400">
              ESC oder außen klicken · Pfeiltasten · Kachel antippen
              {shortcutsFooter ?
                <>
                  {" · "}
                  <span className="font-mono">{shortcutsFooter}</span>
                </>
              : null}
            </p>
          </div>
        </div>
      : null}
    </div>
  );
}
