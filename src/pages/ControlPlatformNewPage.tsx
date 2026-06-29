import {
  Check,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  PauseCircle,
  RefreshCw,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Logo } from "../components/brand/Logo";
import { fmtNumber, useApi } from "../lib/customerApi";
import {
  type CarControlAction,
  type CarControlListResponse,
  type CarControlRow,
  carControlAction,
  carControlImageUrl,
  carControlListUrl,
} from "../lib/carControlApi";

const PAGE_SIZE = 60;

type CarGroup = {
  key: string;
  marke: string;
  modell: string;
  jahr: number;
  body: string;
  trim: string;
  farbe: string;
  rows: CarControlRow[];
};

function groupByCar(rows: CarControlRow[]): CarGroup[] {
  const map = new Map<string, CarGroup>();
  for (const r of rows) {
    const key = `${r.marke}|${r.modell}|${r.jahr}|${r.body}|${r.trim}|${r.farbe}`;
    let g = map.get(key);
    if (!g) {
      g = {
        key,
        marke: r.marke,
        modell: r.modell,
        jahr: r.jahr,
        body: r.body,
        trim: r.trim,
        farbe: r.farbe,
        rows: [],
      };
      map.set(key, g);
    }
    g.rows.push(r);
  }
  return [...map.values()];
}

