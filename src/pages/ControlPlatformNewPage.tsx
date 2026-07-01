import {
  Check,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  Loader2,
  Pause,
  Radio,
  RefreshCw,
  RotateCcw,
  X,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Logo } from "../components/brand/Logo";
import {
  type CarControlAction,
  type CarControlDetailResponse,
  type CarControlDetailView,
  type CarControlVariant,
  type CarControlVariantsResponse,
  type CarVariantIdentity,
  type CarVariantSort,
  type CarVariantStatusFilter,
  carControlAction,
  carControlDetailUrl,
  carControlImageUrl,
  carControlVariantsUrl,
  regenerateView,
  variantKey,
} from "../lib/carControlApi";
import { fmtNumber, useApi } from "../lib/customerApi";
import ControlPlatformLightbox from "./ControlPlatformLightbox";

const PAGE_SIZE = 50;

/** Auto-Umriss von oben (gespiegelt): Spalte 1 = rechte Seite, Mitte = vorne/
 *  hinten, Spalte 3 = linke Seite. null = leere Mittelzelle. */
const OUTLINE: (string | null)[][] = [
  ["front_right", "front", "front_left"],
  ["right", null, "left"],
  ["rear_right", "rear", "rear_left"],
];
const EXTERIOR = new Set(OUTLINE.flat().filter(Boolean) as string[]);

const VIEW_LABEL: Record<string, string> = {
  front: "Front",
  rear: "Heck",
  left: "Links",
  right: "Rechts",
  front_left: "Vorne links",
  front_right: "Vorne rechts",
  rear_left: "Hinten links",
  rear_right: "Hinten rechts",
  dashboard: "Armaturenbrett",
  center_console: "Mittelkonsole",
};
const label = (v: string) => VIEW_LABEL[v] || v;

type Tone = "approved" | "error" | "hold" | "open";
const STATUS_STYLE: Record<Tone, { ring: string; tag: string; text: string }> = {
  approved: {
    ring: "ring-2 ring-emerald-400",
    tag: "bg-emerald-100 text-emerald-700",
    text: "freigegeben",
  },
  error: {
    ring: "ring-2 ring-rose-400",
    tag: "bg-rose-100 text-rose-700",
    text: "Fehler",
  },
  hold: {
    ring: "ring-2 ring-amber-400",
    tag: "bg-amber-100 text-amber-700",
    text: "Hold",
  },
  open: {
    ring: "ring-1 ring-hair",
    tag: "bg-ink-100 text-ink-600",
    text: "offen",
  },
};

const SORTS: { v: CarVariantSort; label: string }[] = [
  { v: "open_desc", label: "Offen zuerst" },
  { v: "updated_desc", label: "Zuletzt geändert" },
  { v: "approved_desc", label: "Freigegeben zuerst" },
  { v: "hold_desc", label: "Hold zuerst" },
  { v: "error_desc", label: "Fehler zuerst" },
  { v: "total_desc", label: "Meiste Ansichten" },
  { v: "marke", label: "Marke A–Z" },
];
const STATUS_FILTERS: { v: CarVariantStatusFilter; label: string }[] = [
  { v: "open", label: "Offen" },
  { v: "open_ext", label: "Nur außen offen" },
  { v: "open_int", label: "Innen offen" },
  { v: "error", label: "Fehler" },
  { v: "hold", label: "Hold" },
  { v: "done", label: "Fertig" },
  { v: "all", label: "Alle" },
];
const LIVE_MS = [1000, 3000, 5000, 10000, 30000];

const ACTION_LABEL: Record<CarControlAction, string> = {
  approve: "freigegeben",
  hold: "auf Hold",
  error: "als Fehler markiert",
  reset: "zurückgesetzt",
  delete: "gelöscht",
};

function lsGet(k: string, fb: string): string {
  try {
    return localStorage.getItem(k) ?? fb;
  } catch {
    return fb;
  }
}

