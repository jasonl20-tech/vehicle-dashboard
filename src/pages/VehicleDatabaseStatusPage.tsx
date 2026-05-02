import { AlertTriangle, BarChart3, ImageIcon, RefreshCw } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../components/ui/PageHeader";
import { fmtNumber, useApi } from "../lib/customerApi";
import {
  type VehicleImageryStatusResponse,
  VEHICLE_IMAGERY_STATUS_API,
} from "../lib/vehicleImageryPublicApi";

const TH = "px-2 py-2 text-left text-[10px] font-medium uppercase tracking-[0.1em] text-ink-400";
const TD = "px-2 py-2 align-top text-[12.5px] text-ink-800";

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

export default function VehicleDatabaseStatusPage() {
  const url = useMemo(() => VEHICLE_IMAGERY_STATUS_API, []);
  const api = useApi<VehicleImageryStatusResponse>(url);

  const d = api.data;
  const rows = d?.viewCoverage ?? [];
  const sample = d?.missingFarbeSample ?? [];

  return (
    <div>
      <PageHeader
        eyebrow="Datenbanken"
        title="Status"
        hideCalendarAndNotifications
        description={
          <span>
            Auswertung zu <code className="font-mono text-[11.5px]">vehicleimagery_public_storage</code>
            <span className="text-ink-600">
              {" "}
              für <strong className="text-ink-700">aktive</strong> Zeilen (
              <code className="font-mono">active = 1</code>): Ansichts-Abdeckung aus dem Feld{" "}
              <code className="font-mono">views</code> sowie Zeilen ohne Farbangabe.
            </span>
          </span>
        }
        rightSlot={
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
        }
      />

      {api.error && (
        <p className="mb-4 rounded border border-accent-rose/30 bg-accent-rose/5 px-3 py-2 text-[12.5px] text-accent-rose">
          {api.error}
        </p>
      )}

      {d && (
        <div className="mb-8 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-hair bg-paper px-4 py-3">
            <p className="text-[10.5px] font-medium uppercase tracking-wider text-ink-400">
              Aktive Zeilen
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-ink-900">
              {fmtNumber(d.activeRowCount)}
            </p>
          </div>
          <div className="rounded-lg border border-hair bg-paper px-4 py-3">
            <p className="text-[10.5px] font-medium uppercase tracking-wider text-ink-400">
              Ø Ansichten / Zeile
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-ink-900">
              {d.activeRowCount > 0 ? d.avgDistinctViewsPerRow.toFixed(1) : "—"}
            </p>
          </div>
          <div className="rounded-lg border border-hair bg-paper px-4 py-3">
            <p className="flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-wider text-ink-400">
              <AlertTriangle className="h-3 w-3 text-amber-600" />
              Ohne Farbe
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-amber-800">
              {fmtNumber(d.missingFarbeCount)}
            </p>
            <p className="mt-1 text-[11px] text-ink-500">leer oder nur Leerzeichen</p>
          </div>
        </div>
      )}

      <section className="mb-10">
        <h2 className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-ink-900">
          <BarChart3 className="h-4 w-4 text-ink-500" />
          Ansichts-Abdeckung
        </h2>
        <p className="mb-4 max-w-3xl text-[12.5px] leading-relaxed text-ink-500">
          Jeder Balken: Anteil der aktiven Zeilen, in denen diese Ansicht (Name vor{" "}
          <code className="font-mono text-[11px]">#</code> im Feld <code className="font-mono">views</code>
          ) vorkommt. Summiert nicht zu 100 %, weil Zeilen mehrere Ansichten haben können.
        </p>
        {api.loading && !d ? (
          <p className="text-[13px] text-ink-400">Laden…</p>
        ) : rows.length === 0 ? (
          <p className="text-[13px] text-ink-500">Keine Ansichtsdaten.</p>
        ) : (
          <ul className="space-y-2.5">
            {rows.map((r) => (
              <li key={r.name} className="rounded-md border border-hair bg-white px-3 py-2">
                <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-mono text-[12.5px] text-ink-900">{r.name}</span>
                  <span className="text-[11.5px] tabular-nums text-ink-500">
                    {fmtNumber(r.count)} · {r.pct}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-ink-100">
                  <div
                    className="h-full rounded-full bg-brand-700 transition-[width] duration-300"
                    style={{ width: `${Math.min(100, r.pct)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-ink-900">
          <ImageIcon className="h-4 w-4 text-ink-500" />
          Aktive Zeilen ohne Farbe
        </h2>
        <p className="mb-3 text-[12.5px] text-ink-500">
          Stichprobe (max. 80), sortiert nach <code className="font-mono text-[11px]">last_updated</code>.
          Details über die ID öffnen.
        </p>
        <div className="overflow-x-auto rounded-md border border-hair">
          <table className="min-w-[880px] w-full text-left">
            <thead className="bg-paper">
              <tr>
                <th className={TH}>id</th>
                <th className={TH}>marke / modell</th>
                <th className={TH}>jahr</th>
                <th className={TH}>body / trim</th>
                <th className={TH}>stand</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hair">
              {sample.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-2 py-8 text-center text-[13px] text-ink-500">
                    Keine Treffer — alle aktiven Zeilen haben eine Farbe gesetzt.
                  </td>
                </tr>
              ) : (
                sample.map((r) => (
                  <tr key={r.id} className="hover:bg-ink-50/50">
                    <td className={`${TD} font-mono tabular-nums`}>
                      <Link
                        to={`/dashboard/databases/production/${r.id}`}
                        className="text-brand-700 hover:underline"
                      >
                        {r.id}
                      </Link>
                    </td>
                    <td className={TD}>
                      <div className="font-medium">{r.marke || "—"}</div>
                      <div className="font-mono text-[11px] text-ink-600">{r.modell || "—"}</div>
                    </td>
                    <td className={`${TD} tabular-nums`}>{r.jahr ?? "—"}</td>
                    <td className={TD}>
                      <span className="text-ink-700">{r.body || "—"}</span>
                      <span className="text-ink-400"> / </span>
                      <span>{r.trim || "—"}</span>
                    </td>
                    <td className={`${TD} whitespace-nowrap`}>{fmtWhen(r.last_updated)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
