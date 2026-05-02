import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Image as ImageIcon,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { ControlPlatformViewsMode } from "../lib/controlPlatformModeContext";
import { useControlPlatformViewsMode } from "../lib/controlPlatformModeContext";
import { fmtNumber, useApi } from "../lib/customerApi";
import {
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

export default function ControlPlatformPage() {
  const { viewsMode } = useControlPlatformViewsMode();
  const [qIn, setQIn] = useState("");
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQ(qIn), 400);
    return () => clearTimeout(t);
  }, [qIn]);

  useEffect(() => {
    setOffset(0);
    setSelectedId(null);
  }, [q, viewsMode]);

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
              : <ul className="grid grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                  {filteredViewTokens.map((token, idx) => {
                    const slot = parseViewSlot(token);
                    const slug = viewPathSlug(token);
                    const href = buildVehicleImageUrl(
                      cdnBase,
                      row,
                      slug,
                      imageUrlQuery,
                    );
                    return (
                      <li key={`${row.id}-${idx}-${slot.raw}`}>
                        <article
                          title={slot.raw}
                          className="flex w-full flex-col border border-hair bg-paper"
                        >
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-ink-50 outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ink-800"
                          >
                            <img
                              src={href}
                              alt={slot.slug}
                              loading="lazy"
                              decoding="async"
                              className="max-h-full max-w-full object-contain"
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
                          </a>
                          <div className="flex min-h-[2rem] items-center gap-1 border-t border-hair px-1 py-0.5">
                            <span className="min-w-0 flex-1 truncate font-mono text-[9px] leading-tight text-ink-500">
                              {slot.raw}
                            </span>
                            <ExternalLink
                              className="h-3 w-3 shrink-0 text-ink-400"
                              aria-hidden
                            />
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
    </div>
  );
}
