import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ImageIcon,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "../components/ui/PageHeader";
import { fmtNumber, useApi } from "../lib/customerApi";
import {
  type VehicleImageryListResponse,
  type VehicleImageryPublicRow,
  vehicleImageryListUrl,
} from "../lib/vehicleImageryPublicApi";
import { buildVehicleImageUrl, parseViewTokens } from "../lib/vehicleImageryUrl";

const PAGE_SIZE = 40;

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

const TEXT_IN =
  "w-full min-w-0 rounded border border-hair bg-white px-2 py-1.5 text-[12.5px] text-ink-800 focus:border-ink-400 focus:outline-none";
const TH = "px-2 py-2 text-left text-[10px] font-medium uppercase tracking-[0.1em] text-ink-400";
const TD = "px-2 py-2 align-top text-[12.5px] text-ink-800";

export default function ProductionDatabasePage() {
  const [qIn, setQIn] = useState("");
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const [active, setActive] = useState<"all" | "0" | "1">("all");
  const [openRow, setOpenRow] = useState<VehicleImageryPublicRow | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQ(qIn), 400);
    return () => clearTimeout(t);
  }, [qIn]);

  useEffect(() => {
    setOffset(0);
  }, [q, active]);

  const url = useMemo(
    () => vehicleImageryListUrl({ q, limit: PAGE_SIZE, offset, active }),
    [q, offset, active],
  );
  const api = useApi<VehicleImageryListResponse>(url);

  const rows = api.data?.rows ?? [];
  const total = api.data?.total ?? 0;
  const limit = api.data?.limit ?? PAGE_SIZE;
  const cdnBase = (api.data?.cdnBase || "https://bildurl.vehicleimagery.com").replace(
    /\/$/,
    "",
  );
  const imageUrlQuery = api.data?.imageUrlQuery ?? "";

  const atEnd = offset + rows.length >= total;
  const pageLabel =
    total === 0
      ? "0 / 0"
      : `${offset + 1}–${offset + rows.length} / ${fmtNumber(total)}`;

  const closeDetail = useCallback(() => setOpenRow(null), []);

  return (
    <div>
      <PageHeader
        eyebrow="Datenbanken"
        title="Produktions-Datenbank"
        description={
          <span>
            Tabelle{" "}
            <code className="font-mono text-[11.5px]">vehicleimagery_public_storage</code>
            <span className="text-ink-600"> (D1 </span>
            <span className="font-mono text-[11.5px]">vehicledatabase</span>
            <span className="text-ink-600">). Bild-URLs: </span>
            <code className="whitespace-nowrap break-all font-mono text-[11px] text-ink-700">
              …/v1/…/ansicht
            </code>
            <span className="text-ink-600"> plus Query aus dem Worker.</span>
          </span>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-full min-w-[200px] max-w-[360px]">
          <label className="mb-0.5 block text-[10.5px] font-medium uppercase tracking-wider text-ink-400">
            Suche
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
            <input
              type="search"
              className={`${TEXT_IN} pl-8`}
              placeholder="Marke, Modell, Jahr, Body, …"
              value={qIn}
              onChange={(e) => setQIn(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="mb-0.5 block text-[10.5px] font-medium uppercase tracking-wider text-ink-400">
            Status
          </label>
          <div className="inline-flex overflow-hidden rounded-md border border-hair bg-white">
            {(
              [
                { id: "all" as const, label: "Alle" },
                { id: "1" as const, label: "Aktiv" },
                { id: "0" as const, label: "Inaktiv" },
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
        <button
          type="button"
          onClick={() => api.reload()}
          title="Aktualisieren"
          className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-md border border-hair text-ink-500 hover:bg-ink-50"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${api.loading ? "animate-spin" : ""}`}
          />
        </button>
      </div>

      {api.error && (
        <p className="mb-4 rounded border border-accent-rose/30 bg-accent-rose/5 px-3 py-2 text-[12.5px] text-accent-rose">
          {api.error}
        </p>
      )}

      <p className="mb-2 text-[11.5px] text-ink-500">
        Zeile anklicken, um <strong className="text-ink-700">Bilder &amp; URLs</strong>{" "}
        zu öffnen (keine Vorschau in der Tabelle).
      </p>

      <div className="overflow-x-auto rounded-md border border-hair">
        <table className="min-w-[1000px] w-full text-left">
          <thead className="bg-paper">
            <tr>
              <th className={TH}>id</th>
              <th className={TH}>marke / modell</th>
              <th className={TH}>jahr</th>
              <th className={TH}>body</th>
              <th className={TH}>trim</th>
              <th className={TH}>farbe</th>
              <th className={TH}>format</th>
              <th className={TH}>res.</th>
              <th className={TH}>aktiv</th>
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
                return (
                  <tr
                    key={r.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setOpenRow(r)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setOpenRow(r);
                      }
                    }}
                    className="cursor-pointer hover:bg-ink-50/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink-400/40"
                  >
                    <td className={`${TD} font-mono tabular-nums text-ink-600`}>
                      {r.id}
                    </td>
                    <td className={TD}>
                      <div className="font-medium text-ink-900">
                        {r.marke || "—"}
                      </div>
                      <div className="line-clamp-2 font-mono text-[11px] text-ink-600">
                        {r.modell || "—"}
                      </div>
                    </td>
                    <td className={`${TD} tabular-nums`}>{r.jahr ?? "—"}</td>
                    <td className={TD}>{r.body || "—"}</td>
                    <td className={TD}>{r.trim || "—"}</td>
                    <td className={TD}>{r.farbe || "—"}</td>
                    <td className={`${TD} font-mono`}>{r.format || "—"}</td>
                    <td className={`${TD} font-mono`}>{r.resolution || "—"}</td>
                    <td className={TD}>
                      {r.active === 1 ? (
                        <span className="text-brand-700">1</span>
                      ) : (
                        <span className="text-ink-400">0</span>
                      )}
                    </td>
                    <td className={`${TD} whitespace-nowrap`}>
                      {fmtWhen(r.last_updated)}
                    </td>
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

      {openRow && (
        <VehicleImageryDetailDrawer
          row={openRow}
          cdnBase={cdnBase}
          imageUrlQuery={imageUrlQuery}
          onClose={closeDetail}
        />
      )}
    </div>
  );
}

function VehicleImageryDetailDrawer({
  row,
  cdnBase,
  imageUrlQuery,
  onClose,
}: {
  row: VehicleImageryPublicRow;
  cdnBase: string;
  imageUrlQuery: string;
  onClose: () => void;
}) {
  const views = parseViewTokens(row.views);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex"
      role="dialog"
      aria-modal="true"
      aria-label="Fahrzeugbilder"
    >
      <button
        type="button"
        aria-label="Schließen"
        onClick={onClose}
        className="flex-1 cursor-default bg-night-900/40 backdrop-blur-sm"
      />
      <aside className="flex w-full max-w-[min(100vw,720px)] flex-col overflow-hidden bg-paper shadow-2xl animate-[drawerIn_0.22s_ease-out]">
        <div className="flex items-start justify-between gap-3 border-b border-hair px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <p className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-ink-400">
              {row.marke || "—"} · id {row.id}
            </p>
            <p className="mt-0.5 truncate text-[15px] font-medium text-ink-900" title={row.modell ?? ""}>
              {row.modell || "—"} · {row.jahr ?? "—"}
            </p>
            <p className="mt-0.5 text-[12px] text-ink-600">
              {row.body} / {row.trim} / {row.farbe} · {row.format} · {row.resolution}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-hair text-ink-500 hover:text-ink-900"
            title="Schließen (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {views.length === 0 ? (
            <p className="text-[13px] text-ink-500">
              Keine Ansichten — Feld <code className="font-mono text-ink-600">views</code>{" "}
              leer.
            </p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {views.map((v) => {
                const href = buildVehicleImageUrl(cdnBase, row, v, imageUrlQuery);
                return (
                  <li
                    key={v}
                    className="overflow-hidden rounded-lg border border-hair bg-ink-50/40"
                  >
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="block border-b border-hair bg-paper p-1.5 text-[10.5px] text-brand-600 hover:underline"
                    >
                      <span className="font-mono break-all">{v}</span>
                      <ExternalLink className="ml-1 inline h-2.5 w-2.5" />
                    </a>
                    <div className="grid place-items-center p-2">
                      <img
                        src={href}
                        alt={v}
                        loading="lazy"
                        className="max-h-48 w-full object-contain"
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}
