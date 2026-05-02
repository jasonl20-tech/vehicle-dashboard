import {
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  ExternalLink,
  Image as ImageIcon,
  Lock,
  Search,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { ControlPlatformViewsMode } from "../lib/controlPlatformModeContext";
import { useControlPlatformViewsMode } from "../lib/controlPlatformModeContext";
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
  buildVehicleImageUrl,
  parseViewSlot,
  parseViewTokens,
  viewPathSlug,
} from "../lib/vehicleImageryUrl";

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
 * - Transparenz / Skalierung / Schatten: vorerst **alle** Tokens (Detail-Filter folgt später).
 */
function tokenMatchesMode(
  token: string,
  mode: ControlPlatformViewsMode,
): boolean {
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
  col: number;
  row: number;
};

/** Hauptansicht (front/rear/right/left, slug-Vergleich, case-insensitive). */
function isMainViewSlug(slug: string): boolean {
  return MAIN_VIEW_SLUGS.has(slug.trim().toLowerCase());
}

function normalizeSlug(x: string): string {
  return x.trim().toLowerCase();
}

/**
 * Feste Positionen für Standard-Ansichten; unbekannte/zusätzliche Ansichten hängen hinten an.
 */
function buildViewGridEntries(tokens: string[]): ViewGridEntry[] {
  const slotToToken = new Map<string, string>();
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
    ...slot,
    token: slotToToken.get(slot.slotSlug) ?? null,
  }));

  const extras = extraTokens.map((token, idx) => ({
    slotSlug: normalizeSlug(viewPathSlug(token)),
    token,
    col: (idx % 3) + 1,
    row: 4 + Math.floor(idx / 3),
  }));

  return [...fixed, ...extras];
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
  any: "alle",
  not_done: "noch offen",
  errored: "mit errored",
  transferred: "alles übertragen",
  done: "alles done",
  inProgress: "in Bearbeitung",
  pending: "wartend (lock)",
  none: "ohne Status",
};

