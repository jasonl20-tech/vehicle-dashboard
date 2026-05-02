/**
 * Email Tracking — globale Statistik über alle Email-Jobs.
 *
 * Quelle: `email_tracking` + `email_jobs`.
 *
 * Design: flach, ohne abgerundete „Bubble"-Kacheln. Sektionen sind
 * mit dünnen Trennlinien voneinander getrennt; Zahlen stehen prominent
 * inline. Charts (Recharts) sind groß & lesbar.
 */
import {
  AlertCircle,
  ExternalLink,
  Eye,
  Loader2,
  MousePointerClick,
  RefreshCw,
} from "lucide-react";
import {
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Link, useOutletContext } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DashboardOutletContext } from "../components/layout/dashboardOutletContext";
import { CountUp } from "../components/Premium";
import { fmtNumber, toAeTimestamp, useApi } from "../lib/customerApi";
import { parseTrackingMetadata } from "../lib/emailJobsApi";
import {
  emailTrackingUrl,
  type EmailTrackingResponse,
} from "../lib/emailTrackingApi";

const RANGE_KEY = "ui.emailTracking.range";

const RANGES: { id: RangeId; label: string; days: number | null }[] = [
  { id: "24h", label: "24 Std.", days: 1 },
  { id: "7d", label: "7 Tage", days: 7 },
  { id: "30d", label: "30 Tage", days: 30 },
  { id: "90d", label: "90 Tage", days: 90 },
  { id: "all", label: "Alle", days: null },
];

type RangeId = "24h" | "7d" | "30d" | "90d" | "all";

const noopSetHeader: DashboardOutletContext["setHeaderTrailing"] = () => {};

const C = {
  open: "hsl(165 55% 42%)",
  click: "hsl(214 75% 52%)",
  ink: "hsl(220 16% 22%)",
  inkSoft: "hsl(220 8% 45%)",
  hair: "hsl(220 14% 92%)",
};

function readRange(): RangeId {
  if (typeof window === "undefined") return "30d";
  try {
    const v = window.localStorage.getItem(RANGE_KEY) as RangeId | null;
    if (v && RANGES.some((r) => r.id === v)) return v;
  } catch {
    // ignore
  }
  return "30d";
}

function writeRange(v: RangeId): void {
  try {
    window.localStorage.setItem(RANGE_KEY, v);
  } catch {
    // bewusst leer
  }
}

function fmtPct(v: number): string {
  if (!Number.isFinite(v)) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

function fmtWhen(s: string | null | undefined): string {
  if (!s?.trim()) return "—";
  const raw = s.trim();
  const t = raw.includes("T")
    ? Date.parse(raw)
    : Date.parse(raw.replace(" ", "T") + "Z");
  if (Number.isNaN(t)) return s;
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(t));
}

function fmtRelative(s: string | null | undefined): string {
  if (!s?.trim()) return "—";
  const raw = s.trim();
  const t = raw.includes("T")
    ? Date.parse(raw)
    : Date.parse(raw.replace(" ", "T") + "Z");
  if (Number.isNaN(t)) return "—";
  const diff = Date.now() - t;
  const sec = Math.round(diff / 1000);
  if (sec < 60) return `vor ${sec}s`;
  if (sec < 3600) return `vor ${Math.round(sec / 60)} Min.`;
  if (sec < 86400) return `vor ${Math.round(sec / 3600)} Std.`;
  return `vor ${Math.round(sec / 86400)} Tagen`;
}

