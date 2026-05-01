import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ImageIcon,
  RefreshCw,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../components/ui/PageHeader";
import { fmtNumber, useApi } from "../lib/customerApi";
import {
  type VehicleImageryListParams,
  type VehicleImageryListResponse,
  vehicleImageryListUrl,
} from "../lib/vehicleImageryPublicApi";
import { parseViewTokens } from "../lib/vehicleImageryUrl";

const PAGE_SIZE = 40;

const TEXT_IN =
  "w-full min-w-0 rounded border border-hair bg-white px-2 py-1.5 text-[12.5px] text-ink-800 focus:border-ink-400 focus:outline-none";
const TH = "px-2 py-2 text-left text-[10px] font-medium uppercase tracking-[0.1em] text-ink-400";
const TD = "px-2 py-2 align-top text-[12.5px] text-ink-800";
const LABEL =
  "mb-0.5 block text-[10.5px] font-medium uppercase tracking-wider text-ink-400";

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

export default function ProductionImagesPage() {
  const navigate = useNavigate();
  const [qIn, setQIn] = useState("");
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const [active, setActive] = useState<"all" | "0" | "1">("all");
  const [genehmigt, setGenehmigt] = useState<"all" | "0" | "1">("0");
  const [filtersOpen, setFiltersOpen] = useState(true);

  const [filterId, setFilterId] = useState("");
  const [marke, setMarke] = useState("");
  const [modell, setModell] = useState("");
  const [jahr, setJahr] = useState("");
  const [body, setBody] = useState("");
  const [trim, setTrim] = useState("");
  const [farbe, setFarbe] = useState("");
  const [resolution, setResolution] = useState("");
  const [format, setFormat] = useState("");
  const [updatedFrom, setUpdatedFrom] = useState("");
  const [updatedTo, setUpdatedTo] = useState("");

  const [applied, setApplied] = useState({
    filterId: "",
    marke: "",
    modell: "",
    jahr: "",
    body: "",
    trim: "",
    farbe: "",
    resolution: "",
    format: "",
    updatedFrom: "",
    updatedTo: "",
  });

  useEffect(() => {
    const t = setTimeout(() => setQ(qIn), 400);
    return () => clearTimeout(t);
  }, [qIn]);

  useEffect(() => {
    const t = setTimeout(() => {
      setApplied((a) => {
        if (
          a.filterId === filterId &&
          a.marke === marke &&
          a.modell === modell &&
          a.jahr === jahr &&
          a.body === body &&
          a.trim === trim &&
          a.farbe === farbe &&
          a.resolution === resolution &&
          a.format === format &&
          a.updatedFrom === updatedFrom &&
          a.updatedTo === updatedTo
        ) {
          return a;
        }
        return {
          filterId,
          marke,
          modell,
          jahr,
          body,
          trim,
          farbe,
          resolution,
          format,
          updatedFrom,
          updatedTo,
        };
      });
    }, 450);
    return () => clearTimeout(t);
  }, [
    filterId,
    marke,
    modell,
    jahr,
    body,
    trim,
    farbe,
    resolution,
    format,
    updatedFrom,
    updatedTo,
  ]);

  useEffect(() => {
    setOffset(0);
  }, [q, active, genehmigt, applied]);

  const listParams = useMemo((): VehicleImageryListParams => {
    const p: VehicleImageryListParams = {
      q,
      limit: PAGE_SIZE,
      offset,
      active,
      genehmigt,
    };
    if (applied.filterId.trim()) p.filter_id = applied.filterId.trim();
    if (applied.marke.trim()) p.marke = applied.marke.trim();
    if (applied.modell.trim()) p.modell = applied.modell.trim();
    if (applied.jahr.trim()) p.jahr = applied.jahr.trim();
    if (applied.body.trim()) p.body = applied.body.trim();
    if (applied.trim.trim()) p.trim = applied.trim.trim();
    if (applied.farbe.trim()) p.farbe = applied.farbe.trim();
    if (applied.resolution.trim()) p.resolution = applied.resolution.trim();
    if (applied.format.trim()) p.format = applied.format.trim();
    if (applied.updatedFrom.trim()) p.updated_from = applied.updatedFrom.trim();
    if (applied.updatedTo.trim()) p.updated_to = applied.updatedTo.trim();
    return p;
  }, [q, offset, active, genehmigt, applied]);

  const url = useMemo(() => vehicleImageryListUrl(listParams), [listParams]);
  const api = useApi<VehicleImageryListResponse>(url);

  const rows = api.data?.rows ?? [];
  const total = api.data?.total ?? 0;
  const limit = api.data?.limit ?? PAGE_SIZE;
  const cdnBase = (api.data?.cdnBase || "https://bildurl.vehicleimagery.com").replace(
    /\/$/,
    "",
  );

  const atEnd = offset + rows.length >= total;
  const pageLabel =
    total === 0
      ? "0 / 0"
      : `${offset + 1}–${offset + rows.length} / ${fmtNumber(total)}`;

  const clearStructFilters = () => {
    setFilterId("");
    setMarke("");
    setModell("");
    setJahr("");
    setBody("");
    setTrim("");
    setFarbe("");
    setResolution("");
    setFormat("");
    setUpdatedFrom("");
    setUpdatedTo("");
    setApplied({
      filterId: "",
      marke: "",
      modell: "",
      jahr: "",
      body: "",
      trim: "",
      farbe: "",
      resolution: "",
      format: "",
      updatedFrom: "",
      updatedTo: "",
    });
  };

  return (
    <div>
      <PageHeader
        eyebrow="Datenbanken"
        title="Produktions Images"
        hideCalendarAndNotifications
        description={
          <span>
            Tabelle{" "}
            <code className="font-mono text-[11.5px]">vehicleimagery_public_storage</code>
            <span className="text-ink-600">
              {" "}
              — Schwerpunkt Genehmigung (<code className="font-mono">genehmigt</code>
              ). Standard: nur Einträge mit{" "}
              <code className="font-mono">genehmigt = 0</code>.
            </span>
          </span>
        }
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-md border border-hair bg-white px-2.5 py-1.5 text-[12px] text-ink-700 hover:bg-ink-50"
            >
              {filtersOpen ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
              Filter
            </button>
            <button
              type="button"
              onClick={() => api.reload()}
              title="Aktualisieren"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-hair text-ink-500 hover:bg-ink-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${api.loading ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        }
      />

      {filtersOpen && (
        <section
          className="mb-5 rounded-lg border border-hair bg-paper/80 p-4 animate-fade-up"
          aria-label="Filter"
        >
          <div className="mb-4 flex flex-wrap items-end gap-4">
            <div className="w-full min-w-[200px] max-w-[360px]">
              <label className={LABEL}>Freitext (alle Spalten)</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
                <input
                  type="search"
                  className={`${TEXT_IN} pl-8`}
                  placeholder="z. B. abarth 2010"
                  value={qIn}
                  onChange={(e) => setQIn(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className={LABEL}>Aktiv</label>
              <div className="inline-flex overflow-hidden rounded-md border border-hair bg-white">
                {(
                  [
                    { id: "all" as const, label: "Alle" },
                    { id: "1" as const, label: "Nur aktiv" },
                    { id: "0" as const, label: "Nur inaktiv" },
                  ] as const
                ).map((o, i) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setActive(o.id)}
                    className={`px-2.5 py-1.5 text-[12px] transition-colors ${
                      active === o.id
                        ? "bg-ink-900 text-white"
                        : "text-ink-600 hover:bg-ink-50"
                    } ${i > 0 ? "border-l border-hair" : ""}`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={LABEL}>Genehmigt</label>
              <div className="inline-flex overflow-hidden rounded-md border border-hair bg-white">
                {(
                  [
                    { id: "0" as const, label: "Nur offen (0)" },
                    { id: "1" as const, label: "Nur ja (1)" },
                    { id: "all" as const, label: "Alle" },
                  ] as const
                ).map((o, i) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setGenehmigt(o.id)}
                    className={`px-2.5 py-1.5 text-[12px] transition-colors ${
                      genehmigt === o.id
                        ? "bg-ink-900 text-white"
                        : "text-ink-600 hover:bg-ink-50"
                    } ${i > 0 ? "border-l border-hair" : ""}`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <p className="mb-3 text-[11px] text-ink-500">
            Strukturierte Felder nutzen{" "}
            <code className="rounded bg-ink-100 px-1 font-mono text-[10px]">LIKE %…%</code>{" "}
            (Wildcards <code className="font-mono">%</code> und{" "}
            <code className="font-mono">_</code> in der Eingabe werden ignoriert). Datum bezieht
            sich auf <code className="font-mono">date(last_updated)</code> (UTC-Speicherung).
          </p>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            <div>
              <label className={LABEL}>ID</label>
              <input
                type="text"
                inputMode="numeric"
                className={TEXT_IN}
                placeholder="z. B. 42"
                value={filterId}
                onChange={(e) => setFilterId(e.target.value)}
              />
            </div>
            <div>
              <label className={LABEL}>Marke</label>
              <input
                className={TEXT_IN}
                placeholder="Abarth"
                value={marke}
                onChange={(e) => setMarke(e.target.value)}
              />
            </div>
            <div>
              <label className={LABEL}>Modell</label>
              <input
                className={TEXT_IN}
                placeholder="Punto"
                value={modell}
                onChange={(e) => setModell(e.target.value)}
              />
            </div>
            <div>
              <label className={LABEL}>Jahr</label>
              <input
                type="text"
                inputMode="numeric"
                className={TEXT_IN}
                placeholder="2010"
                value={jahr}
                onChange={(e) => setJahr(e.target.value)}
              />
            </div>
            <div>
              <label className={LABEL}>Body</label>
              <input className={TEXT_IN} value={body} onChange={(e) => setBody(e.target.value)} />
            </div>
            <div>
              <label className={LABEL}>Trim</label>
              <input className={TEXT_IN} value={trim} onChange={(e) => setTrim(e.target.value)} />
            </div>
            <div>
              <label className={LABEL}>Farbe</label>
              <input
                className={TEXT_IN}
                value={farbe}
                onChange={(e) => setFarbe(e.target.value)}
              />
            </div>
            <div>
              <label className={LABEL}>Resolution</label>
              <input
                className={TEXT_IN}
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
              />
            </div>
            <div>
              <label className={LABEL}>Format</label>
              <input
                className={TEXT_IN}
                value={format}
                onChange={(e) => setFormat(e.target.value)}
              />
            </div>
            <div>
              <label className={LABEL}>Stand ab (Datum)</label>
              <input
                type="date"
                className={TEXT_IN}
                value={updatedFrom}
                onChange={(e) => setUpdatedFrom(e.target.value)}
              />
            </div>
            <div>
              <label className={LABEL}>Stand bis (Datum)</label>
              <input
                type="date"
                className={TEXT_IN}
                value={updatedTo}
                onChange={(e) => setUpdatedTo(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={clearStructFilters}
              className="rounded-md border border-hair bg-white px-3 py-1.5 text-[12px] text-ink-700 hover:bg-ink-50"
            >
              Strukturierte Filter zurücksetzen
            </button>
          </div>
        </section>
      )}

      {api.error && (
        <p className="mb-4 rounded border border-accent-rose/30 bg-accent-rose/5 px-3 py-2 text-[12.5px] text-accent-rose">
          {api.error}
        </p>
      )}

      <p className="mb-2 text-[11.5px] text-ink-500">
        Zeile anklicken für die Detailseite mit Bildern (wie Produktions-Datenbank).
      </p>

      <div className="overflow-x-auto rounded-md border border-hair">
        <table className="min-w-[1080px] w-full text-left">
          <thead className="bg-paper">
            <tr>
              <th className={TH}>id</th>
              <th className={TH}>marke / modell</th>
              <th className={TH}>jahr</th>
              <th className={TH}>body</th>
              <th className={TH}>trim</th>
              <th className={TH}>farbe</th>
              <th className={TH}>format</th>
              <th className={TH}>aktiv</th>
              <th className={TH}>genehm.</th>
              <th className={TH}>stand</th>
              <th className={TH}>ansichten</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hair">
            {api.loading && rows.length === 0 ? (
              <tr>
                <td
                  colSpan={11}
                  className="px-2 py-10 text-center text-[13px] text-ink-400"
                >
                  Laden…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={11}
                  className="px-2 py-10 text-center text-[13px] text-ink-500"
                >
                  Keine Einträge.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const n = parseViewTokens(r.views).length;
                const g = r.genehmigt === 1 ? 1 : 0;
                return (
                  <tr
                    key={r.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/databases/production/${r.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigate(`/databases/production/${r.id}`);
                      }
                    }}
                    className="cursor-pointer hover:bg-ink-50/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink-400/40"
                  >
                    <td className={`${TD} font-mono tabular-nums text-ink-600`}>{r.id}</td>
                    <td className={TD}>
                      <div className="font-medium text-ink-900">{r.marke || "—"}</div>
                      <div className="line-clamp-2 font-mono text-[11px] text-ink-600">
                        {r.modell || "—"}
                      </div>
                    </td>
                    <td className={`${TD} tabular-nums`}>{r.jahr ?? "—"}</td>
                    <td className={TD}>{r.body || "—"}</td>
                    <td className={TD}>{r.trim || "—"}</td>
                    <td className={TD}>{r.farbe || "—"}</td>
                    <td className={`${TD} font-mono`}>{r.format || "—"}</td>
                    <td className={TD}>
                      {r.active === 1 ? (
                        <span className="text-brand-700">1</span>
                      ) : (
                        <span className="text-ink-400">0</span>
                      )}
                    </td>
                    <td className={TD}>
                      {g === 1 ? (
                        <span className="text-brand-700">1</span>
                      ) : (
                        <span className="text-ink-400">0</span>
                      )}
                    </td>
                    <td className={`${TD} whitespace-nowrap`}>{fmtWhen(r.last_updated)}</td>
                    <td className={TD}>
                      {n === 0 ? (
                        <span className="text-ink-400">0</span>
                      ) : (
                        <span className="text-brand-700">
                          {n} · <span className="text-ink-500">öffnen</span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-2 flex items-start gap-1.5 text-[10.5px] text-ink-500">
        <ImageIcon className="mt-0.5 h-3 w-3 shrink-0" />
        <span>
          CDN: <code className="font-mono text-ink-600">{cdnBase}</code>
        </span>
      </p>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-ink-600">
        <span className="tabular-nums">{pageLabel}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={offset === 0 || api.loading}
            onClick={() => setOffset((o) => Math.max(0, o - limit))}
            className="inline-flex h-8 items-center gap-0.5 rounded-md border border-hair px-2 text-ink-700 enabled:hover:bg-ink-50 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            Zurück
          </button>
          <button
            type="button"
            disabled={atEnd || api.loading}
            onClick={() => setOffset((o) => o + limit)}
            className="inline-flex h-8 items-center gap-0.5 rounded-md border border-hair px-2 text-ink-700 enabled:hover:bg-ink-50 disabled:opacity-40"
          >
            Weiter
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