const SORT_STORAGE_KEY = "controlPlatform.list.sort";
const FILTER_STORAGE_KEY = "controlPlatform.list.statusFilter";

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
  // Default: "noch offen" (alle Fahrzeuge mit nicht abgeschlossenem Status).
  const fallback: ControllListStatusFilter = "not_done";
  if (typeof window === "undefined") return fallback;
  try {
    const v = window.localStorage.getItem(FILTER_STORAGE_KEY);
    if (
      v &&
      (CONTROLL_LIST_STATUS_FILTERS as readonly string[]).includes(v)
    ) {
      return v as ControllListStatusFilter;
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

  useEffect(() => {
    setImagePreview(null);
    setActionError(null);
    setLastActionToken(null);
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

  const viewGridEntries = useMemo(
    () => buildViewGridEntries(filteredViewTokens),
    [filteredViewTokens],
  );

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
      raw: string;
      /** Status existiert in `controll_status` für (vehicle, view_token, mode). */
      hasStatus: boolean;
      /** `check === 2` → final freigegeben (grüner Rand, ausgegraut). */
      isApproved: boolean;
      /** Status existiert, aber `check !== 2` → nicht mehr bearbeitbar. */
      isLocked: boolean;
      /** `check === 0` → Badge „lock". */
      isCheckPending: boolean;
      /** `check === 1` → Badge „in Bearbeitung". */
      isInProgress: boolean;
      /** `check === 6` → Badge „übertragen". */
      isTransferred: boolean;
      /** `check >= 3` und `check !== 6` → Badge „errored". */
      isErrored: boolean;
      /** Roher `check`-Wert oder `null`, wenn kein Status existiert. */
      checkVal: number | null;
      /** Roher status-Wert (z. B. `correct`, `regen_vertex`, `delete`) — falls vorhanden. */
      statusValue: string | null;
      isMain: boolean;
      hasTransparencyHint: boolean;
      hasScalingHint: boolean;
      hasShadowHint: boolean;
      sortRank: number;
      sortIdx: number;
    };
    const internal: Row[] = [];
    for (let idx = 0; idx < viewGridEntries.length; idx++) {
      const entry = viewGridEntries[idx];
      if (!entry.token) continue;
      const token = entry.token;
      const slot = parseViewSlot(token);
      const slug = viewPathSlug(token);
      const href = buildVehicleImageUrl(cdnBase, row, slug, imageUrlQuery);
      const statusRow = statusMap.get(statusKey(slot.raw, controllMode));
      const hasStatus = !!statusRow;
      const checkVal = statusRow ? Number(statusRow.check) : null;
      const statusValueRaw = statusRow?.status ?? null;
      const isApproved = checkVal === 2;
      const isInProgress = checkVal === 1;
      const isCheckPending = checkVal === 0;
      // „übertragen" gilt **nur** im Skalierungs-Modus und nur,
      // wenn `status === 'correct'` und `check === 6`.
      const isTransferred =
        checkVal === 6 &&
        controllMode === "scaling" &&
        statusValueRaw === "correct";
      const isErrored =
        checkVal != null && checkVal >= 3 && !isTransferred;
      const isLocked = hasStatus && !isApproved;
      const isMain = isMainViewSlug(slot.slug);
      internal.push({
        key: `${row.id}-${idx}-${entry.slotSlug}-${slot.raw}`,
        src: href,
        title: `${rowTitle(row)} · ${slot.raw}`,
        slotLabel: slot.slug,
        raw: slot.raw,
        hasStatus,
        isApproved,
        isLocked,
        isCheckPending,
        isInProgress,
        isTransferred,
        isErrored,
        checkVal,
        statusValue: statusValueRaw,
        isMain,
        hasTransparencyHint: slot.hasTransparencyHint,
        hasScalingHint: slot.hasScalingHint,
        hasShadowHint: slot.hasShadowHint,
        sortRank: lightboxStripSortRank(entry.slotSlug),
        sortIdx: idx,
      });
    }
    internal.sort((a, b) =>
      a.sortRank !== b.sortRank ? a.sortRank - b.sortRank : a.sortIdx - b.sortIdx,
    );
    return internal.map(({ sortRank: _r, sortIdx: _i, ...item }) => item);
  }, [row, viewGridEntries, cdnBase, imageUrlQuery, controllMode, statusMap]);

  /** Schreibt eine Control-Aktion in `controll_status` und lädt die Statuses neu.
   * Springt nach Erfolg zur nächsten Ansicht, die noch bearbeitbar ist
   * (kein `controll_status`-Eintrag in `view_token + mode`).
   */
  const submitControllAction = useCallback(
    async (
      action: ControllActionStub,
      ctx: { rawToken: string; imageHref: string; index: number },
    ) => {
      if (selectedId == null) return;
      const status = CONTROLL_ACTION_TO_STATUS[action];
      if (!status) return;
      const r2Key = r2KeyFromImageUrl(cdnBase, ctx.imageHref);
      setSubmittingAction(action);
      setActionError(null);
      try {
        const res = await postControllStatus({
          vehicleId: selectedId,
          viewToken: ctx.rawToken,
          mode: controllMode,
          status,
          key: r2Key,
        });
        setLastActionToken({
          raw: res.row.view_token,
          status: res.row.status,
        });

        const items = imagePreviewStripItems;
        const isEditable = (i: number) =>
          items[i] &&
          items[i].raw !== ctx.rawToken &&
          !items[i].hasStatus;
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
        if (nextIdx != null) setImagePreview({ index: nextIdx });

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
    ],
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
      const curEditable = !!cur && !cur.hasStatus;

      for (const def of defs) {
        if (flags[def.configKey] !== true) continue;
        const list = shortcuts[def.configKey];
        if (!list) continue;
        if (matchesShortcutKey(e.key, list)) {
          e.preventDefault();
          if (submittingAction) return;
          if (!cur || !curEditable) return;
          void submitControllAction(def.stub, {
            rawToken: cur.raw,
            imageHref: cur.src,
            index: curIdx,
          });
          return;
        }
      }

      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        setImagePreview((p) => {
          if (!p) return p;
          return { index: Math.min(p.index + 1, n - 1) };
        });
        return;
      }
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
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
    submittingAction,
    viewsMode,
    controllButtonsResolved,
  ]);

  const previewIndexClamped =
    imagePreview && imagePreviewStripItems.length > 0 ?
      Math.min(
        Math.max(0, imagePreview.index),
        imagePreviewStripItems.length - 1,
      )
    : 0;
  const currentPreviewItem = imagePreviewStripItems[previewIndexClamped];

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
      <aside className="flex max-h-[48vh] w-full min-h-0 shrink-0 flex-col border-b border-hair lg:h-full lg:max-h-none lg:w-[240px] lg:border-b-0 lg:border-r lg:border-hair">
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
                statusFilter === "any" || statusFilter === "not_done"
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
            const nViewsForMode = parseViewTokens(r.views).filter((t) =>
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
${counts.total} / ${nViewsForMode} im aktuellen Modus`;
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
                        {counts.total}/{nViewsForMode}
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
                  to={`/databases/production/${row.id}`}
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

              {filteredViewTokens.length === 0 ?
                <p className="text-[12px] text-ink-500">
                  {parseViewTokens(row.views).length === 0 ?
                    "Keine Ansichten in der Datenbank."
                  : "Keine Ansichten für diesen Modus."}
                </p>
              : <ul className="grid grid-cols-[repeat(3,minmax(9rem,11rem))] gap-2 sm:grid-cols-[repeat(3,minmax(10rem,12rem))] lg:grid-cols-[repeat(3,minmax(12rem,14rem))]">
                  {viewGridEntries.map((entry, idx) => {
                    if (!entry.token) {
                      return (
                        <li
                          key={`${row.id}-slot-${entry.slotSlug}-${idx}`}
                          style={{
                            gridColumn: entry.col,
                            gridRow: entry.row,
                          }}
                        >
                          <article className="flex w-full flex-col border border-dashed border-hair bg-paper/50">
                            <div className="relative flex aspect-[3/2] items-center justify-center overflow-hidden bg-ink-50/40">
                              <span className="pointer-events-none absolute left-1 top-1 max-w-[calc(100%-0.5rem)] truncate font-mono text-[9px] text-ink-400">
                                {entry.slotSlug}
                              </span>
                              <ImageIcon className="h-8 w-8 text-ink-200/80" />
                            </div>
                            <div className="flex min-h-[2rem] items-center gap-1 border-t border-hair px-1 py-0.5">
                              <span className="min-w-0 flex-1 truncate font-mono text-[9px] leading-tight text-ink-400">
                                —
                              </span>
                            </div>
                          </article>
                        </li>
                      );
                    }

                    const token = entry.token;
                    const slot = parseViewSlot(token);
                    const slug = viewPathSlug(token);
                    const href = buildVehicleImageUrl(
                      cdnBase,
                      row,
                      slug,
                      imageUrlQuery,
                    );
                    const status = statusMap.get(
                      statusKey(slot.raw, controllMode),
                    );
                    const checkVal = status ? Number(status.check) : null;
                    const isApproved = checkVal === 2;
                    const isInProgress = checkVal === 1;
                    const isCheckPending = checkVal === 0;
                    const isTransferred =
                      checkVal === 6 &&
                      controllMode === "scaling" &&
                      status?.status === "correct";
                    const isErrored =
                      checkVal != null && checkVal >= 3 && !isTransferred;
                    return (
                      <li
                        key={`${row.id}-${idx}-${entry.slotSlug}-${slot.raw}`}
                        style={{
                          gridColumn: entry.col,
                          gridRow: entry.row,
                        }}
                      >
                        <article
                          title={
                            status ?
                              `${slot.raw} • ${status.mode}/${status.status} • check ${checkVal ?? "—"}`
                            : slot.raw
                          }
                          className={`flex w-full flex-col bg-paper transition-colors ${
                            isErrored
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
                              const i = imagePreviewStripItems.findIndex(
                                (it) => it.src === href,
                              );
                              setImagePreview({
                                index: i >= 0 ? i : 0,
                              });
                            }}
                            aria-label={`${slot.slug} groß anzeigen`}
                            className="group relative flex aspect-[3/2] w-full cursor-zoom-in items-center justify-center overflow-hidden bg-ink-50 outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ink-800"
                          >
                            <img
                              src={href}
                              alt={slot.slug}
                              loading="lazy"
                              decoding="async"
                              className={`max-h-full max-w-full object-contain ${
                                isApproved ? "opacity-30 grayscale" : ""
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
                            <span className="pointer-events-none absolute left-1 top-1 max-w-[calc(100%-0.5rem)] truncate font-mono text-[9px] text-ink-600">
                              {slot.slug}
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
                          </button>
                          <div className="flex min-h-[2rem] items-center gap-1 border-t border-hair px-1 py-0.5">
                            <span className="min-w-0 flex-1 truncate font-mono text-[9px] leading-tight text-ink-500">
                              {slot.raw}
                            </span>
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 text-ink-400 transition hover:text-ink-700"
                              aria-label="Bild in neuem Tab öffnen"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
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
                <a
                  href={currentPreviewItem.src}
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
                            title={`${it.raw}`}
                            className={`flex w-full flex-col gap-0.5 rounded border p-1 text-left transition ${
                              selected ?
                                "border-white bg-ink-800"
                              : "border-ink-700 bg-ink-950 hover:border-ink-500 hover:bg-ink-900"
                            }`}
                          >
                            <span className="relative flex aspect-[3/2] w-full items-center justify-center overflow-hidden rounded bg-zinc-100">
                              <img
                                src={it.src}
                                alt=""
                                className={`max-h-full max-w-full object-contain ${
                                  it.isApproved ? "opacity-35 grayscale" : ""
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
                              : it.isCheckPending ?
                                <span className="pointer-events-none absolute right-0.5 top-0.5 inline-flex items-center gap-0.5 rounded bg-ink-800/95 px-0.5 py-px font-mono text-[6px] font-semibold uppercase tracking-wide leading-none text-white">
                                  <Lock className="h-1.5 w-1.5" />
                                  lock
                                </span>
                              : null}
                            </span>
                            <span className="truncate px-px font-mono text-[8px] font-medium leading-none text-white sm:text-[9px]">
                              {it.slotLabel}
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
                <div className="relative flex min-h-0 flex-1 overflow-hidden rounded-lg border border-zinc-400 bg-white shadow-inner">
                  <div className="flex h-full w-full items-center justify-center overflow-auto bg-white p-1 sm:p-2">
                    <img
                      src={currentPreviewItem.src}
                      alt=""
                      className="max-h-full max-w-full object-contain"
                    />
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
                              Preview · {currentPreviewItem.slotLabel}
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
                                kein Preview für „{currentPreviewItem.slotLabel}"
                              </span>}
                          </div>
                        </div>
                      );
                    })()
                  : null}
                </div>

                {toolbarDefsVisible.length > 0 ?
                  <div className="flex shrink-0 flex-col gap-1">
                    <div
                      className="flex h-[4.25rem] shrink-0 flex-row items-stretch gap-2"
                      role="toolbar"
                      aria-label="Control-Aktionen"
                    >
                      {toolbarDefsVisible.map((def) => {
                        const isBusy = submittingAction === def.stub;
                        const disabled =
                          submittingAction !== null ||
                          currentPreviewItem.hasStatus;
                        return (
                          <button
                            key={def.configKey}
                            type="button"
                            onClick={() =>
                              void submitControllAction(def.stub, {
                                rawToken: currentPreviewItem.raw,
                                imageHref: currentPreviewItem.src,
                                index: previewIndexClamped,
                              })
                            }
                            disabled={disabled}
                            aria-busy={isBusy}
                            className={`flex h-full min-w-0 flex-1 basis-0 flex-col items-start justify-center gap-0.5 rounded-lg border-2 px-4 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${TOOLBAR_BUTTON_CLASSES[def.color]}`}
                          >
                            <span className="truncate text-[15px] font-semibold leading-tight sm:text-base">
                              {def.label}
                              {isBusy ? (
                                <span className="ml-1.5 font-normal text-white/80">…</span>
                              ) : null}
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
                    <div className="min-h-[1rem]">
                      {currentPreviewItem.hasStatus ?
                        <p
                          className={`font-mono text-[10px] ${
                            currentPreviewItem.isErrored
                              ? "text-red-300"
                              : currentPreviewItem.isTransferred
                              ? "text-violet-300"
                              : currentPreviewItem.isApproved
                              ? "text-emerald-300"
                              : currentPreviewItem.isCheckPending
                              ? "text-zinc-300"
                              : "text-sky-300"
                          }`}
                        >
                          {currentPreviewItem.isErrored
                            ? `errored (check ${currentPreviewItem.checkVal})`
                            : currentPreviewItem.isTransferred
                            ? "übertragen (check 6)"
                            : currentPreviewItem.isApproved
                            ? "done · freigegeben (check 2)"
                            : currentPreviewItem.isCheckPending
                            ? "lock · wartet auf Prüfung (check 0)"
                            : "in Bearbeitung (check 1)"}
                          {currentPreviewItem.statusValue ?
                            <> · status: {currentPreviewItem.statusValue}</>
                          : null}
                        </p>
                      : actionError ?
                        <p className="font-mono text-[10px] text-red-300">
                          Fehler: {actionError}
                        </p>
                      : lastActionToken &&
                        lastActionToken.raw === currentPreviewItem.raw ?
                        <p className="font-mono text-[10px] text-emerald-300">
                          gespeichert: {lastActionToken.status} ·{" "}
                          {lastActionToken.raw}
                        </p>
                      : null}
                    </div>
                  </div>
                : null}
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
