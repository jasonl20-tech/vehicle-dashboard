import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Logo } from "../components/brand/Logo";
import { fmtNumber, useApi } from "../lib/customerApi";

const PAGE_SIZE = 50;
const API = "/api/databases/vehicle-imagery-incomplete";

type Row = {
  publicId: number;
  marke: string;
  modell: string;
  jahr: number;
  body: string;
  trim: string;
  farbe: string;
  nExt: number;
  present: string[];
  missing: string[];
  controllingId: number | null;
};
type ListResp = { total: number; rows: Row[]; limit: number; offset: number };

export default function IncompleteVehiclesPage() {
  const [qIn, setQIn] = useState("");
  const [q, setQ] = useState("");
  const [onlyIncomplete, setOnlyIncomplete] = useState(true);
  const [offset, setOffset] = useState(0);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQ(qIn), 300);
    return () => clearTimeout(t);
  }, [qIn]);
  useEffect(() => {
    setOffset(0);
  }, [q, onlyIncomplete]);

  const url = useMemo(() => {
    const u = new URL(API, "https://x");
    if (q.trim()) u.searchParams.set("q", q.trim());
    u.searchParams.set("only", onlyIncomplete ? "incomplete" : "all");
    u.searchParams.set("limit", String(PAGE_SIZE));
    u.searchParams.set("offset", String(offset));
    return u.pathname + u.search;
  }, [q, onlyIncomplete, offset]);

  const listApi = useApi<ListResp>(url);
  const data = listApi.data;
  const total = data?.total ?? 0;

  const regenerate = async (row: Row) => {
    if (busyId || !row.controllingId || row.missing.length === 0) return;
    const ok = window.confirm(
      `${row.marke} ${row.modell} ${row.jahr}: ${row.missing.length} fehlende Ansicht(en) neu generieren?\n\n` +
        `Fehlt: ${row.missing.join(", ")}\n\n` +
        `Das legt Generier-Jobs an (läuft über die Pipeline → kie.ai, kostet Guthaben + dauert etwas). ` +
        `Danach werden die Ansichten neu live gestellt.`,
    );
    if (!ok) return;
    setBusyId(row.publicId);
    setMsg(null);
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          controllingId: row.controllingId,
          views: row.missing,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        inserted?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setMsg(
        `${row.marke} ${row.modell} ${row.jahr}: ${fmtNumber(
          j.inserted ?? 0,
        )} Generier-Job(s) angelegt.`,
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Fehler beim Anlegen.");
    } finally {
      setBusyId(null);
    }
  };

  const TH =
    "px-3 py-2 text-left text-[10px] font-medium uppercase tracking-[0.1em] text-ink-400";
  const TD = "px-3 py-2 align-middle text-[12.5px] text-ink-800";

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-paper text-ink-800">
      <header className="flex h-11 shrink-0 items-center gap-3 border-b border-hair bg-paper px-3">
        <Link to="/" aria-label="Zur Plattform" className="shrink-0">
          <Logo className="h-[16px] w-auto text-ink-900" />
        </Link>
        <div className="min-w-0">
          <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-ink-400">
            Live-Bestand
          </div>
          <div className="-mt-0.5 text-[13px] font-semibold text-ink-900">
            Unvollständige Autos · Nachgenerieren
          </div>
        </div>
        <Link
          to="/control-platform"
          className="ml-2 rounded border border-hair px-2.5 py-1 text-[12px] text-ink-600 hover:bg-ink-50"
        >
          ← Kontroll-Plattform
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-[12px] tabular-nums text-ink-500">
            {data
              ? total > 0
                ? `${fmtNumber(offset + 1)}–${fmtNumber(
                    Math.min(offset + PAGE_SIZE, total),
                  )} von ${fmtNumber(total)}`
                : "0 Autos"
              : "…"}
          </span>
          <label className="flex items-center gap-1 text-[12px] text-ink-600">
            <input
              type="checkbox"
              checked={onlyIncomplete}
              onChange={(e) => setOnlyIncomplete(e.target.checked)}
            />
            nur unvollständig
          </label>
          <input
            value={qIn}
            onChange={(e) => setQIn(e.target.value)}
            placeholder="Suche: Marke, Modell, Jahr…"
            className="h-7 w-52 rounded border border-hair bg-white px-2 text-[12px] focus:border-ink-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => listApi.reload()}
            className="inline-flex h-7 items-center gap-1 rounded border border-hair bg-paper px-2 text-[12px] text-ink-600 hover:bg-ink-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {msg && (
        <div className="shrink-0 border-b border-hair bg-emerald-50 px-3 py-1.5 text-[12px] text-emerald-800">
          {msg}
        </div>
      )}

      <main className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="overflow-x-auto rounded-lg border border-hair">
          <table className="min-w-full border-collapse">
            <thead className="bg-ink-50/60">
              <tr>
                <th className={TH}>Fahrzeug</th>
                <th className={TH}>Außen</th>
                <th className={TH}>Fehlende Ansichten</th>
                <th className={TH}>Controlling</th>
                <th className={TH}></th>
              </tr>
            </thead>
            <tbody>
              {listApi.loading && !data ? (
                <tr>
                  <td className={`${TD} text-ink-400`} colSpan={5}>
                    Laden…
                  </td>
                </tr>
              ) : data && data.rows.length > 0 ? (
                data.rows.map((r) => (
                  <tr
                    key={r.publicId}
                    className="border-t border-hair hover:bg-ink-50/40"
                  >
                    <td className={TD}>
                      <div className="font-medium text-ink-900">
                        {r.marke} {r.modell}
                      </div>
                      <div className="text-[11px] text-ink-500">
                        {r.jahr} · {r.body} · {r.trim} · {r.farbe}
                      </div>
                    </td>
                    <td className={TD}>
                      <span
                        className={`font-semibold tabular-nums ${
                          r.nExt >= 8
                            ? "text-emerald-600"
                            : r.nExt === 0
                              ? "text-accent-rose"
                              : "text-amber-600"
                        }`}
                      >
                        {r.nExt}/8
                      </span>
                    </td>
                    <td className={TD}>
                      {r.missing.length === 0 ? (
                        <span className="text-[11px] text-emerald-600">
                          vollständig
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {r.missing.map((v) => (
                            <span
                              key={v}
                              className="rounded bg-accent-rose/10 px-1.5 py-0.5 font-mono text-[10px] text-accent-rose"
                            >
                              {v}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className={TD}>
                      {r.controllingId ? (
                        <span className="text-[11px] text-emerald-600">
                          vorhanden
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-ink-400">
                          <AlertTriangle className="h-3 w-3" />
                          fehlt
                        </span>
                      )}
                    </td>
                    <td className={`${TD} text-right`}>
                      {r.missing.length > 0 && (
                        <button
                          type="button"
                          disabled={!r.controllingId || busyId === r.publicId}
                          onClick={() => void regenerate(r)}
                          title={
                            r.controllingId
                              ? "Fehlende Ansichten neu generieren"
                              : "Kein Controlling-Eintrag — erst über 'Auto erstellen' anlegen"
                          }
                          className="inline-flex items-center gap-1 rounded-md bg-ink-900 px-2.5 py-1 text-[12px] font-medium text-white hover:bg-ink-800 disabled:opacity-40"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          {busyId === r.publicId ? "…" : "Re-Generieren"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className={`${TD} text-ink-400`} colSpan={5}>
                    Keine Autos für diese Suche/Filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {total > PAGE_SIZE && (
          <div className="mt-3 flex items-center justify-center gap-2">
            <button
              type="button"
              disabled={offset === 0 || listApi.loading}
              onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
              className="inline-flex h-7 w-7 items-center justify-center rounded border border-hair bg-paper text-ink-600 disabled:opacity-40"
              aria-label="Zurück"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="text-[12px] tabular-nums text-ink-500">
              Seite {Math.floor(offset / PAGE_SIZE) + 1} /{" "}
              {Math.max(1, Math.ceil(total / PAGE_SIZE))}
            </span>
            <button
              type="button"
              disabled={offset + PAGE_SIZE >= total || listApi.loading}
              onClick={() => setOffset((o) => o + PAGE_SIZE)}
              className="inline-flex h-7 w-7 items-center justify-center rounded border border-hair bg-paper text-ink-600 disabled:opacity-40"
              aria-label="Weiter"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {listApi.error && (
          <p className="mt-3 text-[12px] text-accent-rose">{listApi.error}</p>
        )}
      </main>
    </div>
  );
}
