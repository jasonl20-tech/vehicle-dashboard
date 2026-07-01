import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Logo } from "../components/brand/Logo";
import { fmtNumber, useApi } from "../lib/customerApi";

const PAGE_SIZE = 50;
const LIST_API = "/api/databases/car-incomplete";

type Row = {
  marke: string;
  modell: string;
  jahr: number;
  body: string;
  trim: string;
  farbe: string;
  nExt: number;
  present: string[];
  missing: string[];
};
type ListResp = { total: number; rows: Row[]; limit: number; offset: number };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const carKey = (r: Row) =>
  `${r.marke}|${r.modell}|${r.jahr}|${r.body}|${r.trim}|${r.farbe}`;

/** Eine Ansicht über kie.ai generieren (Auftrag + pollen) → Bild-URL. */
async function generateView(
  car: { marke: string; modell: string; jahr: number; body: string; trim: string; farbe: string },
  view: string,
): Promise<string | null> {
  const res = await fetch("/api/databases/car-generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ ...car, view, useDbRefs: true }),
  });
  const j = (await res.json().catch(() => ({}))) as { taskId?: string };
  if (!res.ok || !j.taskId) return null;
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    await sleep(3000);
    const pr = await fetch(
      `/api/databases/car-generate?taskId=${encodeURIComponent(j.taskId)}`,
      { credentials: "include" },
    );
    const pj = (await pr.json().catch(() => ({}))) as {
      state?: string;
      imageUrl?: string | null;
    };
    if (pj.state === "success") return pj.imageUrl || null;
    if (pj.state === "fail") return null;
  }
  return null;
}

export default function IncompleteVehiclesNewPage() {
  const [qIn, setQIn] = useState("");
  const [q, setQ] = useState("");
  const [onlyIncomplete, setOnlyIncomplete] = useState(true);
  const [offset, setOffset] = useState(0);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQ(qIn), 300);
    return () => clearTimeout(t);
  }, [qIn]);
  useEffect(() => {
    setOffset(0);
  }, [q, onlyIncomplete]);

  const url = useMemo(() => {
    const u = new URL(LIST_API, "https://x");
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
    if (busyKey || row.missing.length === 0) return;
    const ok = window.confirm(
      `${row.marke} ${row.modell} ${row.jahr} (${row.farbe}): ${row.missing.length} fehlende Ansicht(en) neu generieren?\n\n` +
        `Fehlt: ${row.missing.join(", ")}\n\n` +
        `Das generiert über kie.ai (kostet Guthaben, dauert 1–3 Min je Ansicht) und übernimmt sie ins neue System zur Kontrolle.`,
    );
    if (!ok) return;
    setBusyKey(carKey(row));
    setMsg(`Generiere ${row.missing.length} Ansicht(en) für ${row.marke} ${row.modell}…`);
    const car = {
      marke: row.marke,
      modell: row.modell,
      jahr: row.jahr,
      body: row.body,
      trim: row.trim,
      farbe: row.farbe,
    };
    try {
      const gen = await Promise.all(
        row.missing.map(async (v) => ({
          view: v,
          imageUrl: await generateView(car, v),
        })),
      );
      const items = gen
        .filter((g) => g.imageUrl)
        .map((g) => ({ view: g.view, imageUrl: g.imageUrl as string }));
      if (items.length === 0) {
        setMsg(`${row.marke} ${row.modell}: Generierung fehlgeschlagen.`);
        return;
      }
      const res = await fetch("/api/databases/car-generate-save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...car, items }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        saved?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setMsg(
        `${row.marke} ${row.modell} ${row.jahr}: ${fmtNumber(
          j.saved ?? 0,
        )} Ansicht(en) generiert + in „Kontrolle (neu)" übernommen.`,
      );
      listApi.reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Fehler.");
    } finally {
      setBusyKey(null);
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
            Neues System
          </div>
          <div className="-mt-0.5 text-[13px] font-semibold text-ink-900">
            Unvollständige Autos · Nachgenerieren
          </div>
        </div>
        <Link
          to="/control-platform/neu"
          className="ml-2 rounded border border-hair px-2.5 py-1 text-[12px] text-ink-600 hover:bg-ink-50"
        >
          ← Kontrolle (neu)
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
                <th className={TH}></th>
              </tr>
            </thead>
            <tbody>
              {listApi.loading && !data ? (
                <tr>
                  <td className={`${TD} text-ink-400`} colSpan={4}>
                    Laden…
                  </td>
                </tr>
              ) : data && data.rows.length > 0 ? (
                data.rows.map((r) => {
                  const k = carKey(r);
                  return (
                    <tr
                      key={k}
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
                      <td className={`${TD} text-right`}>
                        {r.missing.length > 0 && (
                          <button
                            type="button"
                            disabled={busyKey !== null}
                            onClick={() => void regenerate(r)}
                            className="inline-flex items-center gap-1 rounded-md bg-ink-900 px-2.5 py-1 text-[12px] font-medium text-white hover:bg-ink-800 disabled:opacity-40"
                          >
                            {busyKey === k ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Sparkles className="h-3.5 w-3.5" />
                            )}
                            {busyKey === k ? "…" : "Neu generieren"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className={`${TD} text-ink-400`} colSpan={4}>
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
