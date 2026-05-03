import { AlertCircle, RefreshCw } from "lucide-react";
import { useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  type ControllingBlob4Mode,
  type ControllingByMode,
  type ControllingResponse,
  controllingApiUrl,
} from "../lib/controllingApi";
import {
  PRESETS,
  type Range,
  aeTimestampToDate,
  fmtNumber,
  fmtRelative,
  rangeFromPreset,
  toAeTimestamp,
  useApi,
} from "../lib/customerApi";

// ---------- Format Helpers ----------

function fmtHours(h: number | null | undefined): string {
  if (h == null || !Number.isFinite(h)) return "–";
  if (h <= 0) return "0";
  if (h < 1 / 60) return `${Math.round(h * 3600)} s`;
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 24) return `${h.toFixed(1)} h`;
  if (h < 24 * 14) return `${(h / 24).toFixed(1)} Tage`;
  return `${(h / (24 * 7)).toFixed(1)} Wo.`;
}

function fmtDuration(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec)) return "–";
  if (sec <= 0) return "0";
  if (sec < 60) return `${Math.round(sec)} s`;
  if (sec < 3600) return `${(sec / 60).toFixed(1)} min`;
  if (sec < 86400) return `${(sec / 3600).toFixed(1)} h`;
  return `${(sec / 86400).toFixed(1)} Tage`;
}

function fmtRate(v: number | null | undefined, unit = "/h"): string {
  if (v == null || !Number.isFinite(v)) return "–";
  if (v < 1) return `${v.toFixed(2)} ${unit}`;
  if (v < 100) return `${v.toFixed(1)} ${unit}`;
  return `${fmtNumber(v, { maximumFractionDigits: 0 })} ${unit}`;
}

function bucketLabel(s: string): string {
  try {
    const d = aeTimestampToDate(s);
    return new Intl.DateTimeFormat("de-DE", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    }).format(d);
  } catch {
    return s;
  }
}

// ---------- Page ----------

export default function ControllingPage() {
  const [range, setRange] = useState<Range>(() => rangeFromPreset("7d"));
  const [gapMinutes, setGapMinutes] = useState(5);
  const [blob4, setBlob4] = useState<ControllingBlob4Mode>("nonempty");

  const url = useMemo(
    () => controllingApiUrl(range, { gapMinutes, blob4, limit: 100_000 }),
    [range, gapMinutes, blob4],
  );

  const { data, error, loading, reload } = useApi<ControllingResponse>(url);

  return (
    <>
      <Header
        range={range}
        onRange={setRange}
        gapMinutes={gapMinutes}
        onGap={setGapMinutes}
        blob4={blob4}
        onBlob4={setBlob4}
        onReload={reload}
        loading={loading}
        sourceLabel={
          data?.ae?.fromMode === "key_analytics_filter"
            ? `${data.ae.fromTable} · dataset = ${data.dataset}`
            : data?.ae?.fromTable ?? "controll_platform_logs"
        }
      />

      <ErrorBanner msg={error} />

      {data?.truncated && (
        <p className="mb-8 border-l-2 border-accent-amber px-3 py-2 text-[12px] text-accent-amber">
          Anzahl Zeilen erreicht das Limit ({fmtNumber(data.rowLimit)}). Zeitraum
          verkürzen für genaue Auswertung.
        </p>
      )}

      <KpiGrid data={data} loading={loading} />

      <Section
        title="Verbleibend · Tempo · Prognose"
        meta="Pro Modus: aktuell offen, Fortschritt, Geschwindigkeit (Bilder/h) und ETA wenn das Tempo so weiterläuft. Bestandswerte vor 2026-05-03 19:15:58 mit > 1000 werden ignoriert (Datenbereinigung)."
      >
        <ForecastGrid rows={data?.byMode ?? []} loading={loading} />
      </Section>

      <Section
        title="Aktivität, Fortschritt & Prognose über Zeit"
        meta="Events, aktive Nutzer, bearbeitete/neu hinzugekommene Bilder sowie eine Prognoselinie für den verbleibenden Bestand pro Tag, extrapoliert mit dem aktuellen Tempo bis 0."
      >
        <Timeline data={data} loading={loading} />
      </Section>

      <Section
        title="Pro Modus"
        meta="blob3 = Modus (Korrektur, Ausschneiden, …) – ETA mit und ohne Nachschub"
      >
        <ModeBlocks rows={data?.byMode ?? []} loading={loading} />
      </Section>

    </>
  );
}

// ---------- Header ----------

