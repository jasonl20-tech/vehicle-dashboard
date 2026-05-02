import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Image as ImageIcon,
  Search,
  Star,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { ControlPlatformViewsMode } from "../lib/controlPlatformModeContext";
import { useControlPlatformViewsMode } from "../lib/controlPlatformModeContext";
import { fmtNumber, useApi } from "../lib/customerApi";
import {
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
): string | null {
  if (m === "korrektur") return "correction";
  if (m === "skalierung") return "scaling";
  /* Transparenz/Schatten: später, sobald die Modi in controll_status definiert sind. */
  return null;
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

export default function ControlPlatformPage() {
  const { viewsMode } = useControlPlatformViewsMode();
  const [qIn, setQIn] = useState("");
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [imagePreview, setImagePreview] = useState<{ index: number } | null>(
    null,
  );
  const activePreviewThumbRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQ(qIn), 400);
    return () => clearTimeout(t);
  }, [qIn]);

  useEffect(() => {
    setOffset(0);
    setSelectedId(null);
  }, [q, viewsMode]);

  useEffect(() => {
    setImagePreview(null);
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
        },
        VEHICLE_IMAGERY_CONTROLLING_API,
      ),
    [q, offset, viewsMode],
  );
  const listApi = useApi<VehicleImageryListResponse>(listUrl);

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
  const detailApi = useApi<VehicleImageryOneResponse>(detailUrl);

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

  const imagePreviewStripItems = useMemo(() => {
    if (!row) return [];
    type Row = {
      key: string;
      src: string;
      title: string;
      slotLabel: string;
      raw: string;
      isCorrect: boolean;
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
      const status =
        controllMode != null ?
          statusMap.get(statusKey(slot.raw, controllMode))
        : undefined;
      const isCorrect = status?.status === "correct";
      const isMain = isMainViewSlug(slot.slug);
      internal.push({
        key: `${row.id}-${idx}-${entry.slotSlug}-${slot.raw}`,
        src: href,
        title: `${rowTitle(row)} · ${slot.raw}`,
        slotLabel: slot.slug,
        raw: slot.raw,
        isCorrect,
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

  /** Platzhalter — Korrektur-Aktionen (API folgt). */
  const onCorrectionActionStub = useCallback(
    (_action: "richtig" | "vertex" | "batch" | "loeschen") => {},
    [],
  );

  useEffect(() => {
    if (!imagePreview || imagePreviewStripItems.length === 0) return;
    const n = imagePreviewStripItems.length;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === "Escape") {
        setImagePreview(null);
        return;
      }

      if (viewsMode === "korrektur") {
        const k = e.key;
        if (k === "1" || k === "r" || k === "R") {
          e.preventDefault();
          onCorrectionActionStub("richtig");
          return;
        }
        if (k === "2" || k === "v" || k === "V") {
          e.preventDefault();
          onCorrectionActionStub("vertex");
          return;
        }
        if (k === "4" || k === "l" || k === "L") {
          e.preventDefault();
          onCorrectionActionStub("loeschen");
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
    imagePreviewStripItems.length,
    onCorrectionActionStub,
    viewsMode,
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
            const nViews = parseViewTokens(r.views).length;
            return (
              <li key={r.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => setSelectedId(r.id)}
                  className={`flex w-full items-center gap-1 border-b border-hair px-1.5 py-2 text-left text-[12px] transition-colors hover:bg-ink-50/80 ${
                    selected ? "bg-ink-50" : ""
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium leading-tight text-ink-900">
                      {rowTitle(r)}
                    </span>
                    <span className="mt-0.5 block truncate font-mono text-[10px] leading-tight text-ink-500">
                      #{r.id} · {rowSubtitle(r)}
                    </span>
                    <span className="mt-0.5 text-[10px] text-ink-500">
                      {nViews} Ansicht{nViews === 1 ? "" : "en"}
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
                    const status =
                      controllMode != null ?
                        statusMap.get(statusKey(slot.raw, controllMode))
                      : undefined;
                    const isCorrect = status?.status === "correct";
                    const isMain = isMainViewSlug(slot.slug);
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
                              `${slot.raw} • ${status.mode}/${status.status}`
                            : slot.raw
                          }
                          className={`flex w-full flex-col bg-paper transition-colors ${
                            isCorrect
                              ? "border-2 border-accent-mint"
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
                                isCorrect ? "opacity-30 grayscale" : ""
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
                            <span className="pointer-events-none absolute right-1 top-1 flex max-w-[55%] flex-wrap justify-end gap-0.5">
                              {isCorrect && isMain ?
                                <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-accent-mint text-white">
                                  <Star className="h-2.5 w-2.5 fill-white" />
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
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black p-2 sm:p-4"
          role="presentation"
        >
          <button
            type="button"
            className="absolute inset-0 z-0 cursor-default"
            aria-label="Schließen"
            onClick={() => setImagePreview(null)}
          />
          <div
            className="relative z-10 flex h-[min(92dvh,92vh)] w-full max-w-[min(98vw,1720px)] flex-col gap-1.5 rounded-lg border border-ink-700 bg-ink-950 p-2 shadow-2xl sm:gap-2 sm:p-3"
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

            <div className="flex min-h-0 flex-1 flex-row gap-2 overflow-hidden sm:gap-3">
              <aside className="flex w-[5.75rem] shrink-0 flex-col gap-1 overflow-hidden sm:w-[6.75rem] md:w-[7.5rem]">
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
                                  it.isCorrect ? "opacity-35 grayscale" : ""
                                }`}
                              />
                              {it.isCorrect && it.isMain ?
                                <span className="pointer-events-none absolute right-0.5 top-0.5 flex h-3 w-3 items-center justify-center rounded bg-accent-mint text-white">
                                  <Star className="h-1.5 w-1.5 fill-white" />
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

              <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden">
                <div className="flex min-h-0 flex-1 overflow-hidden rounded-lg border border-zinc-400 bg-white shadow-inner">
                  <div className="flex h-full w-full items-center justify-center overflow-auto bg-white p-1 sm:p-2">
                    <img
                      src={currentPreviewItem.src}
                      alt=""
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                </div>

                {viewsMode === "korrektur" ?
                  <div
                    className="flex shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-stretch"
                    role="toolbar"
                    aria-label="Korrektur-Aktionen"
                  >
                    <button
                      type="button"
                      onClick={() => onCorrectionActionStub("richtig")}
                      className="flex min-h-[3.75rem] flex-1 flex-col items-start justify-center gap-0.5 rounded-lg border border-ink-600 bg-ink-800 px-4 py-3 text-left text-white transition hover:bg-ink-700 sm:min-w-[10.5rem]"
                    >
                      <span className="text-[15px] font-semibold leading-tight sm:text-base">
                        Richtig
                      </span>
                      <span className="font-mono text-[11px] text-zinc-400">
                        1 / R
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onCorrectionActionStub("vertex")}
                      className="flex min-h-[3.75rem] flex-1 flex-col items-start justify-center gap-0.5 rounded-lg border border-ink-600 bg-ink-800 px-4 py-3 text-left text-white transition hover:bg-ink-700 sm:min-w-[10.5rem]"
                    >
                      <span className="text-[15px] font-semibold leading-tight sm:text-base">
                        Neu Generieren ( Vertex )
                      </span>
                      <span className="font-mono text-[11px] text-zinc-400">
                        2 / V
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled
                      aria-disabled="true"
                      title="Derzeit deaktiviert"
                      className="flex min-h-[3.75rem] flex-1 cursor-not-allowed flex-col items-start justify-center gap-0.5 rounded-lg border border-ink-800 bg-ink-950 px-4 py-3 text-left text-zinc-500 opacity-60 sm:min-w-[10.5rem]"
                    >
                      <span className="text-[15px] font-semibold leading-tight sm:text-base">
                        Neu Generieren ( Batch )
                      </span>
                      <span className="font-mono text-[11px] text-zinc-500">
                        deaktiviert
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onCorrectionActionStub("loeschen")}
                      className="flex min-h-[3.75rem] flex-1 flex-col items-start justify-center gap-0.5 rounded-lg border border-red-800 bg-red-950 px-4 py-3 text-left text-red-100 transition hover:bg-red-900 sm:min-w-[10.5rem]"
                    >
                      <span className="text-[15px] font-semibold leading-tight sm:text-base">
                        Löschen
                      </span>
                      <span className="font-mono text-[11px] text-red-200/80">
                        4 / L
                      </span>
                    </button>
                  </div>
                : null}
              </div>
            </div>

            <p className="shrink-0 text-center text-[10px] text-zinc-400">
              ESC oder außen klicken · Pfeiltasten · Kachel antippen
              {viewsMode === "korrektur" ?
                <>
                  {" "}
                  · Korrektur:{" "}
                  <span className="font-mono">1</span>/<span className="font-mono">
                    R
                  </span>
                  , <span className="font-mono">2</span>/
                  <span className="font-mono">V</span>,{" "}
                  <span className="font-mono">4</span>/<span className="font-mono">
                    L
                  </span>
                </>
              : null}
            </p>
          </div>
        </div>
      : null}
    </div>
  );
}