export default function EmailTrackingPage() {
  const ctx = useOutletContext<DashboardOutletContext | undefined>();
  const setHeaderTrailing = ctx?.setHeaderTrailing ?? noopSetHeader;

  const [rangeId, setRangeId] = useState<RangeId>(readRange);
  const range = useMemo(() => {
    const r = RANGES.find((x) => x.id === rangeId) ?? RANGES[2];
    if (r.days == null) return { from: null, to: null };
    const now = new Date();
    return {
      from: toAeTimestamp(new Date(now.getTime() - r.days * 86_400_000)),
      to: toAeTimestamp(new Date(now.getTime() + 60_000)),
    };
  }, [rangeId]);

  const url = useMemo(
    () =>
      emailTrackingUrl({
        from: range.from ?? undefined,
        to: range.to ?? undefined,
      }),
    [range.from, range.to],
  );
  const stats = useApi<EmailTrackingResponse>(url);

  const headerToolbar = useMemo(
    () => (
      <div className="flex min-w-0 w-full flex-1 items-center justify-end gap-1.5">
        <div
          role="tablist"
          aria-label="Zeitraum"
          className="hidden items-center gap-0.5 rounded-md border border-white/[0.1] bg-white/[0.03] p-0.5 sm:inline-flex"
        >
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              role="tab"
              aria-selected={rangeId === r.id}
              onClick={() => {
                setRangeId(r.id);
                writeRange(r.id);
              }}
              className={`rounded px-2 py-1 text-[11.5px] transition ${
                rangeId === r.id
                  ? "bg-white text-ink-900"
                  : "text-night-300 hover:bg-white/[0.08] hover:text-white"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => stats.reload()}
          disabled={stats.loading}
          className="press inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/[0.1] bg-white/[0.04] text-night-200 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
          title="Neu laden"
        >
          <RefreshCw
            className={`h-4 w-4 ${stats.loading ? "animate-spin" : ""}`}
          />
        </button>
      </div>
    ),
    [rangeId, stats],
  );

  useLayoutEffect(() => {
    setHeaderTrailing(headerToolbar);
    return () => setHeaderTrailing(null);
  }, [setHeaderTrailing, headerToolbar]);

  const data = stats.data;

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-y-auto bg-paper">
      {stats.error && (
        <p
          className="shrink-0 border-b border-rose-500/30 bg-rose-500/10 px-4 py-1.5 text-[12.5px] text-rose-700 sm:px-8"
          role="alert"
        >
          <AlertCircle className="mr-1 inline h-3.5 w-3.5" />
          {stats.error}
        </p>
      )}
      {data?.hint && !stats.error && (
        <p
          className="shrink-0 border-b border-amber-500/40 bg-amber-500/10 px-4 py-1.5 text-[12.5px] text-amber-700 sm:px-8"
          role="status"
        >
          {data.hint}
        </p>
      )}

      {/* Mobile-Range-Switch */}
      <div className="shrink-0 glass-paper border-b border-hair px-4 py-2 sm:hidden">
        <div role="tablist" className="grid grid-cols-5 gap-1">
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                setRangeId(r.id);
                writeRange(r.id);
              }}
              className={`press rounded px-1 py-1 text-[10.5px] transition ${
                rangeId === r.id
                  ? "bg-ink-900 text-white"
                  : "border border-hair bg-white text-ink-600 hover:text-ink-900"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Big Numbers — flach, ohne Boxen */}
      <section className="aurora-backdrop relative overflow-hidden border-b border-hair px-4 py-6 sm:px-8 sm:py-8 animate-fade-down">
        <BigNumbers loading={stats.loading} data={data} />
      </section>

      {/* Verlauf — großes AreaChart */}
      <section className="border-b border-hair bg-white px-4 py-6 sm:px-8 animate-fade-up">
        <Heading
          title="Verlauf"
          subtitle="Opens & Clicks pro Tag"
          right={
            data?.totals && (
              <p className="text-[11.5px] text-ink-500">
                {data.by_day.length} Tage
                {data.totals.last_event_at && (
                  <>
                    <span className="mx-1.5 text-ink-300">·</span>
                    Letztes Event {fmtRelative(data.totals.last_event_at)}
                  </>
                )}
              </p>
            )
          }
        />
        <div className="mt-4">
          <DayAreaChart points={data?.by_day ?? []} loading={stats.loading} />
        </div>
      </section>

      {/* Stunden-Verteilung — echtes BarChart */}
      <section className="border-b border-hair bg-white px-4 py-6 sm:px-8 animate-fade-up">
        <Heading
          title="Aktivität nach Stunde"
          subtitle="Stunde des Tages (UTC) — gestapelt"
        />
        <div className="mt-4">
          <HourBarChart points={data?.by_hour ?? []} />
        </div>
      </section>

      {/* Top-Listen */}
      <section className="border-b border-hair bg-white px-4 py-6 sm:px-8 animate-fade-up">
        <Heading title="Top" subtitle="Links · Länder · Städte" />
        <div className="mt-4 grid grid-cols-1 gap-x-12 gap-y-8 lg:grid-cols-3">
          <FlatBars
            title="Links (Clicks)"
            empty="Noch keine Clicks."
            items={(data?.top_links ?? []).map((l) => ({
              label: l.link_url,
              count: l.count,
              href: l.link_url,
            }))}
          />
          <FlatBars
            title="Länder"
            empty="Keine Geo-Metadaten."
            items={(data?.top_countries ?? []).map((c) => ({
              label: c.country,
              count: c.count,
            }))}
          />
          <FlatBars
            title="Städte"
            empty="Keine Geo-Metadaten."
            items={(data?.top_cities ?? []).map((c) => ({
              label: c.country ? `${c.city} · ${c.country}` : c.city,
              count: c.count,
            }))}
          />
        </div>
      </section>

      {/* Top Jobs */}
      <section className="border-b border-hair bg-white px-4 py-6 sm:px-8 animate-fade-up">
        <Heading
          title="Top Jobs"
          subtitle="nach Engagement (Opens + Clicks)"
          right={
            <Link
              to="/dashboard/emails/logs"
              className="inline-flex items-center gap-1 text-[11.5px] text-ink-500 hover:text-ink-900"
            >
              Alle Logs
              <ExternalLink className="h-3 w-3" />
            </Link>
          }
        />
        <div className="mt-3">
          <TopJobsTable jobs={data?.top_jobs ?? []} loading={stats.loading} />
        </div>
      </section>

      {/* Recent Events */}
      <section className="bg-white px-4 py-6 sm:px-8 animate-fade-up">
        <Heading title="Letzte Events" subtitle="Live-Stream der Pixel- & Click-Events" />
        <div className="mt-3">
          <RecentEvents
            rows={data?.recent_events ?? []}
            loading={stats.loading}
          />
        </div>
      </section>
    </div>
  );
}

// ─── Heading ─────────────────────────────────────────────────────────

function Heading({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink-900">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-0.5 text-[11.5px] text-ink-500">{subtitle}</p>
        )}
      </div>
      {right}
    </div>
  );
}