function Header({
  range,
  onRange,
  gapMinutes,
  onGap,
  blob4,
  onBlob4,
  onReload,
  loading,
  sourceLabel,
}: {
  range: Range;
  onRange: (r: Range) => void;
  gapMinutes: number;
  onGap: (n: number) => void;
  blob4: ControllingBlob4Mode;
  onBlob4: (m: ControllingBlob4Mode) => void;
  onReload: () => void;
  loading: boolean;
  sourceLabel: string;
}) {
  return (
    <header
      aria-label="Controlling"
      className="mb-6 border-b border-hair pb-4 animate-fade-down"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="max-w-3xl text-[13px] leading-relaxed text-ink-500">
          Auswertung der Plattform-Logs aus{" "}
          <span className="font-mono text-[12px] text-ink-700">
            {sourceLabel}
          </span>
          . Fortschritt aus{" "}
          <span className="font-mono text-[12px] text-ink-700">double2</span>{" "}
          (offen) und{" "}
          <span className="font-mono text-[12px] text-ink-700">double3</span>{" "}
          (gesamt) je Modus, Sessions ab&nbsp;{gapMinutes}&nbsp;min Pause.
        </p>
        <button
          type="button"
          onClick={onReload}
          title="Aktualisieren"
          className="press inline-flex h-8 w-8 items-center justify-center rounded-md border border-hair bg-white text-ink-500 transition-colors hover:border-ink-300 hover:text-ink-800"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>
      <RangeBar range={range} onChange={onRange} />
      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] text-ink-500">
        <label className="flex items-center gap-1.5">
          <span>Session-Pause</span>
          <input
            type="number"
            min={1}
            max={120}
            value={gapMinutes}
            onChange={(e) => onGap(Number(e.target.value) || 5)}
            className="w-14 rounded-md border border-hair bg-white px-1.5 py-1 font-mono text-[12px] text-ink-800 focus:border-ink-400 focus:outline-none"
          />
          <span>min</span>
        </label>
        <label className="flex items-center gap-1.5">
          <span>blob4-Filter</span>
          <select
            value={blob4}
            onChange={(e) => onBlob4(e.target.value as ControllingBlob4Mode)}
            className="rounded-md border border-hair bg-white px-2 py-1 text-[12px] text-ink-800 focus:border-ink-400 focus:outline-none"
          >
            <option value="nonempty">nicht leer</option>
            <option value="hex32">nur 32-hex Keys</option>
            <option value="all">alle (auch leer)</option>
          </select>
        </label>
      </div>
    </header>
  );
}

function RangeBar({
  range,
  onChange,
}: {
  range: Range;
  onChange: (r: Range) => void;
}) {
  const [showCustom, setShowCustom] = useState(range.preset === "custom");
  return (
    <div className="mt-5 flex flex-wrap items-center gap-2">
      <div className="inline-flex overflow-hidden rounded-md border border-hair bg-white">
        {PRESETS.map((p, i) => {
          const active = range.preset === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setShowCustom(false);
                onChange(rangeFromPreset(p.id));
              }}
              className={`press px-3 py-1.5 text-[12px] transition-colors ${
                active ? "bg-ink-900 text-white" : "text-ink-600 hover:bg-ink-50"
              } ${i > 0 ? "border-l border-hair" : ""}`}
            >
              {p.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setShowCustom((v) => !v)}
          className={`border-l border-hair px-3 py-1.5 text-[12px] transition-colors ${
            range.preset === "custom" || showCustom
              ? "bg-ink-900 text-white"
              : "text-ink-600 hover:bg-ink-50"
          }`}
        >
          Custom
        </button>
      </div>
      {showCustom && <CustomRange range={range} onChange={onChange} />}
      <span className="ml-auto text-[11.5px] text-ink-400">
        {range.from} → {range.to} (UTC)
      </span>
    </div>
  );
}

function CustomRange({
  range,
  onChange,
}: {
  range: Range;
  onChange: (r: Range) => void;
}) {
  const aeToInputLocal = (ae: string): string => {
    try {
      const d = aeTimestampToDate(ae);
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
      return "";
    }
  };
  const update =
    (part: "from" | "to") => (e: ChangeEvent<HTMLInputElement>) => {
      const local = e.target.value;
      if (!local) return;
      const d = new Date(local);
      if (isNaN(d.getTime())) return;
      const ae = toAeTimestamp(d);
      onChange({
        ...range,
        preset: "custom",
        from: part === "from" ? ae : range.from,
        to: part === "to" ? ae : range.to,
      });
    };
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="datetime-local"
        value={aeToInputLocal(range.from)}
        onChange={update("from")}
        className="rounded-md border border-hair bg-white px-2 py-1 text-[12px] text-ink-700 focus:border-ink-400 focus:outline-none"
      />
      <span className="text-ink-400">–</span>
      <input
        type="datetime-local"
        value={aeToInputLocal(range.to)}
        onChange={update("to")}
        className="rounded-md border border-hair bg-white px-2 py-1 text-[12px] text-ink-700 focus:border-ink-400 focus:outline-none"
      />
    </div>
  );
}

// ---------- ErrorBanner ----------

function ErrorBanner({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <div className="mb-6 flex items-start gap-2.5 border-l-2 border-accent-rose bg-accent-rose/[0.06] px-3 py-2 text-[12.5px]">
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-rose" />
      <pre className="min-w-0 flex-1 whitespace-pre-wrap break-words font-sans text-ink-700">
        {msg}
      </pre>
    </div>
  );
}

// ---------- Section ----------

