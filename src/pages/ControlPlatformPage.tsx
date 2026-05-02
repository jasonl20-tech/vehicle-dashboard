import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Image as ImageIcon,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fmtNumber, useApi } from "../lib/customerApi";
import {
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

export default function ControlPlatformPage() {
  const [qIn, setQIn] = useState("");
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const [active, setActive] = useState<"all" | "0" | "1">("1");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQ(qIn), 400);
    return () => clearTimeout(t);
  }, [qIn]);

  useEffect(() => {
    setOffset(0);
    setSelectedId(null);
  }, [q, active]);

  const listUrl = useMemo(
    () => vehicleImageryListUrl({ q, limit: PAGE_SIZE, offset, active }),
    [q, offset, active],
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
    return vehicleImageryOneUrl(selectedId);
  }, [selectedId]);
  const detailApi = useApi<VehicleImageryOneResponse>(detailUrl);

  const row = detailApi.data?.row;
  const cdnBase = (detailApi.data?.cdnBase ?? listApi.data?.cdnBase ?? "https://bildurl.vehicleimagery.com").replace(
    /\/$/,
    "",
  );
  const imageUrlQuery = detailApi.data?.imageUrlQuery ?? listApi.data?.imageUrlQuery ?? "";

  const viewTokens = row ? parseViewTokens(row.views) : [];
  const atEnd = offset + rows.length >= total;
  const pageLabel =
    total === 0
      ? "0 / 0"
      : `${offset + 1}–${offset + rows.length} / ${fmtNumber(total)}`;

  const sidebarSelectedOnPage =
    selectedId != null && rows.some((r) => r.id === selectedId);

  return (
    <div>
      <p className="mb-4 text-[12.5px] leading-relaxed text-ink-600">
        Daten aus{" "}
        <code className="font-mono text-[11.5px] text-ink-800">
          vehicleimagery_public_storage
        </code>{" "}
        (D1-Binding{" "}
        <code className="font-mono text-[11.5px]">vehicledatabase</code>). Die
        Spalte <code className="font-mono text-[11px]">views</code> enthält die
        Ansichten, getrennt durch{" "}
        <code className="font-mono text-[11px]">;</code>, optional mit Suffix wie{" "}
        <code className="font-mono text-[11px]">#trp</code>. Jede Kachel rechts
        ist eine Ansicht (Bild-URL vorbereitet, Platzhalter falls noch kein CDN).
      </p>

      <div className="flex min-h-[min(70vh,900px)] flex-col border border-hair bg-white lg:flex-row">
        <aside className="flex w-full shrink-0 flex-col border-b border-hair lg:w-[300px] lg:border-b-0 lg:border-r lg:border-hair">
          <div className="border-b border-hair px-3 py-3">
            <label className="sr-only" htmlFor="control-platform-search">
              Einträge filtern
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
              <input
                id="control-platform-search"
                type="search"
                value={qIn}
                onChange={(e) => setQIn(e.target.value)}
                placeholder="Marke, Modell, Jahr, views …"
                className="w-full border border-hair bg-paper py-2 pl-8 pr-2 text-[12.5px] text-ink-800 placeholder:text-ink-400 focus:border-ink-800 focus:outline-none focus:ring-0"
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] tabular-nums text-ink-500">
                {pageLabel}
              </p>
              <div className="inline-flex overflow-hidden rounded border border-hair bg-paper text-[10.5px]">
                {(
                  [
                    { id: "1" as const, label: "Aktiv" },
                    { id: "all" as const, label: "Alle" },
                    { id: "0" as const, label: "Inaktiv" },
                  ] as const
                ).map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setActive(o.id)}
                    className={`px-2 py-1 ${
                      active === o.id
                        ? "bg-ink-800 text-white"
                        : "text-ink-600 hover:bg-ink-50"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            {listApi.error && (
              <p className="mt-2 text-[11px] text-accent-rose">
                {listApi.error}
              </p>
            )}
            <div className="mt-2 flex items-center gap-1">
              <button
                type="button"
                disabled={offset === 0 || listApi.loading}
                onClick={() => setOffset((o) => Math.max(0, o - limit))}
                className="inline-flex h-8 w-8 items-center justify-center border border-hair bg-paper text-ink-600 disabled:opacity-40"
                aria-label="Vorherige Seite"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={atEnd || listApi.loading}
                onClick={() => setOffset((o) => o + limit)}
                className="inline-flex h-8 w-8 items-center justify-center border border-hair bg-paper text-ink-600 disabled:opacity-40"
                aria-label="Nächste Seite"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              {listApi.loading && (
                <span className="text-[10px] text-ink-400">lädt …</span>
              )}
            </div>
          </div>
          <ul
            className="max-h-[48vh] flex-1 overflow-y-auto lg:max-h-[min(75vh,820px)]"
            role="listbox"
            aria-label="Einträge"
          >
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
                    className={`flex w-full items-center gap-2 border-b border-hair px-3 py-3 text-left text-[13px] transition-colors hover:bg-ink-50/80 ${
                      selected ? "bg-ink-50" : ""
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-ink-900">
                        {rowTitle(r)}
                      </span>
                      <span className="mt-0.5 block truncate font-mono text-[11px] text-ink-500">
                        id {r.id} · {rowSubtitle(r)}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-ink-500">
                        <span>
                          {nViews} Ansicht{nViews === 1 ? "" : "en"}
                        </span>
                        {r.genehmigt === 1 ? (
                          <span className="rounded bg-accent-mint/15 px-1 font-medium text-accent-mint">
                            genehmigt
                          </span>
                        ) : null}
                      </span>
                    </span>
                    <ChevronRight
                      className={`h-4 w-4 shrink-0 text-ink-400 ${
                        selected ? "text-ink-800" : ""
                      }`}
                    />
                  </button>
                </li>
              );
            })}
            {!listApi.loading && rows.length === 0 && (
              <li className="px-3 py-8 text-center text-[12px] text-ink-500">
                Keine Einträge.
              </li>
            )}
          </ul>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          {detailApi.error && (
            <div className="border-b border-hair bg-accent-rose/5 px-4 py-3 text-[12.5px] text-accent-rose sm:px-5">
              {detailApi.error}
            </div>
          )}

          {row ? (
            <>
              <div className="border-b border-hair px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h1 className="font-display text-lg font-semibold tracking-tight text-ink-900">
                      {rowTitle(row)}
                    </h1>
                    <p className="mt-1 font-mono text-[11px] text-ink-500">
                      id {row.id} · {rowSubtitle(row)}
                    </p>
                    <p className="mt-2 text-[11px] text-ink-500">
                      Aktualisiert {fmtWhen(row.last_updated)}
                      <span className="mx-1.5 text-ink-300">·</span>
                      {row.active === 1 ? "aktiv" : "inaktiv"}
                      <span className="mx-1.5 text-ink-300">·</span>
                      genehmigt{" "}
                      <span className="font-mono">
                        {row.genehmigt === 1 ? "ja" : "nein"}
                      </span>
                    </p>
                  </div>
                  <Link
                    to={`/databases/production/${row.id}`}
                    className="inline-flex shrink-0 items-center gap-1 text-[11.5px] text-brand-600 hover:underline"
                  >
                    In Produktions-DB öffnen
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
                <h2 className="mb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-ink-400">
                  Ansichten ({viewTokens.length})
                </h2>

                {viewTokens.length === 0 ? (
                  <p className="text-[13px] text-ink-500">
                    Keine Ansichten — Feld{" "}
                    <code className="font-mono text-ink-700">views</code> ist
                    leer.
                  </p>
                ) : (
                  <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                    {viewTokens.map((token, idx) => {
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
                              <div className="hidden grid place-items-center px-2">
                                <ImageIcon className="h-10 w-10 text-ink-200" />
                              </div>
                              <span className="pointer-events-none absolute left-2 top-2 max-w-[calc(100%-1rem)] truncate font-mono text-[10px] text-ink-600">
                                {slot.slug}
                              </span>
                              {slot.hasTransparencyHint ? (
                                <span className="pointer-events-none absolute right-2 top-2 rounded bg-ink-800/90 px-1.5 py-0.5 font-mono text-[9px] font-medium uppercase tracking-wide text-white">
                                  trp
                                </span>
                              ) : null}
                            </a>
                            <div className="flex items-center gap-2 border-t border-hair px-2 py-2">
                              <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-ink-500">
                                {slot.raw}
                              </span>
                              <span
                                className="shrink-0 text-ink-400"
                                aria-hidden
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </span>
                            </div>
                          </article>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </>
          ) : (
            <div className="grid flex-1 place-items-center px-6 py-16 text-center text-[13px] text-ink-500">
              {detailApi.loading || listApi.loading
                ? "Laden…"
                : selectedId
                  ? "Eintrag nicht gefunden oder nicht ladenbar."
                  : "Keine Einträge in dieser Liste — Suche oder Filter anpassen."}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