/** Mehrsegmentiger Fortschrittsbalken (freigegeben/Fehler/Hold/offen). */
function ProgressBar({ v }: { v: CarControlVariant }) {
  const total = Math.max(1, v.total);
  const seg = (n: number, cls: string) =>
    n > 0 ? (
      <div className={cls} style={{ width: `${(n / total) * 100}%` }} />
    ) : null;
  return (
    <div className="mt-1 flex h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
      {seg(v.approved, "bg-emerald-500")}
      {seg(v.error, "bg-rose-500")}
      {seg(v.hold, "bg-amber-500")}
      {seg(v.open, "bg-ink-300")}
    </div>
  );
}

function variantTone(v: CarControlVariant): Tone {
  if (v.error > 0) return "error";
  if (v.open > 0) return "open";
  if (v.hold > 0) return "hold";
  return "approved";
}

export default function ControlPlatformNewPage() {
  const [qIn, setQIn] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<CarVariantStatusFilter>(() => {
    const v = lsGet("cpNeu.status", "open");
    return STATUS_FILTERS.some((s) => s.v === v)
      ? (v as CarVariantStatusFilter)
      : "open";
  });
  const [sort, setSort] = useState<CarVariantSort>(() => {
    const v = lsGet("cpNeu.sort", "open_desc");
    return SORTS.some((s) => s.v === v) ? (v as CarVariantSort) : "open_desc";
  });
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<CarVariantIdentity | null>(null);

  const [liveOn, setLiveOn] = useState(() => lsGet("cpNeu.live.on", "0") === "1");
  const [liveMs, setLiveMs] = useState(() => {
    const v = Number(lsGet("cpNeu.live.ms", "5000"));
    return LIVE_MS.includes(v) ? v : 5000;
  });
  const [easyMode, setEasyMode] = useState(() => lsGet("cpNeu.easy", "0") === "1");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [lightboxView, setLightboxView] = useState<string | null>(null);
  // Welche Ansichten gerade neu generiert werden (Schlüssel = variantKey|view).
  // Auf Seiten-Ebene, damit die Sperre Lightbox-Öffnen/-Schließen überlebt.
  const [regenerating, setRegenerating] = useState<Set<string>>(
    () => new Set(),
  );
  const [genMsg, setGenMsg] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQ(qIn), 350);
    return () => clearTimeout(t);
  }, [qIn]);
  useEffect(() => {
    setOffset(0);
    setSelected(null); // bei Filter-/Sortierwechsel erste Variante neu wählen
  }, [q, status, sort]);
  useEffect(() => {
    try {
      localStorage.setItem("cpNeu.live.on", liveOn ? "1" : "0");
      localStorage.setItem("cpNeu.live.ms", String(liveMs));
      localStorage.setItem("cpNeu.status", status);
      localStorage.setItem("cpNeu.sort", sort);
      localStorage.setItem("cpNeu.easy", easyMode ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [liveOn, liveMs, status, sort, easyMode]);

  const pollMs = liveOn ? liveMs : 0;

  const listUrl = useMemo(
    () => carControlVariantsUrl({ q, status, sort, limit: PAGE_SIZE, offset }),
    [q, status, sort, offset],
  );
  const listApi = useApi<CarControlVariantsResponse>(listUrl, { pollMs });
  const rows = listApi.data?.rows ?? [];
  const total = listApi.data?.total ?? 0;
  const remaining = listApi.data?.remaining ?? 0;

  // Erste Variante automatisch wählen.
  useEffect(() => {
    if (!selected && rows.length > 0) setSelected(rows[0]);
  }, [rows, selected]);

  const detailUrl = useMemo(() => carControlDetailUrl(selected), [selected]);
  const detailApi = useApi<CarControlDetailResponse>(detailUrl, { pollMs });
  const detail = detailApi.data;

  const reloadBoth = () => {
    listApi.reload();
    detailApi.reload();
  };

  const act = async (action: CarControlAction, ids: number[]) => {
    if (busy || ids.length === 0) return;
    if (action === "delete") {
      if (!window.confirm(`${ids.length} Bild(er) wirklich löschen?`)) return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const r = await carControlAction(action, ids);
      setMsg(`${r.changed} ${ACTION_LABEL[action]}.`);
      reloadBoth();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Fehler.");
    } finally {
      setBusy(false);
    }
  };

  // Neu-Generieren einer Ansicht — auf Seiten-Ebene, damit die Sperre bestehen
  // bleibt, auch wenn die Lightbox zwischendurch geschlossen/geöffnet wird.
  const regenerate = async (
    id: CarVariantIdentity,
    view: string,
    replaceId?: number,
  ) => {
    const key = `${variantKey(id)}|${view}`;
    // schon in Arbeit (lokal ODER laut DB) → gesperrt
    if (regenerating.has(key) || (detail?.generatingViews ?? []).includes(view))
      return;
    setRegenerating((s) => new Set(s).add(key));
    setGenMsg(`Generiere „${view}" für ${id.marke} ${id.modell} …`);
    try {
      const ok = await regenerateView(id, view, replaceId);
      setGenMsg(ok ? `„${view}" fertig.` : `„${view}": fehlgeschlagen.`);
      reloadBoth(); // immer: bei Erfolg neues Bild, bei Fehler gelöste Sperre

    } catch (e) {
      setGenMsg(e instanceof Error ? e.message : "Fehler.");
    } finally {
      setRegenerating((s) => {
        const n = new Set(s);
        n.delete(key);
        return n;
      });
    }
  };
  const dbGenerating = detail?.generatingViews ?? [];
  const isRegenView = (view: string) =>
    (!!selected && regenerating.has(`${variantKey(selected)}|${view}`)) ||
    dbGenerating.includes(view);

  // Detail-Raster aufbauen.
  const viewMap = useMemo(() => {
    const m = new Map<string, CarControlDetailView>();
    for (const v of detail?.views ?? []) m.set(v.view, v);
    return m;
  }, [detail]);
  const supplemental = useMemo(
    () => (detail?.views ?? []).filter((v) => !EXTERIOR.has(v.view)),
    [detail],
  );
  const openIds = (detail?.views ?? [])
    .filter((v) => v.status === "open")
    .map((v) => v.id);

  const selectedTitle = selected ? `${selected.marke} ${selected.modell}` : "—";

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-paper text-ink-800">
      {/* Header */}
      <header className="flex h-10 shrink-0 items-center gap-3 border-b border-hair bg-paper px-3">
        <Link to="/" aria-label="Zur Plattform" className="shrink-0">
          <Logo className="h-[15px] w-auto text-ink-900" />
        </Link>
        <div className="ml-1 inline-flex overflow-hidden rounded-md border border-hair text-[12px]">
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
        <Link
          to="/control-platform/neu/unvollstaendig"
          className="shrink-0 rounded border border-hair px-2.5 py-1 text-[12px] text-ink-600 hover:bg-ink-50"
          title="Autos mit fehlenden Außen-Ansichten suchen + nachgenerieren"
        >
          Unvollständig
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLiveOn((s) => !s)}
            className={`inline-flex h-7 items-center gap-1.5 rounded border px-2 text-[12px] ${
              liveOn
                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                : "border-hair bg-paper text-ink-600 hover:bg-ink-50"
            }`}
            title="Automatisch aktualisieren"
          >
            <Radio className={`h-3.5 w-3.5 ${liveOn ? "animate-pulse" : ""}`} />
            Live
          </button>
          <select
            value={liveMs}
            onChange={(e) => setLiveMs(Number(e.target.value))}
            disabled={!liveOn}
            className="h-7 rounded border border-hair bg-white px-1 text-[12px] disabled:opacity-40"
          >
            {LIVE_MS.map((ms) => (
              <option key={ms} value={ms}>
                {ms / 1000}s
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={reloadBoth}
            className="inline-flex h-7 items-center gap-1 rounded border border-hair bg-paper px-2 text-[12px] text-ink-600 hover:bg-ink-50"
            title="Aktualisieren"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      <main className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        {/* LINKS: Varianten-Liste */}
        <aside className="flex h-full w-[270px] shrink-0 flex-col border-r border-hair">
          <div className="shrink-0 space-y-2 border-b border-hair p-2">
            <input
              type="search"
              value={qIn}
              onChange={(e) => setQIn(e.target.value)}
              placeholder="Suche: Marke, Modell…"
              className="h-8 w-full rounded border border-hair bg-white px-2 text-[12px] focus:border-ink-400 focus:outline-none"
            />
            <div className="flex gap-2">
              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as CarVariantStatusFilter)
                }
                className="h-7 min-w-0 flex-1 rounded border border-hair bg-white px-1 text-[12px]"
              >
                {STATUS_FILTERS.map((s) => (
                  <option key={s.v} value={s.v}>
                    {s.label}
                  </option>
                ))}
              </select>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as CarVariantSort)}
                className="h-7 min-w-0 flex-1 rounded border border-hair bg-white px-1 text-[12px]"
              >
                {SORTS.map((s) => (
                  <option key={s.v} value={s.v}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-between text-[11px] text-ink-500">
              <span className="tabular-nums">
                {listApi.data
                  ? `${
                      total > 0
                        ? `${fmtNumber(offset + 1)}–${fmtNumber(
                            Math.min(offset + PAGE_SIZE, total),
                          )} / ${fmtNumber(total)}`
                        : "0"
                    }${remaining > 0 ? ` · offen ${fmtNumber(remaining)}` : ""}`
                  : "…"}
              </span>
              <span className="flex gap-1">
                <button
                  type="button"
                  disabled={offset === 0}
                  onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
                  className="inline-flex h-6 w-6 items-center justify-center rounded border border-hair disabled:opacity-30"
                  aria-label="Zurück"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={offset + PAGE_SIZE >= total}
                  onClick={() => setOffset((o) => o + PAGE_SIZE)}
                  className="inline-flex h-6 w-6 items-center justify-center rounded border border-hair disabled:opacity-30"
                  aria-label="Weiter"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </span>
            </div>
          </div>

          <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {listApi.loading && !listApi.data ? (
              <li className="p-3 text-[12px] text-ink-400">Laden…</li>
            ) : rows.length === 0 ? (
              <li className="p-3 text-[12px] text-ink-400">
                Keine Varianten für diesen Filter.
              </li>
            ) : (
              rows.map((v) => {
                const k = variantKey(v);
                const active = selected && variantKey(selected) === k;
                const tone = variantTone(v);
                return (
                  <li key={k}>
                    <button
                      type="button"
                      onClick={() => setSelected(v)}
                      title={`${v.approved} freigegeben · ${v.open} offen · ${v.error} Fehler · ${v.hold} Hold · gesamt ${v.total}`}
                      className={`block w-full border-b border-hair px-2.5 py-2 text-left hover:bg-ink-50 ${
                        active ? "bg-ink-50" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[12.5px] font-medium text-ink-900">
                          {v.marke} {v.modell}
                        </span>
                        <span
                          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${STATUS_STYLE[tone].tag}`}
                          title={STATUS_STYLE[tone].text}
                        >
                          {STATUS_STYLE[tone].text} · {v.approved}/{v.total}
                        </span>
                      </div>
                      <div className="truncate text-[11px] text-ink-500">
                        {v.jahr} · {v.body} · {v.trim} · {v.farbe}
                      </div>
                      <ProgressBar v={v} />
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </aside>

        {/* MITTE: Bild-Bühne */}
        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center gap-3 border-b border-hair px-3 py-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="truncate text-[14px] font-semibold text-ink-900">
                  {selectedTitle}
                </div>
                {selected && (
                  <a
                    href={`/car-database/eintraege?marke=${encodeURIComponent(
                      selected.marke,
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 text-[11px] text-brand-600 hover:underline"
                    title="In der Car-Database öffnen"
                  >
                    DB ↗
                  </a>
                )}
              </div>
              {selected && (
                <div className="truncate text-[11px] text-ink-500">
                  {selected.jahr} · {selected.body} · {selected.trim} ·{" "}
                  {selected.farbe}
                </div>
              )}
            </div>
            {detail && (
              <div className="ml-auto flex items-center gap-2">
                <span className="text-[12px] text-ink-500">
                  {detail.views.filter((v) => v.approved).length}/
                  {detail.views.length} freigegeben
                </span>
                <button
                  type="button"
                  disabled={busy || openIds.length === 0}
                  onClick={() => void act("approve", openIds)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Alle offenen freigeben ({openIds.length})
                </button>
              </div>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {!selected ? (
              <div className="grid h-full place-items-center text-[13px] text-ink-400">
                Links eine Variante wählen.
              </div>
            ) : detailApi.loading && !detail ? (
              <div className="grid h-full place-items-center text-ink-300">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : detail ? (
              <>
                {/* Außen-Umriss */}
                <div className="mx-auto grid max-w-3xl grid-cols-3 gap-2.5">
                  {OUTLINE.flat().map((view, i) => {
                    if (view === null)
                      return (
                        <div key={`empty-${i}`} className="hidden sm:block" />
                      );
                    const vo = viewMap.get(view);
                    return (
                      <ViewTile
                        key={view}
                        view={view}
                        vo={vo}
                        busy={busy}
                        generating={isRegenView(view)}
                        onAct={act}
                        onOpen={setLightboxView}
                      />
                    );
                  })}
                </div>

                {/* Innen + Zusatz */}
                {(supplemental.length > 0 || detail.missingInt.length > 0) && (
                  <>
                    <div className="mx-auto mt-5 max-w-3xl text-[11px] font-medium uppercase tracking-[0.1em] text-ink-400">
                      Innen / Zusatz
                    </div>
                    <div className="mx-auto mt-2 grid max-w-3xl grid-cols-3 gap-2.5">
                      {supplemental.map((vo) => (
                        <ViewTile
                          key={vo.view}
                          view={vo.view}
                          vo={vo}
                          busy={busy}
                          generating={isRegenView(vo.view)}
                          onAct={act}
                          onOpen={setLightboxView}
                        />
                      ))}
                      {detail.missingInt.map((view) => (
                        <ViewTile
                          key={view}
                          view={view}
                          busy={busy}
                          generating={isRegenView(view)}
                          onAct={act}
                          onOpen={setLightboxView}
                        />
                      ))}
                    </div>
                  </>
                )}

                {detail.missingExt.length > 0 && (
                  <p className="mx-auto mt-4 max-w-3xl text-[11px] text-amber-600">
                    Fehlende Außen-Ansichten ({detail.missingExt.length}):{" "}
                    {detail.missingExt.map(label).join(", ")} — über{" "}
                    <Link
                      to="/control-platform/neu/unvollstaendig"
                      className="underline"
                    >
                      Unvollständig
                    </Link>{" "}
                    nachgenerieren.
                  </p>
                )}
              </>
            ) : (
              <div className="grid h-full place-items-center text-[13px] text-ink-400">
                Keine Ansichten.
              </div>
            )}
          </div>
        </section>
      </main>

      {lightboxView && detail && (
        <ControlPlatformLightbox
          identity={detail.identity}
          views={detail.views}
          missingExt={detail.missingExt}
          missingInt={detail.missingInt}
          startView={lightboxView}
          busy={busy}
          variants={rows}
          easyMode={easyMode}
          regenerating={regenerating}
          generatingViews={detail.generatingViews ?? []}
          genMsg={genMsg}
          onToggleEasy={() => setEasyMode((s) => !s)}
          onSwitchVariant={(id) => setSelected(id)}
          onRegen={regenerate}
          onClose={() => setLightboxView(null)}
          onAct={act}
        />
      )}

      {(regenerating.size > 0 || msg || genMsg) && (
        <div className="flex shrink-0 items-center gap-2 border-t border-hair bg-ink-900 px-3 py-1.5 text-[12px] text-white">
          {regenerating.size > 0 && (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
          )}
          <span className="truncate">
            {regenerating.size > 0
              ? (genMsg ??
                `${regenerating.size} Ansicht(en) werden generiert…`)
              : (msg ?? genMsg)}
          </span>
        </div>
      )}
    </div>
  );
}

/* ── Eine Ansicht-Kachel (Bild + Status + Inline-Aktionen) ── */
function ViewTile({
  view,
  vo,
  busy,
  generating,
  onAct,
  onOpen,
}: {
  view: string;
  vo?: CarControlDetailView;
  busy: boolean;
  generating?: boolean;
  onAct: (action: CarControlAction, ids: number[]) => void;
  onOpen?: (view: string) => void;
}) {
  const tone: Tone = (vo?.status as Tone) ?? "open";
  const src = vo ? carControlImageUrl(vo.imageKey) : null;
  const [imgError, setImgError] = useState(false);

  return (
    <div
      className={`overflow-hidden rounded-md bg-white ${STATUS_STYLE[tone].ring}`}
    >
      <button
        type="button"
        onClick={() => onOpen?.(view)}
        title="Groß öffnen"
        className="relative grid aspect-[3/2] w-full cursor-zoom-in place-items-center bg-ink-50"
      >
        {vo && src && !imgError ? (
          <img
            src={src}
            alt={view}
            loading="lazy"
            decoding="async"
            onError={() => setImgError(true)}
            className="h-full w-full object-contain"
          />
        ) : vo ? (
          <ImageIcon className="h-5 w-5 text-ink-300" />
        ) : (
          <span className="text-[11px] text-ink-300">fehlt</span>
        )}
        {vo && (
          <span
            className={`absolute left-1 top-1 rounded px-1.5 py-0.5 text-[9px] font-medium ${STATUS_STYLE[tone].tag}`}
          >
            {STATUS_STYLE[tone].text}
          </span>
        )}
        {generating && (
          <span className="absolute inset-0 grid place-items-center gap-1 bg-white/75 text-[10px] text-ink-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            wird generiert
          </span>
        )}
      </button>
      <div className="flex items-center justify-between gap-1 px-1.5 py-1">
        <span className="truncate text-[11px] font-medium text-ink-700">
          {label(view)}
        </span>
        {vo && !generating && (
          <div className="flex shrink-0 items-center gap-0.5">
            <TileBtn
              title="Freigeben"
              disabled={busy || vo.approved}
              onClick={() => onAct("approve", [vo.id])}
              cls="text-emerald-600 hover:bg-emerald-50"
            >
              <Check className="h-3.5 w-3.5" />
            </TileBtn>
            <TileBtn
              title="Auf Hold"
              disabled={busy || vo.hold || vo.approved}
              onClick={() => onAct("hold", [vo.id])}
              cls="text-amber-600 hover:bg-amber-50"
            >
              <Pause className="h-3.5 w-3.5" />
            </TileBtn>
            <TileBtn
              title="Fehler markieren"
              disabled={busy || vo.fehler || vo.approved}
              onClick={() => onAct("error", [vo.id])}
              cls="text-rose-600 hover:bg-rose-50"
            >
              <X className="h-3.5 w-3.5" />
            </TileBtn>
            <TileBtn
              title="Zurücksetzen (offen)"
              disabled={busy || vo.status === "open"}
              onClick={() => onAct("reset", [vo.id])}
              cls="text-ink-500 hover:bg-ink-100"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </TileBtn>
          </div>
        )}
      </div>
    </div>
  );
}

function TileBtn({
  title,
  disabled,
  onClick,
  cls,
  children,
}: {
  title: string;
  disabled: boolean;
  onClick: () => void;
  cls: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-6 w-6 items-center justify-center rounded disabled:opacity-25 ${cls}`}
    >
      {children}
    </button>
  );
}
