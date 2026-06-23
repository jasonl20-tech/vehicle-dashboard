import {
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ImageIcon,
  PauseCircle,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import PageHeader from "../components/ui/PageHeader";
import { fmtNumber, useApi } from "../lib/customerApi";
import {
  CAR_SORT_LABELS,
  CAR_SORTS,
  CAR_STATUS_FILTERS,
  CAR_STATUS_LABELS,
  carDatabaseDetailUrl,
  carDatabaseListUrl,
  carThumbApiUrl,
  type CarDetailResponse,
  type CarDetailStatus,
  type CarDetailView,
  type CarListResponse,
  type CarRow,
  type CarSort,
  type CarStatusFilter,
} from "../lib/carDatabaseApi";
import { fmtWhen, PAGE_SIZE, TD, TEXT_IN, TH } from "../lib/carDatabaseUi";

const FARBE_OPTIONS = [
  "blue",
  "black",
  "orange",
  "white",
  "default",
  "wine_red",
] as const;

const EMPTY_STRUCT = {
  marke: "",
  modell: "",
  jahr: "",
  body: "",
  trim: "",
  farbe: "",
  resolution: "",
  viewMissing: "",
  jahrMin: "",
  jahrMax: "",
  viewsMin: "",
  viewsMax: "",
  updatedFrom: "",
  updatedTo: "",
};

export default function CarDatabaseListPage() {
  // Anfangsfilter aus der URL (Drill-Down von der Übersicht), danach lokaler State.
  const [searchParams] = useSearchParams();
  const initStatus = searchParams.get("status") || "";
  const initMarke = searchParams.get("marke") || "";
  const initView = searchParams.get("view") || "";

  // Sofort wirksam.
  const [status, setStatus] = useState<CarStatusFilter>(
    (CAR_STATUS_FILTERS as readonly string[]).includes(initStatus)
      ? (initStatus as CarStatusFilter)
      : "all",
  );
  const [sort, setSort] = useState<CarSort>("marke");
  const [format, setFormat] = useState("");
  const [farben, setFarben] = useState<string[]>([]);
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<CarRow | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(true);

  // Freitext (entprellt).
  const [qIn, setQIn] = useState("");
  const [q, setQ] = useState("");

  // Strukturierte Felder (entprellt → applied).
  const [marke, setMarke] = useState(initMarke);
  const [modell, setModell] = useState("");
  const [jahr, setJahr] = useState("");
  const [body, setBody] = useState("");
  const [trim, setTrim] = useState("");
  const [farbe, setFarbe] = useState("");
  const [resolution, setResolution] = useState("");
  const [viewMissing, setViewMissing] = useState(initView);
  const [jahrMin, setJahrMin] = useState("");
  const [jahrMax, setJahrMax] = useState("");
  const [viewsMin, setViewsMin] = useState("");
  const [viewsMax, setViewsMax] = useState("");
  const [updatedFrom, setUpdatedFrom] = useState("");
  const [updatedTo, setUpdatedTo] = useState("");

  const [applied, setApplied] = useState({
    ...EMPTY_STRUCT,
    marke: initMarke,
    viewMissing: initView,
  });

  useEffect(() => {
    const t = setTimeout(() => setQ(qIn), 400);
    return () => clearTimeout(t);
  }, [qIn]);

  useEffect(() => {
    const t = setTimeout(() => {
      setApplied({
        marke,
        modell,
        jahr,
        body,
        trim,
        farbe,
        resolution,
        viewMissing,
        jahrMin,
        jahrMax,
        viewsMin,
        viewsMax,
        updatedFrom,
        updatedTo,
      });
    }, 400);
    return () => clearTimeout(t);
  }, [
    marke,
    modell,
    jahr,
    body,
    trim,
    farbe,
    resolution,
    viewMissing,
    jahrMin,
    jahrMax,
    viewsMin,
    viewsMax,
    updatedFrom,
    updatedTo,
  ]);

  // Bei Filter-/Sortier-Änderung auf Seite 1 zurück.
  useEffect(() => {
    setOffset(0);
  }, [q, status, sort, format, farben, applied]);

  const listUrl = useMemo(
    () =>
      carDatabaseListUrl({
        q,
        marke: applied.marke,
        modell: applied.modell,
        jahr: applied.jahr,
        body: applied.body,
        trim: applied.trim,
        farbe: applied.farbe,
        farben,
        format,
        resolution: applied.resolution,
        view: applied.viewMissing,
        status,
        jahrMin: applied.jahrMin,
        jahrMax: applied.jahrMax,
        viewsMin: applied.viewsMin,
        viewsMax: applied.viewsMax,
        updatedFrom: applied.updatedFrom,
        updatedTo: applied.updatedTo,
        sort,
        limit: PAGE_SIZE,
        offset,
      }),
    [q, applied, farben, format, status, sort, offset],
  );
  const listApi = useApi<CarListResponse>(listUrl);
  const list = listApi.data;
  const total = list?.total ?? 0;

  const activeFilters =
    !!q ||
    farben.length > 0 ||
    !!format ||
    status !== "all" ||
    Object.values(applied).some((v) => !!v);

  const toggleFarbe = (c: string) =>
    setFarben((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );

  const resetFilters = () => {
    setQIn("");
    setQ("");
    setMarke("");
    setModell("");
    setJahr("");
    setBody("");
    setTrim("");
    setFarbe("");
    setResolution("");
    setViewMissing("");
    setJahrMin("");
    setJahrMax("");
    setViewsMin("");
    setViewsMax("");
    setUpdatedFrom("");
    setUpdatedTo("");
    setFarben([]);
    setFormat("");
    setStatus("all");
    setApplied({ ...EMPTY_STRUCT });
  };

  return (
    <div>
      <PageHeader
        eyebrow="Car Database"
        title="Fahrzeug-Datenbank"
        description="Alle Fahrzeuge der neuen Datenbank (eine Zeile je Auto). Suchen, filtern, sortieren — und ein Auto anklicken für alle Ansichten."
      />

      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[11px] text-ink-500">
          {total > 0 ? `${fmtNumber(total)} Fahrzeuge` : "—"}
          {listApi.loading && <span className="ml-2 text-ink-400">lädt…</span>}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-md border border-hair bg-paper px-2.5 py-1.5 text-[12px] text-ink-600 hover:bg-ink-50"
          >
            {filtersOpen ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
            Filter
            {activeFilters && (
              <span className="ml-0.5 inline-block h-1.5 w-1.5 rounded-full bg-brand-500" />
            )}
          </button>
          <button
            type="button"
            onClick={() => listApi.reload()}
            className="inline-flex items-center gap-1.5 rounded-md border border-hair bg-paper px-2.5 py-1.5 text-[12px] text-ink-600 hover:bg-ink-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${listApi.loading ? "animate-spin" : ""}`}
            />
            <span className="hidden sm:inline">Aktualisieren</span>
          </button>
        </div>
      </div>

      {filtersOpen && (
        <section className="mb-4 rounded-lg border border-hair bg-paper p-3">
          {/* Freitext + Status + Sortierung */}
          <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative sm:col-span-2">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
              <input
                value={qIn}
                onChange={(e) => setQIn(e.target.value)}
                placeholder="Freitext: Marke, Modell, Jahr…"
                className={`${TEXT_IN} pl-7`}
              />
            </div>
            <Field label="Status / Vollständigkeit">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as CarStatusFilter)}
                className={TEXT_IN}
              >
                {CAR_STATUS_FILTERS.map((s) => (
                  <option key={s} value={s}>
                    {CAR_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Sortierung">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as CarSort)}
                className={TEXT_IN}
              >
                {CAR_SORTS.map((s) => (
                  <option key={s} value={s}>
                    {CAR_SORT_LABELS[s]}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {/* Farbe (Mehrfach) */}
          <div className="mb-3">
            <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-ink-400">
              Farbe (Mehrfach)
            </div>
            <div className="flex flex-wrap gap-1.5">
              {FARBE_OPTIONS.map((c) => {
                const on = farben.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleFarbe(c)}
                    className={`rounded-md border px-2.5 py-1 text-[12px] transition-colors ${
                      on
                        ? "border-ink-900 bg-ink-900 text-white"
                        : "border-hair bg-white text-ink-600 hover:bg-ink-50"
                    }`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Strukturierte Felder */}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            <Field label="Marke">
              <input
                value={marke}
                onChange={(e) => setMarke(e.target.value)}
                placeholder="z. B. BMW"
                className={TEXT_IN}
              />
            </Field>
            <Field label="Modell">
              <input
                value={modell}
                onChange={(e) => setModell(e.target.value)}
                placeholder="z. B. X3"
                className={TEXT_IN}
              />
            </Field>
            <Field label="Jahr (exakt)">
              <input
                value={jahr}
                onChange={(e) =>
                  setJahr(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))
                }
                inputMode="numeric"
                placeholder="2024"
                className={TEXT_IN}
              />
            </Field>
            <Field label="Jahr ab">
              <input
                value={jahrMin}
                onChange={(e) =>
                  setJahrMin(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))
                }
                inputMode="numeric"
                placeholder="2010"
                className={TEXT_IN}
              />
            </Field>
            <Field label="Jahr bis">
              <input
                value={jahrMax}
                onChange={(e) =>
                  setJahrMax(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))
                }
                inputMode="numeric"
                placeholder="2025"
                className={TEXT_IN}
              />
            </Field>
            <Field label="Ansichten min">
              <input
                value={viewsMin}
                onChange={(e) =>
                  setViewsMin(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))
                }
                inputMode="numeric"
                placeholder="8"
                className={TEXT_IN}
              />
            </Field>
            <Field label="Ansichten max">
              <input
                value={viewsMax}
                onChange={(e) =>
                  setViewsMax(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))
                }
                inputMode="numeric"
                placeholder="10"
                className={TEXT_IN}
              />
            </Field>
            <Field label="Body">
              <input
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className={TEXT_IN}
              />
            </Field>
            <Field label="Trim">
              <input
                value={trim}
                onChange={(e) => setTrim(e.target.value)}
                className={TEXT_IN}
              />
            </Field>
            <Field label="Farbe (Text)">
              <input
                value={farbe}
                onChange={(e) => setFarbe(e.target.value)}
                placeholder="z. B. black"
                className={TEXT_IN}
              />
            </Field>
            <Field label="Format">
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                className={TEXT_IN}
              >
                <option value="">alle</option>
                <option value="png">PNG</option>
                <option value="jpg">JPG</option>
              </select>
            </Field>
            <Field label="Resolution">
              <input
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                placeholder="z. B. default"
                className={TEXT_IN}
              />
            </Field>
            <Field label="Ansicht fehlt">
              <input
                value={viewMissing}
                onChange={(e) => setViewMissing(e.target.value)}
                placeholder="z. B. front_right"
                className={TEXT_IN}
              />
            </Field>
            <Field label="Stand ab (Datum)">
              <input
                type="date"
                value={updatedFrom}
                onChange={(e) => setUpdatedFrom(e.target.value)}
                className={TEXT_IN}
              />
            </Field>
            <Field label="Stand bis (Datum)">
              <input
                type="date"
                value={updatedTo}
                onChange={(e) => setUpdatedTo(e.target.value)}
                className={TEXT_IN}
              />
            </Field>
          </div>

          {activeFilters && (
            <div className="mt-3">
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 rounded-md border border-hair bg-white px-2.5 py-1.5 text-[12px] text-ink-600 hover:bg-ink-50"
              >
                <X className="h-3 w-3" />
                Filter zurücksetzen
              </button>
            </div>
          )}
        </section>
      )}

      {/* Tabelle */}
      <div className="overflow-x-auto rounded-lg border border-hair">
        <table className="min-w-full border-collapse">
          <thead className="bg-ink-50/60">
            <tr>
              <th className={TH}>Bild</th>
              <th className={TH}>Fahrzeug</th>
              <th className={TH}>Farben</th>
              <th className={TH}>Außen</th>
              <th className={TH}>Innen</th>
              <th className={TH}>Bilder</th>
              <th className={TH}>Status</th>
              <th className={TH}>Aktualisiert</th>
            </tr>
          </thead>
          <tbody>
            {listApi.loading && !list ? (
              <tr>
                <td className={`${TD} text-ink-400`} colSpan={8}>
                  Laden…
                </td>
              </tr>
            ) : list && list.rows.length > 0 ? (
              list.rows.map((r, i) => (
                <tr
                  key={`${r.marke}-${r.modell}-${r.jahr}-${r.body}-${r.trim}-${i}`}
                  onClick={() => setSelected(r)}
                  className="cursor-pointer border-t border-hair hover:bg-ink-50/40"
                  title="Details & alle Ansichten anzeigen"
                >
                  <td className={TD}>
                    <Thumb car={r} />
                  </td>
                  <td className={TD}>
                    <div className="font-medium text-ink-900">
                      {r.marke} {r.modell}
                    </div>
                    <div className="text-[11px] text-ink-500">
                      {r.jahr} · {r.body} · {r.trim}
                    </div>
                  </td>
                  <td className={TD}>
                    <span className="font-medium text-ink-900">
                      {fmtNumber(r.farben)}
                    </span>
                    <span className="text-ink-400">
                      {" "}
                      {r.farben === 1 ? "Farbe" : "Farben"}
                    </span>
                  </td>
                  <td className={TD}>
                    <AussenBadge n={r.aussen} />
                  </td>
                  <td className={TD}>
                    <InnenBadge n={r.innen} />
                  </td>
                  <td className={`${TD} tabular-nums text-ink-700`}>
                    {fmtNumber(r.images)}
                  </td>
                  <td className={TD}>
                    <div className="flex flex-wrap gap-1">
                      {r.fehler > 0 && (
                        <Badge tone="error">
                          <AlertTriangle className="h-3 w-3" />
                          {r.fehler}
                        </Badge>
                      )}
                      {r.hold > 0 && (
                        <Badge tone="hold">
                          <PauseCircle className="h-3 w-3" />
                          {r.hold}
                        </Badge>
                      )}
                      {r.nichtGerendert > 0 && (
                        <Badge tone="neutral">
                          {r.nichtGerendert} ungerendert
                        </Badge>
                      )}
                      {!r.hasTrp && (
                        <Badge tone="hold">keine Transparenz</Badge>
                      )}
                      {r.fehler === 0 &&
                        r.hold === 0 &&
                        r.nichtGerendert === 0 &&
                        r.hasTrp &&
                        r.aussen >= 8 && <Badge tone="done">ok</Badge>}
                    </div>
                  </td>
                  <td
                    className={`${TD} whitespace-nowrap text-[11px] text-ink-500`}
                  >
                    {fmtWhen(r.lastUpdated)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className={`${TD} text-ink-400`} colSpan={8}>
                  Keine Autos für diese Filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-3 flex items-center justify-between text-[12px] text-ink-500">
        <span className="tabular-nums">
          {total > 0
            ? `${fmtNumber(offset + 1)}–${fmtNumber(
                Math.min(offset + PAGE_SIZE, total),
              )} von ${fmtNumber(total)}`
            : "0 Autos"}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={offset === 0 || listApi.loading}
            onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
            className="inline-flex h-7 w-7 items-center justify-center rounded border border-hair bg-paper text-ink-600 disabled:opacity-40"
            aria-label="Vorherige Seite"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={offset + PAGE_SIZE >= total || listApi.loading}
            onClick={() => setOffset((o) => o + PAGE_SIZE)}
            className="inline-flex h-7 w-7 items-center justify-center rounded border border-hair bg-paper text-ink-600 disabled:opacity-40"
            aria-label="Nächste Seite"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {listApi.error && (
        <p className="mt-3 text-[12px] text-accent-rose">{listApi.error}</p>
      )}

      {selected && (
        <CarDetailModal car={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wider text-ink-400">
        {label}
      </span>
      {children}
    </label>
  );
}

function Badge({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "done" | "error" | "hold" | "neutral";
}) {
  const cls =
    tone === "done"
      ? "bg-emerald-500/10 text-emerald-700"
      : tone === "error"
        ? "bg-accent-rose/10 text-accent-rose"
        : tone === "hold"
          ? "bg-amber-500/10 text-amber-700"
          : "bg-ink-100 text-ink-500";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${cls}`}
    >
      {children}
    </span>
  );
}

function AussenBadge({ n }: { n: number }) {
  const complete = n >= 8;
  const cls = complete
    ? "bg-emerald-500/10 text-emerald-700"
    : n <= 0
      ? "bg-ink-100 text-ink-500"
      : "bg-amber-500/10 text-amber-700";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium tabular-nums ${cls}`}
      title={
        complete
          ? "Alle 8 Außen-Ansichten vorhanden"
          : `${n} von 8 Außen-Ansichten vorhanden`
      }
    >
      {!complete && <AlertTriangle className="h-3 w-3" />}
      {n}/8
    </span>
  );
}

function InnenBadge({ n }: { n: number }) {
  if (n <= 0) {
    return <span className="text-[11px] text-ink-300">—</span>;
  }
  const complete = n >= 2;
  const cls = complete
    ? "bg-emerald-500/10 text-emerald-700"
    : "bg-amber-500/10 text-amber-700";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium tabular-nums ${cls}`}
      title={`${n} von 2 Innen-Ansichten vorhanden`}
    >
      {!complete && <AlertTriangle className="h-3 w-3" />}
      {n}/2
    </span>
  );
}

function Thumb({ car }: { car: CarRow }) {
  const [failed, setFailed] = useState(false);
  const url = carThumbApiUrl(car, { view: "front_right", width: 160 });
  if (!url || failed) {
    return (
      <div className="grid h-12 w-16 place-items-center rounded border border-hair bg-ink-50">
        <ImageIcon className="h-4 w-4 text-ink-300" />
      </div>
    );
  }
  return (
    <img
      src={url}
      alt="front_right"
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className="h-12 w-16 rounded border border-hair bg-white object-contain"
    />
  );
}

// --- Detail-Ansicht (Modal) ---

const VIEW_ORDER = [
  "front",
  "front_right",
  "right",
  "rear_right",
  "rear",
  "rear_left",
  "left",
  "front_left",
  "top",
  "dashboard",
  "cockpit",
  "center_console",
  "interior",
  "trunk",
  "engine",
];
const VIEW_LABELS: Record<string, string> = {
  front: "Vorne",
  rear: "Hinten",
  left: "Links",
  right: "Rechts",
  front_left: "Vorne links",
  front_right: "Vorne rechts",
  rear_left: "Hinten links",
  rear_right: "Hinten rechts",
  top: "Oben",
  dashboard: "Cockpit",
  cockpit: "Cockpit",
  center_console: "Mittelkonsole",
  interior: "Innenraum",
  trunk: "Kofferraum",
  engine: "Motor",
};
function viewLabel(v: string): string {
  return VIEW_LABELS[v.toLowerCase()] ?? v;
}
function viewSortIndex(v: string): number {
  const i = VIEW_ORDER.indexOf(v.toLowerCase());
  return i === -1 ? 900 : i;
}

const DETAIL_STATUS: Record<CarDetailStatus, { label: string; cls: string }> = {
  done: { label: "fertig", cls: "bg-emerald-500/10 text-emerald-700" },
  open: { label: "offen", cls: "bg-brand-500/10 text-brand-700" },
  error: { label: "Fehler", cls: "bg-accent-rose/10 text-accent-rose" },
  hold: { label: "On Hold", cls: "bg-amber-500/10 text-amber-700" },
  not_rendered: { label: "nicht gerendert", cls: "bg-ink-100 text-ink-500" },
};

type Car5 = {
  marke: string;
  modell: string;
  jahr: number;
  body: string;
  trim: string;
  farbe: string;
};

function CarDetailModal({
  car,
  onClose,
}: {
  car: CarRow;
  onClose: () => void;
}) {
  const [farbe, setFarbe] = useState(car.farbe);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const detailApi = useApi<CarDetailResponse>(
    carDatabaseDetailUrl({
      marke: car.marke,
      modell: car.modell,
      jahr: car.jahr,
      body: car.body,
      trim: car.trim,
      farbe,
    }),
  );
  const detail = detailApi.data;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (lightbox) setLightbox(null);
      else onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lightbox, onClose]);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const views = useMemo(() => {
    const vs = detail?.views ?? [];
    return [...vs].sort(
      (a, b) =>
        viewSortIndex(a.view) - viewSortIndex(b.view) ||
        a.view.localeCompare(b.view),
    );
  }, [detail]);

  const car5: Car5 = {
    marke: car.marke,
    modell: car.modell,
    jahr: car.jahr,
    body: car.body,
    trim: car.trim,
    farbe,
  };
  const doneViews = views.filter((v) => v.status === "done").length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-900/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="my-6 w-full max-w-5xl rounded-xl border border-hair bg-paper shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-hair px-5 py-4">
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold text-ink-900">
              {car.marke} {car.modell}
            </div>
            <div className="mt-0.5 text-[12px] text-ink-500">
              {car.jahr} · {car.body} · {car.trim}
              {views.length > 0 && (
                <span className="ml-2 text-ink-400">
                  · {doneViews}/{views.length} Ansichten fertig
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-hair bg-paper text-ink-500 hover:bg-ink-50"
            aria-label="Schließen"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4">
          {detail && detail.colors.length > 0 && (
            <div className="mb-4">
              <div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.1em] text-ink-400">
                Farbe ({detail.colors.filter((c) => c.aktiv > 0).length}{" "}
                verfügbar / {detail.colors.length} gesamt)
              </div>
              <div className="flex flex-wrap gap-1.5">
                {detail.colors.map((c) => {
                  const act = c.farbe === farbe;
                  // „Verfügbar" = mind. ein aktives (live) Bild.
                  const available = c.aktiv > 0;
                  return (
                    <button
                      key={c.farbe}
                      type="button"
                      onClick={() => setFarbe(c.farbe)}
                      title={
                        available
                          ? `${c.aktiv} von ${c.images} Bildern aktiv`
                          : "Keine aktiven Bilder — Farbe nicht verfügbar"
                      }
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] transition-colors ${
                        act
                          ? "border-brand-500 bg-brand-500/10 text-brand-700"
                          : available
                            ? "border-hair bg-white text-ink-700 hover:border-ink-300 hover:bg-ink-50"
                            : "border-dashed border-hair bg-ink-50 text-ink-400"
                      }`}
                    >
                      <span
                        className={`font-medium ${
                          available ? "" : "line-through decoration-ink-300"
                        }`}
                      >
                        {c.farbe || "—"}
                      </span>
                      <span className={available ? "text-ink-400" : "text-ink-300"}>
                        {fmtNumber(c.aktiv)}/{fmtNumber(c.images)}
                      </span>
                      {!available && (
                        <span className="rounded bg-ink-200/70 px-1 text-[9px] font-medium uppercase tracking-wide text-ink-500">
                          n/v
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {detailApi.loading && !detail ? (
            <div className="py-10 text-center text-[12px] text-ink-400">
              Lädt Ansichten…
            </div>
          ) : views.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {views.map((v) => (
                <ViewCard
                  key={v.view}
                  car={car5}
                  v={v}
                  onOpen={() => setLightbox(v.view)}
                />
              ))}
            </div>
          ) : (
            <div className="py-10 text-center text-[12px] text-ink-400">
              Keine Ansichten für diese Farbe.
            </div>
          )}

          {detailApi.error && (
            <p className="mt-3 text-[12px] text-accent-rose">
              {detailApi.error}
            </p>
          )}
        </div>
      </div>

      {lightbox && (
        <Lightbox car={car5} view={lightbox} onClose={() => setLightbox(null)} />
      )}
    </div>
  );
}

function ViewCard({
  car,
  v,
  onOpen,
}: {
  car: Car5;
  v: CarDetailView;
  onOpen: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const url = carThumbApiUrl(car, { view: v.view, width: 400 });
  const st = DETAIL_STATUS[v.status];
  return (
    <div className="overflow-hidden rounded-lg border border-hair bg-white">
      <button
        type="button"
        onClick={onOpen}
        className="relative block aspect-[4/3] w-full bg-ink-50"
        title="Groß ansehen"
      >
        {url && !failed ? (
          <img
            src={url}
            alt={viewLabel(v.view)}
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
            className="h-full w-full object-contain"
          />
        ) : (
          <span className="grid h-full w-full place-items-center">
            <ImageIcon className="h-5 w-5 text-ink-300" />
          </span>
        )}
      </button>
      <div className="flex items-center justify-between gap-2 px-2 py-1.5">
        <span className="truncate text-[12px] font-medium text-ink-800">
          {viewLabel(v.view)}
        </span>
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${st.cls}`}
        >
          {st.label}
        </span>
      </div>
    </div>
  );
}

function Lightbox({
  car,
  view,
  onClose,
}: {
  car: Car5;
  view: string;
  onClose: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const url = carThumbApiUrl(car, { view, width: 1400 });
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink-900/85 p-6"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-md bg-white/10 text-white hover:bg-white/20"
        aria-label="Schließen"
      >
        <X className="h-5 w-5" />
      </button>
      <div
        className="flex max-h-[90vh] max-w-[92vw] flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        {url && !failed ? (
          <img
            src={url}
            alt={viewLabel(view)}
            onError={() => setFailed(true)}
            className="max-h-[84vh] max-w-[92vw] rounded-lg object-contain"
          />
        ) : (
          <div className="rounded-lg bg-paper px-10 py-14 text-center text-[13px] text-ink-500">
            Für diese Ansicht ist (noch) kein Bild verfügbar.
          </div>
        )}
        <div className="mt-2 text-center text-[12px] text-white/80">
          {viewLabel(view)} · {car.marke} {car.modell} {car.jahr}
        </div>
      </div>
    </div>
  );
}