function Section({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-12 border-t border-hair pt-10 first:border-t-0 first:pt-0">
      <div className="mb-5">
        <h2 className="font-display text-[20px] tracking-tightish text-ink-900">
          {title}
        </h2>
        {meta && <p className="mt-1.5 text-[12.5px] text-ink-500">{meta}</p>}
      </div>
      {children}
    </section>
  );
}

// ---------- KpiGrid ----------

function KpiGrid({
  data,
  loading,
}: {
  data: ControllingResponse | null;
  loading: boolean;
}) {
  const g = data?.global;
  const open = g?.latestOpen ?? null;
  const total = g?.latestTotal ?? null;
  const done = g?.latestDone ?? null;
  const sharedDone = total != null && total > 0 ? (done ?? 0) / total : null;
  return (
    <div className="stagger-children mb-12 grid grid-cols-1 divide-y divide-hair border-y border-hair sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-5">
      <KpiTile
        label="Offen (gesamt)"
        value={loading ? "…" : open != null ? fmtNumber(open) : "–"}
        sub={
          loading
            ? ""
            : sharedDone != null
              ? `${(100 - sharedDone * 100).toFixed(1)} % vom Bestand`
              : "letzter Stand"
        }
        tone={open != null && open > 0 ? "warn" : "ok"}
      />
      <KpiTile
        label="Gesamt"
        value={loading ? "…" : total != null ? fmtNumber(total) : "–"}
        sub={
          loading
            ? ""
            : done != null
              ? `${fmtNumber(done)} fertig`
              : "letzter Stand"
        }
      />
      <KpiTile
        label="Bilder/h (bearbeitet)"
        value={loading ? "…" : fmtRate(g?.processedPerHour, "/h")}
        sub={
          loading
            ? ""
            : g?.processedTotal != null
              ? `${fmtNumber(g.processedTotal)} im Zeitraum`
              : ""
        }
        tone={g?.processedPerHour ? "ok" : "neutral"}
      />
      <KpiTile
        label="Bilder/h (neu)"
        value={loading ? "…" : fmtRate(g?.addedPerHour, "/h")}
        sub={
          loading
            ? ""
            : g?.addedTotal != null
              ? `${fmtNumber(g.addedTotal)} im Zeitraum`
              : ""
        }
        tone={g?.addedPerHour && g?.addedPerHour > 0 ? "warn" : "neutral"}
      />
      <KpiTile
        label="Aktive Nutzer"
        value={loading ? "…" : fmtNumber(g?.activeUsers ?? 0)}
        sub={
          loading
            ? ""
            : g?.activeUserSec
              ? `Σ aktiv ${fmtDuration(g.activeUserSec)}`
              : ""
        }
      />
    </div>
  );
}

function KpiTile({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "neutral" | "ok" | "warn" | "err";
}) {
  const subColor =
    tone === "ok"
      ? "text-accent-mint"
      : tone === "warn"
        ? "text-accent-amber"
        : tone === "err"
          ? "text-accent-rose"
          : "text-ink-400";
  return (
    <div className="animate-fade-up px-5 py-6 first:pl-0 sm:px-6 lg:px-8 lg:first:pl-0">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-400">
        {label}
      </p>
      <p className="mt-3 font-display text-[36px] leading-none tracking-tighter2 text-ink-900">
        {value}
      </p>
      {sub && <p className={`mt-3 text-[12px] font-medium ${subColor}`}>{sub}</p>}
    </div>
  );
}

// ---------- Timeline ----------

type TimelineRow = {
  t: number;
  label: string;
  isFuture: boolean;
  events: number | null;
  processed: number | null;
  added: number | null;
  activeUsers: number | null;
  /** Tatsächlicher Restbestand (Vergangenheit). */
  remaining: number | null;
  /** Prognose-Restbestand (Zukunft + letzter Punkt der Vergangenheit für Anschluss). */
  remainingForecast: number | null;
};

