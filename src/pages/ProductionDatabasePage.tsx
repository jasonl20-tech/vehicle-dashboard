import { ChevronLeft, ChevronRight, ExternalLink, ImageIcon, RefreshCw, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import PageHeader from "../components/ui/PageHeader";
import { fmtNumber, useApi } from "../lib/customerApi";
import {
  type VehicleImageryListResponse,
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

  const atEnd = offset + rows.length >= total;
  const pageLabel =
    total === 0
      ? "0 / 0"
      : `${offset + 1}–${offset + rows.length} / ${fmtNumber(total)}`;

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
            <span className="text-ink-600">
              ). Bild-URLs:{" "}
            </span>
            <code className="whitespace-nowrap break-all font-mono text-[11px] text-ink-700">
              …/v1/format/resolution/marke/modell/jahr/body/trim/farbe/ansicht
            </code>
          </span>
        }
      />

      {api.data?.hasImageUrlSecret && (
        <p className="mb-3 text-[11.5px] text-ink-500">
          <code className="font-mono">image_url_secret</code> ist im Worker gebunden
          (wird nur serverseitig genutzt, nicht ausgeliefert).
        </p>
      )}

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

      <div className="overflow-x-auto rounded-md border border-hair">
        <table className="min-w-[1200px] w-full text-left">
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
              <th className={TH}>vorschau</th>
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
                const views = parseViewTokens(r.views);
                return (
                  <tr key={r.id} className="hover:bg-ink-50/40">
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
                    <td className={`${TD} max-w-[min(100vw,32rem)]`}>
                      {views.length === 0 ? (
                        <span className="text-ink-400">—</span>
                      ) : (
                        <div className="flex max-w-full gap-1.5 overflow-x-auto pb-1">
                          {views.slice(0, 12).map((v) => {
                            const href = buildVehicleImageUrl(cdnBase, r, v);
                            return (
                              <a
                                key={v}
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={v}
                                className="group relative flex h-16 w-20 shrink-0 items-center justify-center overflow-hidden rounded border border-hair bg-ink-50/50"
                              >
                                <img
                                  src={href}
                                  alt={v}
                                  loading="lazy"
                                  className="max-h-16 w-auto object-contain"
                                />
                                <span className="absolute right-0.5 top-0.5 rounded bg-night-900/50 p-0.5 text-white opacity-0 group-hover:opacity-100">
                                  <ExternalLink className="h-3 w-3" />
                                </span>
                              </a>
                            );
                          })}
                          {views.length > 12 && (
                            <span className="self-center text-[10px] text-ink-400">
                              +{views.length - 12} weitere
                            </span>
                          )}
                        </div>
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
          Pro Zeile bis zu 12 Vorschaubilder; vollständige View-Liste in der Spalte
          Suche über das Feld <strong className="text-ink-600">views</strong> in
          der Tabelle. CDN:{" "}
          <code className="font-mono text-ink-600">{cdnBase}</code>
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
