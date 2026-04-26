import { AlertCircle, RefreshCw } from "lucide-react";
import { useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  type ControllingBlob4Mode,
  type ControllingByMode,
  type ControllingResponse,
  type ControllingUserStats,
  controllingApiUrl,
} from "../lib/controllingApi";
import {
  PRESETS,
  type Range,
  aeTimestampToDate,
  fmtDateTime,
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

      <Section title="Aktivität & Fortschritt über Zeit" meta="Events, aktive Nutzer, abgearbeitete und neu hinzugekommene Bilder">
        <Timeline data={data} loading={loading} />
      </Section>

      <Section
        title="Pro Modus"
        meta="blob3 = Modus (Korrektur, Ausschneiden, …) – ETA mit und ohne Nachschub"
      >
        <ModeBlocks rows={data?.byMode ?? []} loading={loading} />
      </Section>

      <Section title="Pro Benutzer" meta="Sessions, aktive Zeit, Bilder pro Stunde">
        <UserBlocks rows={data?.byUser ?? []} loading={loading} />
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
    <header className="mb-8 border-b border-hair pb-6">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-ink-400">
        Intern Analytics · Controlling
      </p>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-[34px] leading-[1.05] tracking-tighter2 text-ink-900">
            Controlling
          </h1>
          <p className="mt-2 max-w-3xl text-[13.5px] leading-relaxed text-ink-500">
            Auswertung der Plattform-Logs aus{" "}
            <span className="font-mono text-[12.5px] text-ink-700">
              {sourceLabel}
            </span>
            . Fortschritt aus{" "}
            <span className="font-mono text-[12px] text-ink-700">double2</span>{" "}
            (offen) und{" "}
            <span className="font-mono text-[12px] text-ink-700">double3</span>{" "}
            (gesamt) je Modus, Sessions ab&nbsp;{gapMinutes}&nbsp;min Pause.
          </p>
        </div>
        <button
          type="button"
          onClick={onReload}
          title="Aktualisieren"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-hair bg-white text-ink-500 transition-colors hover:border-ink-300 hover:text-ink-800"
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
              className={`px-3 py-1.5 text-[12px] transition-colors ${
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
    <div className="mb-12 grid grid-cols-1 divide-y divide-hair border-y border-hair sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-5">
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
    <div className="px-5 py-6 first:pl-0 sm:px-6 lg:px-8 lg:first:pl-0">
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

function Timeline({
  data,
  loading,
}: {
  data: ControllingResponse | null;
  loading: boolean;
}) {
  const rows = useMemo(() => {
    if (!data?.timeline?.length) return [];
    return data.timeline.map((b) => ({
      label: bucketLabel(b.bucket),
      events: b.events,
      processed: b.processed,
      added: b.added,
      activeUsers: b.activeUsers,
    }));
  }, [data]);

  if (loading && !data) {
    return <div className="h-[280px] animate-pulse bg-ink-100/50" />;
  }
  if (!rows.length) {
    return (
      <p className="border border-dashed border-hair px-4 py-12 text-center text-[13px] text-ink-500">
        Keine Daten im Zeitraum.
      </p>
    );
  }

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={rows}
          margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
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
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 11, fill: "var(--color-ink-500, #64748b)" }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            width={36}
          />
          <Tooltip
            content={({ active, payload, label: lbl }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as {
                events: number;
                processed: number;
                added: number;
                activeUsers: number;
              };
              return (
                <div className="rounded-md border border-hair bg-white px-3 py-2.5 text-[12px] shadow-lg">
                  <p className="mb-1.5 font-medium text-ink-800">
                    {String(lbl)}
                  </p>
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
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="added"
            name="Neu hinzugefügt"
            stroke="#ff5d8f"
            strokeWidth={2}
            dot={false}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="activeUsers"
            name="Aktive Nutzer"
            stroke="#3ecf8e"
            strokeWidth={2}
            dot={false}
            strokeDasharray="3 3"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------- Mode Blocks ----------

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

// ---------- User Blocks ----------

function UserBlocks({
  rows,
  loading,
}: {
  rows: ControllingUserStats[];
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
        Keine Benutzer im Zeitraum.
      </p>
    );
  }
  return (
    <div className="divide-y divide-hair border-y border-hair">
      {rows.map((u) => (
        <UserRow key={u.user} u={u} />
      ))}
    </div>
  );
}

function UserRow({ u }: { u: ControllingUserStats }) {
  return (
    <div className="grid gap-6 py-7 lg:grid-cols-12">
      <div className="lg:col-span-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-400">
          Benutzer
        </p>
        <h3 className="mt-1 font-display text-[22px] tracking-tightish text-ink-900">
          {u.user}
        </h3>
        <p className="mt-2 text-[12px] text-ink-500">
          {fmtNumber(u.eventCount)} Events · {fmtNumber(u.sessions.length)}{" "}
          Sessions
        </p>
        <p className="mt-0.5 text-[12px] text-ink-500">
          {u.firstTs ? fmtDateTime(u.firstTs) : "–"} → {u.lastTs ? fmtDateTime(u.lastTs) : "–"}
        </p>
        {u.primaryOs && (
          <p
            className="mt-1 truncate text-[11.5px] text-ink-400"
            title={u.primaryOs}
          >
            OS: {u.primaryOs}
          </p>
        )}
        {u.lastIp && (
          <p className="mt-0.5 text-[11.5px] text-ink-400">IP: {u.lastIp}</p>
        )}
      </div>

      <div className="lg:col-span-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-400">
          Aktivität
        </p>
        <p className="mt-1 font-mono text-[13.5px] text-ink-900">
          {fmtDuration(u.totalSessionTimeSec)} aktiv
        </p>
        <p className="mt-0.5 text-[12px] text-ink-500">
          Ø Session {fmtDuration(u.avgSessionTimeSec)}
        </p>
        <p className="mt-1 text-[12.5px] text-ink-700">
          bearbeitet{" "}
          <span className="font-mono text-ink-900">
            {fmtNumber(u.totalProcessed)}
          </span>{" "}
          Bilder
        </p>
        <p className="mt-0.5 text-[12.5px] text-ink-700">
          Tempo{" "}
          <span className="font-mono text-ink-900">
            {fmtRate(u.processedPerHour)}
          </span>{" "}
          ·{" "}
          <span className="font-mono text-ink-900">
            {fmtRate(u.perActiveMinute, "/min")}
          </span>
        </p>
      </div>

      <div className="lg:col-span-3">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-ink-400">
          Pro Modus
        </p>
        {u.perMode.length === 0 ? (
          <p className="text-[12.5px] text-ink-400">–</p>
        ) : (
          <table className="w-full text-left text-[12.5px]">
            <thead className="border-b border-hair text-[10.5px] font-medium uppercase tracking-wide text-ink-400">
              <tr>
                <th className="py-1.5 pr-3">Modus</th>
                <th className="py-1.5 pr-3 text-right">bearb.</th>
                <th className="py-1.5 pr-3 text-right">Events</th>
                <th className="py-1.5 text-right">Bilder/h</th>
              </tr>
            </thead>
            <tbody>
              {u.perMode.map((m) => (
                <tr key={m.mode} className="border-b border-hair/70">
                  <td className="py-1 pr-3 text-ink-800">{m.mode || "—"}</td>
                  <td className="py-1 pr-3 text-right tabular-nums text-ink-900">
                    {fmtNumber(m.processed)}
                  </td>
                  <td className="py-1 pr-3 text-right tabular-nums text-ink-700">
                    {fmtNumber(m.events)}
                  </td>
                  <td className="py-1 text-right tabular-nums text-ink-700">
                    {fmtRate(m.perHour)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="lg:col-span-3">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-ink-400">
          Top Buttons
        </p>
        {u.topButtons.length === 0 ? (
          <p className="text-[12.5px] text-ink-400">–</p>
        ) : (
          <ul className="space-y-1 text-[12.5px]">
            {u.topButtons.map((b) => (
              <li
                key={`${b.mode}|${b.button}`}
                className="flex items-baseline justify-between gap-2"
              >
                <span className="min-w-0 truncate">
                  <span className="text-ink-400">{b.mode || "—"}</span>
                  <span className="text-ink-300"> · </span>
                  <span className="font-mono text-[11.5px] text-ink-800">
                    {b.button}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums text-ink-700">
                  {fmtNumber(b.count)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Sessions-Tabelle (volle Breite, scrollbar) */}
      <div className="lg:col-span-12">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-ink-400">
          Sessions ({fmtNumber(u.sessions.length)})
        </p>
        <UserSessionsTable sessions={u.sessions} />
      </div>
    </div>
  );
}

function UserSessionsTable({
  sessions,
}: {
  sessions: ControllingUserStats["sessions"];
}) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? sessions : sessions.slice(-12);
  if (sessions.length === 0) {
    return <p className="text-[12.5px] text-ink-400">Keine Sessions.</p>;
  }
  return (
    <>
      <table className="w-full text-left text-[12px]">
        <thead className="border-b border-hair text-[10.5px] font-medium uppercase tracking-wide text-ink-400">
          <tr>
            <th className="py-1.5 pr-3">Start</th>
            <th className="py-1.5 pr-3">Ende</th>
            <th className="py-1.5 pr-3 text-right">Events</th>
            <th className="py-1.5 pr-3 text-right">Aktiv</th>
            <th className="py-1.5 pr-3 text-right">Pause davor</th>
            <th className="py-1.5">Modi</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((s, i) => (
            <tr key={s.start + i} className="border-b border-hair/70">
              <td className="py-1.5 pr-3 text-ink-700">
                {fmtDateTime(s.start)}
              </td>
              <td className="py-1.5 pr-3 text-ink-700">
                {fmtDateTime(s.end)}
              </td>
              <td className="py-1.5 pr-3 text-right tabular-nums text-ink-700">
                {fmtNumber(s.events)}
              </td>
              <td className="py-1.5 pr-3 text-right tabular-nums text-ink-900">
                {fmtDuration(s.durationSec)}
              </td>
              <td className="py-1.5 pr-3 text-right tabular-nums text-ink-500">
                {s.gapStartSec == null
                  ? "—"
                  : fmtDuration(s.gapStartSec)}
              </td>
              <td className="py-1.5 text-ink-500">
                {s.modes.length === 0 ? "—" : s.modes.join(", ")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {sessions.length > 12 && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-2 text-[11.5px] text-ink-500 hover:text-ink-800"
        >
          {showAll
            ? "Weniger anzeigen"
            : `Alle ${sessions.length} Sessions anzeigen`}
        </button>
      )}
    </>
  );
}

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