function Timeline({
  data,
  loading,
}: {
  data: ControllingResponse | null;
  loading: boolean;
}) {
  const { rows, forecast, todayLabel } = useMemo(() => {
    if (!data?.timeline?.length) {
      return { rows: [] as TimelineRow[], forecast: null as null | {
        currentOpen: number;
        netPerHour: number;
        processedPerHour: number;
        addedPerHour: number;
        etaIfNoNewHours: number | null;
        etaIfKeepsAddingHours: number | null;
        etaDate: Date | null;
      }, todayLabel: null as string | null };
    }

    const tl = data.timeline;
    const byMode = data.byMode || [];
    const currentOpen = byMode.reduce((s, m) => s + (m.latestOpen ?? 0), 0);
    const procPerHour = byMode.reduce(
      (s, m) => s + (m.processedPerHour ?? 0),
      0,
    );
    const addPerHour = byMode.reduce((s, m) => s + (m.addedPerHour ?? 0), 0);
    const netPerHour = procPerHour - addPerHour;

    // Bestand rückwärts aus Deltas integrieren:
    // remaining_t = remaining_(t+1) - added_(t+1) + processed_(t+1)
    const remainingByIdx = new Array<number>(tl.length).fill(0);
    let cur = currentOpen;
    for (let i = tl.length - 1; i >= 0; i--) {
      remainingByIdx[i] = Math.max(0, cur);
      cur = cur + tl[i].added - tl[i].processed;
    }

    const baseRows: TimelineRow[] = tl.map((b, idx) => {
      const t = aeTimestampToDate(b.bucket).getTime();
      return {
        t,
        label: bucketLabel(b.bucket),
        isFuture: false,
        events: b.events,
        processed: b.processed,
        added: b.added,
        activeUsers: b.activeUsers,
        remaining: remainingByIdx[idx],
        remainingForecast: null,
      };
    });

    const lastPast = baseRows[baseRows.length - 1];
    const lastT = lastPast.t;
    const todayLabel = lastPast.label;

    // Anschluss: letzter Vergangenheits-Punkt bekommt forecast = remaining,
    // damit die Prognose-Linie nahtlos an die Ist-Linie andockt.
    lastPast.remainingForecast = lastPast.remaining;

    // Forecast: 1 Punkt pro Tag in die Zukunft
    const forecastRows: TimelineRow[] = [];
    if (currentOpen > 0 && netPerHour > 0) {
      let curRem = currentOpen;
      let day = 1;
      const maxDays = 90;
      while (day <= maxDays) {
        curRem = Math.max(0, currentOpen - netPerHour * 24 * day);
        const tFut = lastT + day * 24 * 60 * 60 * 1000;
        const lbl = new Intl.DateTimeFormat("de-DE", {
          day: "2-digit",
          month: "2-digit",
          timeZone: "UTC",
        }).format(new Date(tFut));
        forecastRows.push({
          t: tFut,
          label: lbl,
          isFuture: true,
          events: null,
          processed: null,
          added: null,
          activeUsers: null,
          remaining: null,
          remainingForecast: curRem,
        });
        if (curRem === 0) break;
        day++;
      }
    }

    const etaIfNoNewHours =
      procPerHour > 0 ? currentOpen / procPerHour : null;
    const etaIfKeepsAddingHours =
      netPerHour > 0 ? currentOpen / netPerHour : null;
    const etaDate =
      etaIfKeepsAddingHours != null
        ? new Date(lastT + etaIfKeepsAddingHours * 60 * 60 * 1000)
        : null;

    return {
      rows: [...baseRows, ...forecastRows],
      forecast: {
        currentOpen,
        netPerHour,
        processedPerHour: procPerHour,
        addedPerHour: addPerHour,
        etaIfNoNewHours,
        etaIfKeepsAddingHours,
        etaDate,
      },
      todayLabel,
    };
  }, [data]);

  if (loading && !data) {
    return <div className="h-[300px] animate-pulse bg-ink-100/50" />;
  }
  if (!rows.length) {
    return (
      <p className="border border-dashed border-hair px-4 py-12 text-center text-[13px] text-ink-500">
        Keine Daten im Zeitraum.
      </p>
    );
  }

  const etaLabel = forecast?.etaDate
    ? new Intl.DateTimeFormat("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "UTC",
      }).format(forecast.etaDate)
    : null;

  return (
    <div className="space-y-3">
      <div className="h-[340px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={rows}
            margin={{ top: 8, right: 64, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="rgba(15,23,42,0.08)"
            />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "var(--color-ink-500, #64748b)" }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={28}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 11, fill: "var(--color-ink-500, #64748b)" }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              width={48}
            />
            <YAxis
              yAxisId="users"
              orientation="right"
              tick={{ fontSize: 11, fill: "var(--color-ink-500, #64748b)" }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              width={32}
            />
            <YAxis
              yAxisId="forecast"
              orientation="right"
              tick={{ fontSize: 11, fill: "#5a3df0" }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              width={56}
              tickFormatter={(v: number) =>
                v >= 1000 ? `${Math.round(v / 100) / 10}k` : `${v}`
              }
            />
            {todayLabel && (
              <ReferenceLine
                yAxisId="forecast"
                x={todayLabel}
                stroke="#5a3df0"
                strokeDasharray="2 4"
                strokeOpacity={0.55}
                label={{
                  value: "heute",
                  position: "insideTopRight",
                  fill: "#5a3df0",
                  fontSize: 10,
                }}
              />
            )}
            <Tooltip
              content={({ active, payload, label: lbl }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as TimelineRow;
                return (
                  <div className="rounded-md border border-hair bg-white px-3 py-2.5 text-[12px] shadow-lg">
                    <p className="mb-1.5 font-medium text-ink-800">
                      {String(lbl)}
                      {p.isFuture && (
                        <span className="ml-2 rounded bg-[#5a3df0]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#5a3df0]">
                          Prognose
                        </span>
                      )}
                    </p>
                    {!p.isFuture && (
                      <>
                        <p className="text-ink-600">
                          Events:{" "}
                          <span className="font-medium text-ink-900">
                            {fmtNumber(p.events)}
                          </span>
                        </p>
                        <p className="text-ink-600">
                          Bearbeitet:{" "}
                          <span className="font-medium text-ink-900">
                            {fmtNumber(p.processed)}
                          </span>
                        </p>
                        <p className="text-ink-600">
                          Neu:{" "}
                          <span className="font-medium text-ink-900">
                            {fmtNumber(p.added)}
                          </span>
                        </p>
                        <p className="text-ink-600">
                          Aktive Nutzer:{" "}
                          <span className="font-medium text-ink-900">
                            {fmtNumber(p.activeUsers)}
                          </span>
                        </p>
                      </>
                    )}
                    {(p.remaining != null || p.remainingForecast != null) && (
                      <p className="mt-1 border-t border-hair/60 pt-1 text-ink-600">
                        Verbleibend:{" "}
                        <span className="font-medium text-[#5a3df0]">
                          {fmtNumber(
                            p.isFuture ? p.remainingForecast : p.remaining,
                          )}
                        </span>
                      </p>
                    )}
                  </div>
                );
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="processed"
              name="Bearbeitet"
              stroke="#5a3df0"
              strokeWidth={2}
              dot={false}
              connectNulls={false}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="added"
              name="Neu hinzugefügt"
              stroke="#ff5d8f"
              strokeWidth={2}
              dot={false}
              connectNulls={false}
            />
            <Line
              yAxisId="users"
              type="monotone"
              dataKey="activeUsers"
              name="Aktive Nutzer"
              stroke="#3ecf8e"
              strokeWidth={2}
              dot={false}
              strokeDasharray="3 3"
              connectNulls={false}
            />
            <Line
              yAxisId="forecast"
              type="monotone"
              dataKey="remaining"
              name="Verbleibend (Ist)"
              stroke="#5a3df0"
              strokeWidth={2.5}
              dot={false}
              connectNulls={false}
            />
            <Line
              yAxisId="forecast"
              type="monotone"
              dataKey="remainingForecast"
              name="Prognose (pro Tag)"
              stroke="#5a3df0"
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={{ r: 2.5, fill: "#5a3df0" }}
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {forecast && forecast.currentOpen > 0 && (
        <div className="rounded-md border border-hair bg-night-900/[0.02] px-4 py-2.5 text-[11.5px] text-ink-600">
          <span className="font-medium text-ink-800">
            Verbleibend gesamt: {fmtNumber(forecast.currentOpen)}
          </span>
          <span className="mx-2 text-ink-300">·</span>
          Tempo {fmtRate(forecast.processedPerHour)}{" "}
          <span className="text-ink-400">
            (neu {fmtRate(forecast.addedPerHour)} · netto{" "}
            {forecast.netPerHour > 0
              ? `−${fmtRate(forecast.netPerHour)}`
              : forecast.netPerHour < 0
                ? `+${fmtRate(Math.abs(forecast.netPerHour))}`
                : "0/h"}
            )
          </span>
          <span className="mx-2 text-ink-300">·</span>
          {forecast.netPerHour > 0 && etaLabel ? (
            <>
              fertig ca. <span className="font-medium text-[#5a3df0]">{etaLabel}</span>{" "}
              <span className="text-ink-400">
                (in {fmtHours(forecast.etaIfKeepsAddingHours)})
              </span>
            </>
          ) : forecast.processedPerHour > 0 && forecast.etaIfNoNewHours != null ? (
            <>
              ohne Nachschub fertig in{" "}
              <span className="font-medium text-[#5a3df0]">
                {fmtHours(forecast.etaIfNoNewHours)}
              </span>{" "}
              <span className="text-ink-400">
                (mit Nachschub: Bestand wächst aktuell)
              </span>
            </>
          ) : (
            <span className="text-ink-400">
              Prognose nicht möglich – kein Tempo im Zeitraum erkennbar.
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Mode Blocks ----------

// ---------- Forecast Grid (Verbleibend · Tempo · Prognose) ----------

function ForecastGrid({
  rows,
  loading,
}: {
  rows: ControllingByMode[];
  loading: boolean;
}) {
  if (loading && rows.length === 0) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="h-[140px] animate-pulse bg-ink-100/50" />
        <div className="h-[140px] animate-pulse bg-ink-100/50" />
        <div className="h-[140px] animate-pulse bg-ink-100/50" />
        <div className="h-[140px] animate-pulse bg-ink-100/50" />
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <p className="border border-dashed border-hair px-4 py-12 text-center text-[13px] text-ink-500">
        Keine Modi im Zeitraum.
      </p>
    );
  }

  // Aggregat über alle Modi
  const totals = rows.reduce(
    (acc, m) => {
      acc.open += m.latestOpen ?? 0;
      acc.total += m.latestTotal ?? 0;
      acc.done += m.latestDone ?? 0;
      acc.processedPerHour += m.processedPerHour ?? 0;
      acc.addedPerHour += m.addedPerHour ?? 0;
      acc.processedTotal += m.processedTotal;
      acc.addedTotal += m.addedTotal;
      return acc;
    },
    {
      open: 0,
      total: 0,
      done: 0,
      processedPerHour: 0,
      addedPerHour: 0,
      processedTotal: 0,
      addedTotal: 0,
    },
  );
  const totalNetPerHour = totals.processedPerHour - totals.addedPerHour;
  const totalEtaNoNew =
    totals.processedPerHour > 0 ? totals.open / totals.processedPerHour : null;
  const totalEtaWithAdd =
    totalNetPerHour > 0 ? totals.open / totalNetPerHour : null;
  const totalProgressPct =
    totals.total > 0 ? (totals.done / totals.total) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Aggregat-Zeile */}
      <div className="rounded-lg border border-hair bg-night-900/[0.02] px-5 py-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-400">
              Gesamt über alle Modi
            </p>
            <p className="mt-1 font-display text-[28px] leading-none tracking-tightish text-ink-900">
              {fmtNumber(totals.open)}
              <span className="ml-1 text-[12px] text-ink-500">offen</span>
            </p>
            <p className="mt-1 text-[12px] text-ink-500">
              von {fmtNumber(totals.total)} insgesamt ·{" "}
              {fmtNumber(totals.done)} fertig ({totalProgressPct.toFixed(1)} %)
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-right sm:grid-cols-4">
            <ForecastKpi
              label="Tempo"
              value={fmtRate(totals.processedPerHour)}
              hint={`netto ${fmtRate(totalNetPerHour)}`}
              positive={totalNetPerHour > 0}
            />
            <ForecastKpi
              label="Neu /h"
              value={fmtRate(totals.addedPerHour)}
              hint=""
            />
            <ForecastKpi
              label="ETA (ohne Nachschub)"
              value={fmtHours(totalEtaNoNew)}
              hint=""
            />
            <ForecastKpi
              label="ETA (mit Nachschub)"
              value={
                totalEtaWithAdd != null
                  ? fmtHours(totalEtaWithAdd)
                  : totalNetPerHour <= 0 && totals.open > 0
                    ? "wird mehr"
                    : "–"
              }
              hint=""
              negative={totalNetPerHour <= 0 && totals.open > 0}
            />
          </div>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded bg-ink-100">
          <div
            className="h-full bg-ink-900"
            style={{ width: `${Math.min(100, totalProgressPct)}%` }}
          />
        </div>
      </div>

      {/* Pro Modus */}
      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map((m) => (
          <ForecastCard key={m.mode} m={m} />
        ))}
      </div>
    </div>
  );
}

function ForecastKpi({
  label,
  value,
  hint,
  positive,
  negative,
}: {
  label: string;
  value: string;
  hint?: string;
  positive?: boolean;
  negative?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.14em] text-ink-400">
        {label}
      </p>
      <p
        className={`mt-0.5 font-display text-[18px] leading-tight tracking-tightish ${
          negative
            ? "text-accent-rose"
            : positive
              ? "text-accent-mint"
              : "text-ink-900"
        }`}
      >
        {value}
      </p>
      {hint && <p className="text-[10px] text-ink-500">{hint}</p>}
    </div>
  );
}

function ForecastCard({ m }: { m: ControllingByMode }) {
  const progressPct =
    m.latestTotal && m.latestTotal > 0
      ? Math.min(100, ((m.latestDone ?? 0) / m.latestTotal) * 100)
      : 0;
  const etaText =
    m.etaIfNoNewHours != null ? fmtHours(m.etaIfNoNewHours) : "–";
  const etaWithAddText =
    m.etaIfKeepsAddingHours != null
      ? fmtHours(m.etaIfKeepsAddingHours)
      : m.netReductionPerHour != null && m.netReductionPerHour <= 0
        ? "wird mehr"
        : "–";
  const isGrowing =
    m.netReductionPerHour != null && m.netReductionPerHour <= 0;

  return (
    <div className="rounded-lg border border-hair bg-white px-5 py-4">
      {/* Header: Modus + Bestand */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-400">
            Modus
          </p>
          <h3 className="mt-0.5 truncate font-display text-[18px] tracking-tightish text-ink-900">
            {m.mode || "—"}
          </h3>
          <p className="mt-1 text-[11px] text-ink-500">
            {fmtNumber(m.events)} Events · {fmtNumber(m.uniqueUsers)} Nutzer
            {m.lastTs ? ` · zuletzt ${fmtRelative(m.lastTs)}` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-[0.14em] text-ink-400">
            Offen
          </p>
          <p className="font-display text-[26px] leading-none tracking-tightish text-ink-900">
            {m.latestOpen != null ? fmtNumber(m.latestOpen) : "–"}
          </p>
          <p className="text-[10px] text-ink-500">
            von {m.latestTotal != null ? fmtNumber(m.latestTotal) : "–"}
          </p>
        </div>
      </div>

      {/* Progress */}
      <div className="mt-3">
        <div className="flex items-baseline justify-between text-[10.5px] text-ink-500">
          <span>
            {fmtNumber(m.latestDone)} fertig
          </span>
          <span className="font-mono text-ink-700">
            {progressPct.toFixed(1)} %
          </span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded bg-ink-100">
          <div
            className="h-full bg-ink-900"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Tempo + Prognose nebeneinander */}
      <div className="mt-4 grid grid-cols-2 gap-4 border-t border-hair/70 pt-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-ink-400">
            Tempo
          </p>
          <p className="mt-0.5 font-display text-[16px] tracking-tightish text-ink-900">
            {fmtRate(m.processedPerHour)}
          </p>
          <p className="mt-0.5 text-[10.5px] text-ink-500">
            neu {fmtRate(m.addedPerHour)} ·{" "}
            <span
              className={
                isGrowing
                  ? "text-accent-rose"
                  : m.netReductionPerHour && m.netReductionPerHour > 0
                    ? "text-accent-mint"
                    : "text-ink-500"
              }
            >
              netto{" "}
              {m.netReductionPerHour != null
                ? `${m.netReductionPerHour > 0 ? "−" : "+"}${fmtRate(Math.abs(m.netReductionPerHour))}`
                : "–"}
            </span>
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-ink-400">
            Prognose (bei diesem Tempo)
          </p>
          <p className="mt-0.5 font-display text-[16px] tracking-tightish text-ink-900">
            {etaText}
          </p>
          <p className="mt-0.5 text-[10.5px] text-ink-500">
            inkl. Nachschub:{" "}
            <span
              className={
                isGrowing ? "text-accent-rose" : "text-ink-700"
              }
            >
              {etaWithAddText}
            </span>
          </p>
        </div>
      </div>

      <p className="mt-3 text-[10px] text-ink-400">
        {fmtNumber(m.processedTotal)} bearbeitet ·{" "}
        {fmtNumber(m.addedTotal)} dazugekommen im Zeitraum
      </p>
    </div>
  );
}

function ModeBlocks({
  rows,
  loading,
}: {
  rows: ControllingByMode[];
  loading: boolean;
}) {
  if (loading && rows.length === 0) {
    return (
      <div className="space-y-3">
        <div className="h-[120px] animate-pulse bg-ink-100/50" />
        <div className="h-[120px] animate-pulse bg-ink-100/50" />
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <p className="border border-dashed border-hair px-4 py-12 text-center text-[13px] text-ink-500">
        Keine Modi im Zeitraum gefunden.
      </p>
    );
  }
  return (
    <div className="divide-y divide-hair border-y border-hair">
      {rows.map((m) => (
        <ModeRow key={m.mode} m={m} />
      ))}
    </div>
  );
}

function ModeRow({ m }: { m: ControllingByMode }) {
  return (
    <div className="grid gap-6 py-7 lg:grid-cols-12">
      {/* Modus-Identität */}
      <div className="lg:col-span-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-400">
          Modus
        </p>
        <h3 className="mt-1 font-display text-[22px] tracking-tightish text-ink-900">
          {m.mode || "—"}
        </h3>
        <p className="mt-2 text-[12px] text-ink-500">
          {fmtNumber(m.events)} Events · {fmtNumber(m.uniqueUsers)} Nutzer
        </p>
        <p className="mt-1 text-[11.5px] text-ink-400">
          zuletzt {fmtRelative(m.lastTs)}
        </p>
      </div>

      {/* Bestand */}
      <div className="lg:col-span-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-400">
          Bestand
        </p>
        <p className="mt-1 font-mono text-[13.5px] text-ink-800">
          offen{" "}
          <span className="text-ink-900">{fmtNumber(m.latestOpen)}</span> /
          gesamt{" "}
          <span className="text-ink-900">{fmtNumber(m.latestTotal)}</span>
        </p>
        <p className="mt-1 text-[12px] text-ink-500">
          fertig {fmtNumber(m.latestDone)} ·{" "}
          {m.latestTotal && m.latestTotal > 0
            ? `${(((m.latestDone ?? 0) / m.latestTotal) * 100).toFixed(1)} %`
            : "–"}
        </p>
        <div className="mt-2 h-1.5 w-full bg-ink-100">
          <div
            className="h-full bg-ink-900"
            style={{
              width:
                m.latestTotal && m.latestTotal > 0
                  ? `${Math.min(100, ((m.latestDone ?? 0) / m.latestTotal) * 100)}%`
                  : "0%",
            }}
          />
        </div>
      </div>

      {/* Raten */}
      <div className="lg:col-span-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-400">
          Tempo
        </p>
        <p className="mt-1 text-[12.5px] text-ink-700">
          bearbeitet{" "}
          <span className="font-mono text-ink-900">
            {fmtRate(m.processedPerHour)}
          </span>
        </p>
        <p className="mt-0.5 text-[12.5px] text-ink-700">
          neu{" "}
          <span className="font-mono text-ink-900">
            {fmtRate(m.addedPerHour)}
          </span>
        </p>
        <p className="mt-0.5 text-[12.5px] text-ink-700">
          netto{" "}
          <span
            className={`font-mono ${
              m.netReductionPerHour && m.netReductionPerHour > 0
                ? "text-accent-mint"
                : m.netReductionPerHour && m.netReductionPerHour < 0
                  ? "text-accent-rose"
                  : "text-ink-700"
            }`}
          >
            {m.netReductionPerHour != null
              ? `${m.netReductionPerHour > 0 ? "−" : "+"}${fmtRate(Math.abs(m.netReductionPerHour))}`
              : "–"}
          </span>
        </p>
      </div>

      {/* Prognose */}
      <div className="lg:col-span-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-400">
          Prognose
        </p>
        <p className="mt-1 text-[12.5px] text-ink-700">
          ohne Nachschub{" "}
          <span className="font-medium text-ink-900">
            {fmtHours(m.etaIfNoNewHours)}
          </span>
        </p>
        <p className="mt-0.5 text-[12.5px] text-ink-700">
          inkl. Nachschub{" "}
          <span
            className={`font-medium ${
              m.etaIfKeepsAddingHours == null
                ? "text-ink-400"
                : "text-ink-900"
            }`}
          >
            {m.etaIfKeepsAddingHours == null
              ? m.netReductionPerHour != null && m.netReductionPerHour <= 0
                ? "wird mehr"
                : "–"
              : fmtHours(m.etaIfKeepsAddingHours)}
          </span>
        </p>
        <p className="mt-1 text-[11.5px] text-ink-400">
          {fmtNumber(m.processedTotal)} bearbeitet · {fmtNumber(m.addedTotal)} dazugekommen
        </p>
      </div>

      {/* Top-Nutzer + Top-Buttons */}
      <div className="lg:col-span-12">
        <div className="grid gap-8 lg:grid-cols-2">
          <ModeUsersTable byUser={m.byUser} />
          <ModeButtonsTable buttons={m.topButtons} />
        </div>
      </div>
    </div>
  );
}

function ModeUsersTable({
  byUser,
}: {
  byUser: ControllingByMode["byUser"];
}) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-ink-400">
        Top Nutzer in diesem Modus
      </p>
      {byUser.length === 0 ? (
        <p className="text-[12.5px] text-ink-400">Keine Nutzer.</p>
      ) : (
        <table className="w-full text-left text-[12.5px]">
          <thead className="border-b border-hair text-[10.5px] font-medium uppercase tracking-wide text-ink-400">
            <tr>
              <th className="py-2 pr-3">Nutzer</th>
              <th className="py-2 pr-3 text-right">Events</th>
              <th className="py-2 pr-3 text-right">Bearbeitet</th>
              <th className="py-2 pr-3 text-right">Bilder/h</th>
              <th className="py-2 text-right">Aktive Zeit</th>
            </tr>
          </thead>
          <tbody>
            {byUser.slice(0, 8).map((u) => (
              <tr key={u.user} className="border-b border-hair/70">
                <td className="py-1.5 pr-3 text-ink-800">{u.user}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums text-ink-700">
                  {fmtNumber(u.events)}
                </td>
                <td className="py-1.5 pr-3 text-right tabular-nums text-ink-900">
                  {fmtNumber(u.processed)}
                </td>
                <td className="py-1.5 pr-3 text-right tabular-nums text-ink-700">
                  {fmtRate(u.perHour)}
                </td>
                <td className="py-1.5 text-right tabular-nums text-ink-500">
                  {fmtDuration(u.activeSec)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ModeButtonsTable({
  buttons,
}: {
  buttons: ControllingByMode["topButtons"];
}) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-ink-400">
        Top Buttons (blob2)
      </p>
      {buttons.length === 0 ? (
        <p className="text-[12.5px] text-ink-400">
          Keine Aktionen mit „modus:button" Format.
        </p>
      ) : (
        <table className="w-full text-left text-[12.5px]">
          <thead className="border-b border-hair text-[10.5px] font-medium uppercase tracking-wide text-ink-400">
            <tr>
              <th className="py-2 pr-3">Button</th>
              <th className="py-2 text-right">Aufrufe</th>
            </tr>
          </thead>
          <tbody>
            {buttons.map((b) => (
              <tr key={b.button} className="border-b border-hair/70">
                <td className="py-1.5 pr-3 font-mono text-[11.5px] text-ink-800">
                  {b.button}
                </td>
                <td className="py-1.5 text-right tabular-nums text-ink-900">
                  {fmtNumber(b.count)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// Hinweis: Die frühere "Pro Benutzer"-Sektion (Sessions, Tempo, Top-Buttons,
// Pro-Modus-Tabelle pro User) wurde aus dem Controlling entfernt. Die
// vollständige User-Analyse läuft jetzt unter /user-analytics. Hier im
// Controlling bleiben nur die Plattform-weiten Auswertungen (KPIs, Timeline,
// Pro Modus mit Top-Nutzern).

// Hilfs-Komponente: AreaChart als kleine Spark-Vorschau (zur Zeit nicht verwendet,
// kann später in ModeRow für Bestandsverlauf eingehängt werden).
export function _MiniAreaSpark({
  data,
}: {
  data: { v: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={40}>
      <AreaChart data={data}>
        <Area type="monotone" dataKey="v" stroke="#5a3df0" fill="#5a3df022" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
