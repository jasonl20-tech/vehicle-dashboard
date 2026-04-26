import { ChevronLeft, ChevronRight, RefreshCw, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import PageHeader from "../components/ui/PageHeader";
import {
  controllJobsListUrl,
  type ControllJobCheck,
  type ControllJobsListResponse,
} from "../lib/controllJobsApi";
import { fmtNumber, useApi } from "../lib/customerApi";

const PAGE_SIZE = 50;

const CHECK_FILTERS: { id: ControllJobCheck; label: string; desc: string }[] = [
  { id: "all", label: "Alle", desc: "alle Einträge" },
  { id: "0", label: "Offen", desc: "noch zu erledigen" },
  { id: "1", label: "In Arbeit", desc: "werden bearbeitet" },
  { id: "2", label: "Korrekt", desc: "erledigt / ok" },
  { id: "3", label: "Fehler", desc: "fehlgeschlagen" },
];

function jobCheckLabel(n: number): string {
  if (n === 0) return "Offen";
  if (n === 1) return "In Arbeit";
  if (n === 2) return "Korrekt";
  if (n === 3) return "Fehler";
  return String(n);
}

function jobCheckClass(n: number): string {
  if (n === 0) return "bg-ink-100 text-ink-700";
  if (n === 1) return "bg-accent-amber/15 text-accent-amber";
  if (n === 2) return "bg-brand-100 text-brand-800";
  if (n === 3) return "bg-accent-rose/10 text-accent-rose";
  return "bg-ink-100 text-ink-600";
}

function fmtWhen(s: string | null | undefined): string {
  if (!s?.trim()) return "—";
  const t = s.includes("T") ? Date.parse(s) : Date.parse(s.replace(" ", "T") + "Z");
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
const TD = "px-2 py-2 align-top text-[12.5px] text-ink-800 max-w-0";

export default function ControllJobsPage() {
  const [check, setCheck] = useState<ControllJobCheck>("all");
  const [vehicleId, setVehicleId] = useState("");
  const [qIn, setQIn] = useState("");
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setQ(qIn), 400);
    return () => clearTimeout(t);
  }, [qIn]);

  useEffect(() => {
    setOffset(0);
  }, [check, q, vehicleId]);

  const url = useMemo(
    () =>
      controllJobsListUrl({
        check,
        vehicleId,
        q,
        limit: PAGE_SIZE,
        offset,
      }),
    [check, vehicleId, q, offset],
  );
  const api = useApi<ControllJobsListResponse>(url);

  const { rows, total, limit, checkCounts } = {
    rows: api.data?.rows ?? [],
    total: api.data?.total ?? 0,
    limit: api.data?.limit ?? PAGE_SIZE,
    checkCounts: api.data?.checkCounts ?? {},
  };

  const atEnd = offset + rows.length >= total;
  const pageLabel = useMemo(() => {
    if (total === 0) return "0 / 0";
    const from = total === 0 ? 0 : offset + 1;
    const to = offset + rows.length;
    return `${from}–${to} / ${fmtNumber(total)}`;
  }, [total, offset, rows.length]);

  const countFor = (id: ControllJobCheck) => {
    if (id === "all") {
      return Object.values(checkCounts).reduce((a, b) => a + b, 0);
    }
    return checkCounts[id] ?? 0;
  };

  return (
    <div>
      <PageHeader
        eyebrow="Intern Analytics"
        title="Job Übersicht"
        description={
          <span>
            <span className="text-ink-600">Tabelle</span>{" "}
            <code className="font-mono text-[11.5px]">controll_status</code>
            <span className="text-ink-600"> (D1 </span>
            <span className="font-mono text-[11.5px]">vehicledatabase</span>
            <span className="text-ink-600">) — Korrektur- und Skalierungs-Jobs.</span>
          </span>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {CHECK_FILTERS.map((f) => {
          const active = check === f.id;
          const n = countFor(f.id);
          return (
            <button
              key={f.id}
              type="button"
              title={f.desc}
              onClick={() => setCheck(f.id)}
              className={`rounded-md border px-2.5 py-1.5 text-[12px] transition-colors ${
                active
                  ? "border-ink-800 bg-ink-900 text-white"
                  : "border-hair bg-white text-ink-700 hover:bg-ink-50"
              }`}
            >
              {f.label}
              <span
                className={`ml-1.5 font-mono text-[10.5px] tabular-nums ${
                  active ? "text-ink-200" : "text-ink-400"
                }`}
              >
                {fmtNumber(n)}
              </span>
            </button>
          );
        })}

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

      <p className="mb-2 text-[11.5px] text-ink-500">
        Status <span className="font-mono">check</span>:{" "}
        <strong className="text-ink-700">0</strong> offen ·{" "}
        <strong className="text-ink-700">1</strong> in Arbeit ·{" "}
        <strong className="text-ink-700">2</strong> korrekt ·{" "}
        <strong className="text-ink-700">3</strong> fehlgeschlagen
      </p>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-full min-w-[200px] max-w-[320px]">
          <label className="mb-0.5 block text-[10.5px] font-medium uppercase tracking-wider text-ink-400">
            Suche
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
            <input
              type="search"
              className={`${TEXT_IN} pl-8`}
              placeholder="Vehicle-ID, View, Modus, Status, Pfad…"
              value={qIn}
              onChange={(e) => setQIn(e.target.value)}
            />
          </div>
        </div>
        <div className="w-40">
          <label className="mb-0.5 block text-[10.5px] font-medium uppercase tracking-wider text-ink-400">
            Fahrzeug-ID
          </label>
          <input
            className={TEXT_IN}
            inputMode="numeric"
            placeholder="optional"
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value.replace(/\D/g, ""))}
          />
        </div>
      </div>

      {api.error && (
        <p className="mb-4 rounded border border-accent-rose/30 bg-accent-rose/5 px-3 py-2 text-[12.5px] text-accent-rose">
          {api.error}
        </p>
      )}

      <div className="overflow-x-auto rounded-md border border-hair">
        <table className="min-w-full table-fixed text-left">
          <thead className="bg-paper">
            <tr>
              <th className={TH} style={{ width: "4.5rem" }}>
                check
              </th>
              <th className={TH} style={{ width: "5.5rem" }}>
                vehicle
              </th>
              <th className={TH} style={{ width: "5rem" }}>
                view
              </th>
              <th className={TH} style={{ width: "5.5rem" }}>
                modus
              </th>
              <th className={TH} style={{ width: "6.5rem" }}>
                status
              </th>
              <th className={TH} style={{ width: "8.5rem" }}>
                aktualisiert
              </th>
              <th className={TH}>key / pfad</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hair">
            {api.loading && rows.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-2 py-10 text-center text-[13px] text-ink-400"
                >
                  Laden…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-2 py-10 text-center text-[13px] text-ink-500"
                >
                  Keine Einträge.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="hover:bg-ink-50/40">
                  <td className={TD}>
                    <span
                      className={`inline-block rounded px-1.5 py-0.5 text-[10.5px] font-medium ${jobCheckClass(r.job_check)}`}
                      title={jobCheckLabel(r.job_check)}
                    >
                      {r.job_check} · {jobCheckLabel(r.job_check)}
                    </span>
                  </td>
                  <td className={`${TD} font-mono tabular-nums`}>
                    {fmtNumber(r.vehicle_id)}
                  </td>
                  <td className={`${TD} font-mono`}>{r.view_token}</td>
                  <td className={TD}>{r.mode}</td>
                  <td className={TD}>{r.status}</td>
                  <td className={`${TD} whitespace-nowrap`}>
                    {fmtWhen(r.updated_at)}
                  </td>
                  <td className={TD} title={r.key ?? ""}>
                    <span className="line-clamp-2 break-all font-mono text-[11px] text-ink-700">
                      {r.key || "—"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

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