// ─── Big Numbers ─────────────────────────────────────────────────────

function BigNumbers({
  loading,
  data,
}: {
  loading: boolean;
  data: EmailTrackingResponse | null;
}) {
  const t = data?.totals;
  type Item = {
    label: string;
    sub: string;
    accent?: string;
  } & (
    | { numeric: number; suffix?: string; decimals?: number; value?: never }
    | { numeric?: never; value: string }
  );
  const items: Item[] = [
    {
      label: "Jobs gesendet",
      numeric: t?.jobs_sent ?? 0,
      sub: `${fmtNumber(t?.jobs_total ?? 0)} insgesamt`,
    },
    {
      label: "Opens",
      numeric: t?.opens_total ?? 0,
      sub: `${fmtNumber(t?.unique_open_jobs ?? 0)} unique Jobs · ${
        t ? fmtPct(t.open_rate) : "—"
      } Open-Rate`,
      accent: C.open,
    },
    {
      label: "Clicks",
      numeric: t?.clicks_total ?? 0,
      sub: `${fmtNumber(t?.unique_click_jobs ?? 0)} unique Jobs · ${
        t ? fmtPct(t.click_rate) : "—"
      } Click-Rate`,
      accent: C.click,
    },
    {
      label: "CTOR",
      numeric: t ? t.click_to_open_rate * 100 : 0,
      decimals: 1,
      suffix: "%",
      sub: "Click-to-Open-Rate",
    },
    {
      label: "Distinct IPs",
      numeric: t?.unique_ips ?? 0,
      sub: "über alle Events",
    },
    {
      label: "Letztes Event",
      value: t?.last_event_at ? fmtRelative(t.last_event_at) : "—",
      sub: t?.last_event_at ? fmtWhen(t.last_event_at) : "Noch keine Events",
    },
  ];

  return (
    <div className="stagger-children grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((it) => (
        <div key={it.label} className="min-w-0 animate-fade-up">
          <p className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-500">
            {it.label}
          </p>
          <p
            className="mt-1 truncate text-[28px] font-semibold tracking-tight tabular-nums text-ink-900 sm:text-[32px]"
            style={it.accent ? { color: it.accent } : undefined}
          >
            {loading && !data ? (
              <Loader2 className="inline h-5 w-5 animate-spin text-ink-300" />
            ) : it.numeric != null ? (
              <CountUp
                value={it.numeric}
                decimals={it.decimals ?? 0}
                suffix={it.suffix}
              />
            ) : (
              it.value
            )}
          </p>
          <p className="mt-1 truncate text-[11.5px] text-ink-500">{it.sub}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Day-Area-Chart (groß) ───────────────────────────────────────────

function DayAreaChart({
  points,
  loading,
}: {
  points: { day: string; opens: number; clicks: number }[];
  loading: boolean;
}) {
  const data = points.map((p) => ({
    label: p.day.slice(5).replace("-", "."),
    opens: p.opens,
    clicks: p.clicks,
  }));
  if (loading && data.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center text-[12px] text-ink-500">
        <Loader2 className="mr-1.5 inline h-3.5 w-3.5 animate-spin" />
        Lade…
      </div>
    );
  }
  if (data.length === 0) {
    return (
      <p className="border-l-2 border-hair bg-ink-50/40 px-3 py-10 text-center text-[12px] text-ink-400">
        Keine Events im Zeitraum.
      </p>
    );
  }
  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
          <defs>
            <linearGradient id="tk-opens" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.open} stopOpacity={0.55} />
              <stop offset="100%" stopColor={C.open} stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="tk-clicks" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.click} stopOpacity={0.55} />
              <stop offset="100%" stopColor={C.click} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={C.hair} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: C.hair }}
            tick={{ fontSize: 11, fill: C.inkSoft }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: C.inkSoft }}
            allowDecimals={false}
            width={32}
          />
          <Tooltip
            contentStyle={{
              fontSize: 12,
              borderRadius: 6,
              border: `1px solid ${C.hair}`,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} iconSize={8} />
          <Area
            type="monotone"
            dataKey="opens"
            stroke={C.open}
            fill="url(#tk-opens)"
            name="Opens"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="clicks"
            stroke={C.click}
            fill="url(#tk-clicks)"
            name="Clicks"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Hour-Bar-Chart (groß) ───────────────────────────────────────────

function HourBarChart({
  points,
}: {
  points: { hour: number; opens: number; clicks: number }[];
}) {
  const byHour = new Map<number, { opens: number; clicks: number }>();
  for (const p of points) byHour.set(p.hour, { opens: p.opens, clicks: p.clicks });
  const data = Array.from({ length: 24 }, (_, h) => {
    const v = byHour.get(h) ?? { opens: 0, clicks: 0 };
    return {
      hour: h.toString().padStart(2, "0"),
      opens: v.opens,
      clicks: v.clicks,
    };
  });
  const allZero = data.every((d) => d.opens + d.clicks === 0);
  if (allZero) {
    return (
      <p className="border-l-2 border-hair bg-ink-50/40 px-3 py-10 text-center text-[12px] text-ink-400">
        Keine Events im Zeitraum.
      </p>
    );
  }
  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid stroke={C.hair} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="hour"
            tickLine={false}
            axisLine={{ stroke: C.hair }}
            tick={{ fontSize: 11, fill: C.inkSoft }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: C.inkSoft }}
            allowDecimals={false}
            width={32}
          />
          <Tooltip
            contentStyle={{
              fontSize: 12,
              borderRadius: 6,
              border: `1px solid ${C.hair}`,
            }}
            cursor={{ fill: "hsla(220, 14%, 90%, 0.45)" }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} iconSize={8} />
          <Bar dataKey="opens" stackId="a" fill={C.open} name="Opens" />
          <Bar dataKey="clicks" stackId="a" fill={C.click} name="Clicks" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Flat Top-List (Bar in Zeile) ───────────────────────────────────

function FlatBars({
  title,
  items,
  empty,
}: {
  title: string;
  items: { label: string; count: number; href?: string }[];
  empty: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <div>
      <h3 className="mb-3 text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-500">
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="border-l-2 border-hair bg-ink-50/40 px-3 py-6 text-[12px] text-ink-400">
          {empty}
        </p>
      ) : (
        <ul className="stagger-children space-y-2">
          {items.map((it, idx) => (
            <li key={`${it.label}-${idx}`} className="animate-fade-up">
              <div className="flex items-center justify-between gap-2 text-[12.5px]">
                {it.href ? (
                  <a
                    href={it.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-ink-800 transition hover:text-ink-900 hover:underline"
                    title={it.label}
                  >
                    {it.label}
                  </a>
                ) : (
                  <span className="truncate text-ink-800" title={it.label}>
                    {it.label}
                  </span>
                )}
                <span className="shrink-0 tabular-nums text-ink-600">
                  <CountUp value={it.count} />
                </span>
              </div>
              <div className="mt-1 h-px w-full bg-ink-100">
                <div
                  className="animate-bar-grow h-[2px] bg-ink-700"
                  style={{
                    width: `${(it.count / max) * 100}%`,
                    animationDelay: `${idx * 40}ms`,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Top Jobs ────────────────────────────────────────────────────────

function TopJobsTable({
  jobs,
  loading,
}: {
  jobs: EmailTrackingResponse["top_jobs"];
  loading: boolean;
}) {
  if (loading && jobs.length === 0) {
    return (
      <p className="py-6 text-[12px] text-ink-500">
        <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />
        Lade…
      </p>
    );
  }
  if (jobs.length === 0) {
    return (
      <p className="border-l-2 border-hair bg-ink-50/40 px-3 py-6 text-[12px] text-ink-400">
        Noch keine Tracking-Events.
      </p>
    );
  }
  const max = Math.max(1, ...jobs.map((j) => j.opens + j.clicks));
  return (
    <table className="w-full border-separate border-spacing-0 text-left text-[12.5px]">
      <thead className="text-[10px] uppercase tracking-[0.12em] text-ink-500">
        <tr>
          <th className="border-b border-hair px-2 py-2 font-medium">Betreff / Job</th>
          <th className="border-b border-hair px-2 py-2 font-medium">Empfänger</th>
          <th className="border-b border-hair px-2 py-2 font-medium">Template</th>
          <th className="border-b border-hair px-2 py-2 text-right font-medium">Opens</th>
          <th className="border-b border-hair px-2 py-2 text-right font-medium">Clicks</th>
          <th className="border-b border-hair px-2 py-2 font-medium">Engagement</th>
          <th className="border-b border-hair px-2 py-2" />
        </tr>
      </thead>
      <tbody>
        {jobs.map((j) => {
          const total = j.opens + j.clicks;
          const openPct = total > 0 ? (j.opens / total) * 100 : 0;
          return (
            <tr key={j.id} className="hover:bg-ink-50/40">
              <td className="border-b border-hair px-2 py-2 align-top">
                <Link
                  to={`/dashboard/emails/logs/${encodeURIComponent(j.id)}`}
                  className="block max-w-md truncate text-ink-800 hover:underline"
                  title={j.custom_subject ?? ""}
                >
                  {j.custom_subject?.trim() || "—"}
                </Link>
                <span
                  className="block truncate font-mono text-[10.5px] text-ink-400"
                  title={j.id}
                >
                  {j.id}
                </span>
              </td>
              <td className="whitespace-nowrap border-b border-hair px-2 py-2 align-top font-mono text-[11.5px] text-ink-700">
                {j.recipient_email || "—"}
              </td>
              <td className="whitespace-nowrap border-b border-hair px-2 py-2 align-top font-mono text-[11.5px] text-ink-600">
                {j.template_id || "—"}
              </td>
              <td className="whitespace-nowrap border-b border-hair px-2 py-2 text-right align-top tabular-nums text-emerald-700">
                {fmtNumber(j.opens)}
              </td>
              <td className="whitespace-nowrap border-b border-hair px-2 py-2 text-right align-top tabular-nums text-sky-700">
                {fmtNumber(j.clicks)}
              </td>
              <td className="border-b border-hair px-2 py-2 align-middle">
                <div className="flex h-1.5 w-full overflow-hidden bg-ink-100">
                  <div
                    style={{
                      width: `${(total / max) * openPct}%`,
                      backgroundColor: C.open,
                    }}
                  />
                  <div
                    style={{
                      width: `${(total / max) * (100 - openPct)}%`,
                      backgroundColor: C.click,
                    }}
                  />
                </div>
              </td>
              <td className="whitespace-nowrap border-b border-hair px-2 py-2 text-right align-top">
                <Link
                  to={`/dashboard/emails/logs/${encodeURIComponent(j.id)}`}
                  className="inline-flex items-center gap-1 text-[11.5px] text-ink-500 hover:text-ink-900"
                  title="Im Log öffnen"
                >
                  Öffnen <ExternalLink className="h-3 w-3" />
                </Link>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ─── Recent Events ──────────────────────────────────────────────────

function RecentEvents({
  rows,
  loading,
}: {
  rows: EmailTrackingResponse["recent_events"];
  loading: boolean;
}) {
  if (loading && rows.length === 0) {
    return (
      <p className="py-6 text-[12px] text-ink-500">
        <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />
        Lade…
      </p>
    );
  }
  if (rows.length === 0) {
    return (
      <p className="border-l-2 border-hair bg-ink-50/40 px-3 py-6 text-[12px] text-ink-400">
        Keine Events im Zeitraum.
      </p>
    );
  }
  return (
    <table className="w-full border-separate border-spacing-0 text-left text-[12px]">
      <thead className="text-[10px] uppercase tracking-[0.12em] text-ink-500">
        <tr>
          <th className="border-b border-hair px-2 py-2 font-medium">Wann</th>
          <th className="border-b border-hair px-2 py-2 font-medium">Typ</th>
          <th className="border-b border-hair px-2 py-2 font-medium">Betreff / Empfänger</th>
          <th className="border-b border-hair px-2 py-2 font-medium">Geo</th>
          <th className="border-b border-hair px-2 py-2 font-medium">IP</th>
          <th className="border-b border-hair px-2 py-2 font-medium">URL</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((ev) => {
          const meta = parseTrackingMetadata(ev.metadata);
          const geo = [meta?.city, meta?.country].filter(Boolean).join(", ") || "—";
          const isClick = ev.event_type === "click";
          return (
            <tr key={ev.id} className="hover:bg-ink-50/40">
              <td
                className="whitespace-nowrap border-b border-hair px-2 py-1.5 align-top text-ink-700 tabular-nums"
                title={fmtWhen(ev.created_at)}
              >
                {fmtRelative(ev.created_at)}
              </td>
              <td className="border-b border-hair px-2 py-1.5 align-top">
                {isClick ? (
                  <span className="inline-flex items-center gap-1 text-sky-700">
                    <MousePointerClick className="h-3 w-3" /> click
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-emerald-700">
                    <Eye className="h-3 w-3" /> open
                  </span>
                )}
              </td>
              <td className="border-b border-hair px-2 py-1.5 align-top">
                <Link
                  to={`/dashboard/emails/logs/${encodeURIComponent(ev.job_id)}`}
                  className="block max-w-[18rem] truncate text-ink-800 hover:underline"
                  title={ev.custom_subject ?? ev.job_id}
                >
                  {ev.custom_subject?.trim() || ev.job_id}
                </Link>
                {ev.recipient_email && (
                  <span className="block truncate font-mono text-[10.5px] text-ink-400">
                    {ev.recipient_email}
                  </span>
                )}
              </td>
              <td className="whitespace-nowrap border-b border-hair px-2 py-1.5 align-top text-ink-700">
                {geo}
              </td>
              <td className="whitespace-nowrap border-b border-hair px-2 py-1.5 align-top font-mono text-[11.5px] text-ink-600">
                {ev.ip_address || "—"}
              </td>
              <td className="border-b border-hair px-2 py-1.5 align-top">
                {isClick && ev.link_url ? (
                  <a
                    href={ev.link_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block max-w-[18rem] truncate text-ink-800 hover:underline"
                    title={ev.link_url}
                  >
                    {ev.link_url}
                  </a>
                ) : (
                  <span className="text-ink-400">—</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