export default function ControlPlatformNewPage() {
  const [qIn, setQIn] = useState("");
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Suche entprellen (kein Request pro Tastenanschlag).
  useEffect(() => {
    const t = setTimeout(() => setQ(qIn), 250);
    return () => clearTimeout(t);
  }, [qIn]);
  // Bei neuer Suche zurück auf Seite 1.
  useEffect(() => {
    setOffset(0);
  }, [q]);

  const listApi = useApi<CarControlListResponse>(
    carControlListUrl({ q, limit: PAGE_SIZE, offset }),
  );
  const data = listApi.data;
  const total = data?.total ?? 0;
  const groups = useMemo(() => groupByCar(data?.rows ?? []), [data]);

  const runAction = async (action: CarControlAction, ids: number[]) => {
    if (!ids.length || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await carControlAction(action, ids);
      const label =
        action === "approve"
          ? "freigegeben"
          : action === "hold"
            ? "auf Hold gesetzt"
            : action === "error"
              ? "als Fehler markiert"
              : "zurückgesetzt";
      setMsg(`${fmtNumber(r.changed)} ${label}.`);
      listApi.reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Aktion fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-paper text-ink-800">
      {/* Kopf mit Umschalter alt/neu */}
      <header className="flex h-11 shrink-0 items-center gap-3 border-b border-hair bg-paper px-3">
        <Link to="/" aria-label="Zur Plattform" className="shrink-0">
          <Logo className="h-[16px] w-auto text-ink-900" />
        </Link>
        <div className="min-w-0">
          <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-ink-400">
            Kontrolle
          </div>
          <div className="-mt-0.5 text-[13px] font-semibold text-ink-900">
            Neues System
          </div>
        </div>

        {/* Umschalter */}
        <div className="ml-2 inline-flex overflow-hidden rounded-md border border-hair text-[12px]">
          <Link
            to="/control-platform"
            className="px-2.5 py-1 text-ink-600 hover:bg-ink-50"
          >
            Altes System
          </Link>
          <span className="bg-brand-500/10 px-2.5 py-1 font-medium text-brand-700">
            Neues System
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-[12px] tabular-nums text-ink-500">
            {data
              ? total > 0
                ? `${fmtNumber(offset + 1)}–${fmtNumber(
                    Math.min(offset + PAGE_SIZE, total),
                  )} von ${fmtNumber(total)} offen`
                : "0 offen"
              : "…"}
          </span>
          <input
            value={qIn}
            onChange={(e) => setQIn(e.target.value)}
            placeholder="Suche…"
            className="h-7 w-36 rounded border border-hair bg-white px-2 text-[12px] focus:border-ink-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => listApi.reload()}
            className="inline-flex h-7 items-center gap-1 rounded border border-hair bg-paper px-2 text-[12px] text-ink-600 hover:bg-ink-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Aktualisieren
          </button>
        </div>
      </header>

      {msg && (
        <div className="shrink-0 border-b border-hair bg-emerald-50 px-3 py-1.5 text-[12px] text-emerald-800">
          {msg}
        </div>
      )}

      <main className="min-h-0 flex-1 overflow-y-auto p-3">
        {listApi.loading && !data ? (
          <p className="text-[13px] text-ink-400">Lädt…</p>
        ) : groups.length === 0 ? (
          <div className="mx-auto mt-16 max-w-md rounded-lg border border-hair bg-white p-6 text-center">
            <ImageIcon className="mx-auto h-6 w-6 text-ink-300" />
            <p className="mt-2 text-[13px] font-medium text-ink-700">
              Aktuell keine offenen Autos zur Kontrolle
            </p>
            <p className="mt-1 text-[12px] text-ink-500">
              Sobald neue Autos generiert werden (Status „offen", noch nicht
              freigegeben), erscheinen sie hier zum Prüfen der Quell-Bilder.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map((g) => (
              <CarControlCard
                key={g.key}
                group={g}
                busy={busy}
                onAction={runAction}
              />
            ))}
          </div>
        )}

        {total > PAGE_SIZE && (
          <div className="mt-4 flex items-center justify-center gap-2">
            <button
              type="button"
              disabled={offset === 0 || listApi.loading}
              onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
              className="inline-flex h-7 w-7 items-center justify-center rounded border border-hair bg-paper text-ink-600 disabled:opacity-40"
              aria-label="Vorherige Seite"
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
              aria-label="Nächste Seite"
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

function CarControlCard({
  group,
  busy,
  onAction,
}: {
  group: CarGroup;
  busy: boolean;
  onAction: (action: CarControlAction, ids: number[]) => void;
}) {
  const allIds = group.rows.map((r) => r.id);
  return (
    <div className="rounded-lg border border-hair bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-hair px-3 py-2">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-ink-900">
            {group.marke} {group.modell}
          </div>
          <div className="text-[11px] text-ink-500">
            {group.jahr} · {group.body} · {group.trim} · {group.farbe} ·{" "}
            {group.rows.length} Ansicht(en)
          </div>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => onAction("approve", allIds)}
          className="inline-flex shrink-0 items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-[12px] font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          <Check className="h-3.5 w-3.5" />
          Alle freigeben
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 lg:grid-cols-4">
        {group.rows.map((r) => (
          <ViewControlCard key={r.id} row={r} busy={busy} onAction={onAction} />
        ))}
      </div>
    </div>
  );
}

function ViewControlCard({
  row,
  busy,
  onAction,
}: {
  row: CarControlRow;
  busy: boolean;
  onAction: (action: CarControlAction, ids: number[]) => void;
}) {
  const [failed, setFailed] = useState(false);
  const url = carControlImageUrl(row.imageKey);
  return (
    <div className="overflow-hidden rounded-md border border-hair">
      <div className="relative aspect-[4/3] w-full bg-ink-50">
        {url && !failed ? (
          <img
            src={url}
            alt={row.view}
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
        {(row.fehler || row.hold) && (
          <span
            className={`absolute left-1 top-1 rounded px-1 py-0.5 text-[9px] font-medium ${
              row.fehler
                ? "bg-accent-rose/90 text-white"
                : "bg-amber-500/90 text-white"
            }`}
          >
            {row.fehler ? "Fehler" : "Hold"}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between gap-1 px-2 py-1">
        <span className="truncate text-[11px] font-medium text-ink-700">
          {row.view}
          {row.innen ? " (innen)" : ""}
        </span>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            disabled={busy}
            title="Freigeben"
            onClick={() => onAction("approve", [row.id])}
            className="grid h-6 w-6 place-items-center rounded text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={busy}
            title="Auf Hold"
            onClick={() => onAction("hold", [row.id])}
            className="grid h-6 w-6 place-items-center rounded text-amber-600 hover:bg-amber-50 disabled:opacity-50"
          >
            <PauseCircle className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={busy}
            title="Fehler markieren"
            onClick={() => onAction("error", [row.id])}
            className="grid h-6 w-6 place-items-center rounded text-accent-rose hover:bg-accent-rose/10 disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
