/**
 * Email Tracking — globale Statistik über alle Email-Jobs.
 *
 * Quelle: `email_tracking` + `email_jobs` (read-only join im Backend).
 *
 * Layout:
 *  - Header-Toolbar im DashboardHeader: Zeitraum-Tabs + Reload.
 *  - Body:
 *      • Kacheln (Opens / Clicks / Open-Rate / Click-Rate / etc.)
 *      • Verlauf (gestapelte Bars: Opens vs Clicks pro Tag)
 *      • Aktivität nach Stunde (24h-Heatmap-Strip)
 *      • Top-Listen (Links / Länder / Städte)
 *      • Top-Jobs (mit Direkt-Link in Email Logs)
 *      • Recent-Events (kompakte Timeline)
 */
import {
  AlertCircle,
  ExternalLink,
  Eye,
  Globe2,
  Loader2,
  Mail,
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
import {
  fmtNumber,
  toAeTimestamp,
  useApi,
} from "../lib/customerApi";
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
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/[0.1] bg-white/[0.04] text-night-200 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
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
          className="shrink-0 border-b border-accent-rose/30 bg-accent-rose/10 px-4 py-1.5 text-[12.5px] text-accent-rose sm:px-6"
          role="alert"
        >
          <AlertCircle className="mr-1 inline h-3.5 w-3.5" />
          {stats.error}
        </p>
      )}
      {data?.hint && !stats.error && (
        <p
          className="shrink-0 border-b border-accent-amber/40 bg-accent-amber/10 px-4 py-1.5 text-[12.5px] text-accent-amber sm:px-6"
          role="status"
        >
          {data.hint}
        </p>
      )}

      {/* Mobile-Range-Switch */}
      <div className="shrink-0 border-b border-hair bg-white px-3 py-2 sm:hidden">
        <div
          role="tablist"
          aria-label="Zeitraum"
          className="grid grid-cols-5 gap-1"
        >
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                setRangeId(r.id);
                writeRange(r.id);
              }}
              className={`rounded px-1 py-1 text-[10.5px] transition ${
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

      {/* Body */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 px-3 py-4 sm:gap-6 sm:px-6 sm:py-6">
        {/* Kacheln */}
        <KpiTiles loading={stats.loading} data={data} />

        {/* Verlauf + Stunden-Aktivität nebeneinander */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-hair bg-white p-3 sm:p-4 lg:col-span-2">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-500">
                Verlauf
              </p>
              <p className="text-[11px] tabular-nums text-ink-400">
                {data?.by_day.length ?? 0} Tage
              </p>
            </div>
            <DayChart points={data?.by_day ?? []} loading={stats.loading} />
          </div>

          <div className="rounded-xl border border-hair bg-white p-3 sm:p-4">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-ink-500">
              Aktivität nach Stunde (UTC)
            </p>
            <HourStrip points={data?.by_hour ?? []} />
          </div>
        </div>

        {/* Top-Listen */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <TopListCard
            title="Top Links"
            empty="Noch keine Click-Events."
            items={(data?.top_links ?? []).map((l) => ({
              label: l.link_url,
              count: l.count,
              href: l.link_url,
            }))}
          />
          <TopListCard
            title="Top Länder"
            empty="Keine Geo-Metadaten."
            items={(data?.top_countries ?? []).map((c) => ({
              label: c.country,
              count: c.count,
            }))}
          />
          <TopListCard
            title="Top Städte"
            empty="Keine Geo-Metadaten."
            items={(data?.top_cities ?? []).map((c) => ({
              label: c.country ? `${c.city} · ${c.country}` : c.city,
              count: c.count,
            }))}
          />
        </div>

        {/* Top Jobs */}
        <div className="rounded-xl border border-hair bg-white p-3 sm:p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-500">
              Top Jobs (nach Engagement)
            </p>
            <Link
              to="/emails/logs"
              className="inline-flex items-center gap-1 text-[11.5px] text-ink-500 hover:text-ink-900"
            >
              Alle Logs
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
          <TopJobsTable jobs={data?.top_jobs ?? []} loading={stats.loading} />
        </div>

        {/* Recent Events */}
        <div className="rounded-xl border border-hair bg-white p-3 sm:p-4">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-ink-500">
            Letzte Events
          </p>
          <RecentEvents
            rows={data?.recent_events ?? []}
            loading={stats.loading}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Kacheln ─────────────────────────────────────────────────────────

function KpiTiles({
  loading,
  data,
}: {
  loading: boolean;
  data: EmailTrackingResponse | null;
}) {
  const t = data?.totals;
  const tiles: {
    icon: ReactNode;
    label: string;
    value: string;
    sub?: string;
    tone: "ink" | "emerald" | "sky" | "amber" | "rose";
  }[] = [
    {
      icon: <Mail className="h-3.5 w-3.5" />,
      label: "Jobs gesendet",
      value: fmtNumber(t?.jobs_sent ?? 0),
      sub: `${fmtNumber(t?.jobs_total ?? 0)} insgesamt`,
      tone: "ink",
    },
    {
      icon: <Eye className="h-3.5 w-3.5" />,
      label: "Opens (gesamt)",
      value: fmtNumber(t?.opens_total ?? 0),
      sub: `${fmtNumber(t?.unique_open_jobs ?? 0)} eindeutige Jobs`,
      tone: "emerald",
    },
    {
      icon: <MousePointerClick className="h-3.5 w-3.5" />,
      label: "Clicks (gesamt)",
      value: fmtNumber(t?.clicks_total ?? 0),
      sub: `${fmtNumber(t?.unique_click_jobs ?? 0)} eindeutige Jobs`,
      tone: "sky",
    },
    {
      icon: <Eye className="h-3.5 w-3.5" />,
      label: "Open-Rate",
      value: t ? fmtPct(t.open_rate) : "—",
      sub: "= Jobs mit Open / gesendete Jobs",
      tone: "emerald",
    },
    {
      icon: <MousePointerClick className="h-3.5 w-3.5" />,
      label: "Click-Rate",
      value: t ? fmtPct(t.click_rate) : "—",
      sub: "= Jobs mit Click / gesendete Jobs",
      tone: "sky",
    },
    {
      icon: <MousePointerClick className="h-3.5 w-3.5" />,
      label: "CTOR",
      value: t ? fmtPct(t.click_to_open_rate) : "—",
      sub: "Click-to-Open-Rate",
      tone: "amber",
    },
    {
      icon: <Globe2 className="h-3.5 w-3.5" />,
      label: "Distinct IPs",
      value: fmtNumber(t?.unique_ips ?? 0),
      sub: "Open + Click",
      tone: "ink",
    },
    {
      icon: <Mail className="h-3.5 w-3.5" />,
      label: "Letztes Event",
      value: t?.last_event_at ? fmtRelative(t.last_event_at) : "—",
      sub: t?.last_event_at ? fmtWhen(t.last_event_at) : "",
      tone: "ink",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-4">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className={`rounded-xl border px-3 py-3 ${
            tile.tone === "emerald"
              ? "border-emerald-500/30 bg-emerald-500/5"
              : tile.tone === "sky"
                ? "border-sky-500/30 bg-sky-500/5"
                : tile.tone === "amber"
                  ? "border-amber-500/30 bg-amber-500/5"
                  : tile.tone === "rose"
                    ? "border-rose-500/30 bg-rose-500/5"
                    : "border-hair bg-white"
          }`}
        >
          <div className="flex items-center gap-1 text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-500">
            {tile.icon}
            {tile.label}
          </div>
          <p className="mt-1 text-[20px] font-semibold tabular-nums text-ink-900">
            {loading && !data ? (
              <Loader2 className="inline h-4 w-4 animate-spin text-ink-400" />
            ) : (
              tile.value
            )}
          </p>
          {tile.sub && (
            <p className="mt-0.5 truncate text-[11.5px] text-ink-500">
              {tile.sub}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Verlauf-Chart ───────────────────────────────────────────────────

function DayChart({
  points,
  loading,
}: {
  points: { day: string; opens: number; clicks: number }[];
  loading: boolean;
}) {
  const data = points.map((p) => ({
    day: p.day.slice(5).replace("-", "."),
    fullDay: p.day,
    opens: p.opens,
    clicks: p.clicks,
  }));
  if (loading && data.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-[12px] text-ink-500">
        <Loader2 className="mr-1.5 inline h-3.5 w-3.5 animate-spin" />
        Lade…
      </div>
    );
  }
  if (data.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-[12px] text-ink-400">
        Keine Events im Zeitraum.
      </div>
    );
  }
  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid stroke="hsl(220 14% 90%)" strokeDasharray="3 3" />
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={{ stroke: "hsl(220 14% 90%)" }}
            tick={{ fontSize: 10.5, fill: "hsl(220 8% 45%)" }}
          />
          <YAxis
            tickLine={false}
            axisLine={{ stroke: "hsl(220 14% 90%)" }}
            tick={{ fontSize: 10.5, fill: "hsl(220 8% 45%)" }}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: "hsla(220, 14%, 90%, 0.45)" }}
            contentStyle={{
              fontSize: 12,
              borderRadius: 6,
              border: "1px solid hsl(220 14% 90%)",
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} iconSize={9} />
          <Bar
            dataKey="opens"
            stackId="a"
            fill="hsl(165 55% 42%)"
            name="Opens"
            radius={[0, 0, 0, 0]}
          />
          <Bar
            dataKey="clicks"
            stackId="a"
            fill="hsl(214 75% 52%)"
            name="Clicks"
            radius={[3, 3, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Stunden-Streifen (24h) ───────────────────────────────────────────

function HourStrip({
  points,
}: {
  points: { hour: number; opens: number; clicks: number }[];
}) {
  const byHour = new Map<number, { opens: number; clicks: number }>();
  for (const p of points) {
    byHour.set(p.hour, { opens: p.opens, clicks: p.clicks });
  }
  const max = Math.max(
    1,
    ...Array.from(byHour.values()).map((v) => v.opens + v.clicks),
  );
  return (
    <div className="flex items-end gap-0.5">
      {Array.from({ length: 24 }, (_, h) => h).map((h) => {
        const p = byHour.get(h) ?? { opens: 0, clicks: 0 };
        const total = p.opens + p.clicks;
        const pct = total / max;
        return (
          <div
            key={h}
            className="flex min-w-0 flex-1 flex-col items-center gap-0.5"
            title={`${h.toString().padStart(2, "0")}:00 · ${p.opens} Opens · ${p.clicks} Clicks`}
          >
            <div
              className="flex w-full flex-col-reverse overflow-hidden rounded bg-ink-100"
              style={{ height: `${10 + pct * 60}px`, minHeight: 10 }}
            >
              <div
                className="bg-emerald-500"
                style={{
                  height: `${total > 0 ? (p.opens / total) * 100 : 0}%`,
                }}
              />
              <div
                className="bg-sky-500"
                style={{
                  height: `${total > 0 ? (p.clicks / total) * 100 : 0}%`,
                }}
              />
            </div>
            <span className="text-[8.5px] tabular-nums text-ink-400">
              {h.toString().padStart(2, "0")}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Top-Listen-Card ─────────────────────────────────────────────────

function TopListCard({
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
    <div className="rounded-xl border border-hair bg-white p-3 sm:p-4">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-ink-500">
        {title}
      </p>
      {items.length === 0 ? (
        <p className="py-6 text-center text-[12px] text-ink-400">{empty}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((it, idx) => (
            <li key={`${it.label}-${idx}`}>
              <div className="flex items-center justify-between gap-2 text-[12.5px]">
                {it.href ? (
                  <a
                    href={it.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-ink-800 hover:text-ink-900 hover:underline"
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
                  {fmtNumber(it.count)}
                </span>
              </div>
              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-ink-100">
                <div
                  className="h-full rounded-full bg-ink-700"
                  style={{ width: `${(it.count / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Top-Jobs-Tabelle ────────────────────────────────────────────────

function TopJobsTable({
  jobs,
  loading,
}: {
  jobs: EmailTrackingResponse["top_jobs"];
  loading: boolean;
}) {
  if (loading && jobs.length === 0) {
    return (
      <p className="py-6 text-center text-[12px] text-ink-500">
        <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />
        Lade…
      </p>
    );
  }
  if (jobs.length === 0) {
    return (
      <p className="py-6 text-center text-[12px] text-ink-400">
        Noch keine Tracking-Events.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-md border border-hair">
      <table className="min-w-full divide-y divide-hair text-left text-[12.5px]">
        <thead className="bg-ink-50/40 text-[10.5px] uppercase tracking-[0.12em] text-ink-500">
          <tr>
            <th className="px-2 py-1.5 font-medium">Betreff</th>
            <th className="px-2 py-1.5 font-medium">Empfänger</th>
            <th className="px-2 py-1.5 font-medium">Template</th>
            <th className="px-2 py-1.5 text-right font-medium">Opens</th>
            <th className="px-2 py-1.5 text-right font-medium">Clicks</th>
            <th className="px-2 py-1.5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-hair bg-white">
          {jobs.map((j) => (
            <tr key={j.id} className="align-top">
              <td className="px-2 py-1.5">
                <span className="block max-w-md truncate text-ink-800" title={j.custom_subject ?? ""}>
                  {j.custom_subject?.trim() || "—"}
                </span>
                <span
                  className="block truncate font-mono text-[10.5px] text-ink-400"
                  title={j.id}
                >
                  {j.id}
                </span>
              </td>
              <td className="whitespace-nowrap px-2 py-1.5 font-mono text-[11.5px] text-ink-700">
                {j.recipient_email || "—"}
              </td>
              <td className="whitespace-nowrap px-2 py-1.5 font-mono text-[11.5px] text-ink-600">
                {j.template_id || "—"}
              </td>
              <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-emerald-700">
                {fmtNumber(j.opens)}
              </td>
              <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-sky-700">
                {fmtNumber(j.clicks)}
              </td>
              <td className="whitespace-nowrap px-2 py-1.5 text-right">
                <Link
                  to={`/emails/logs?id=${encodeURIComponent(j.id)}`}
                  className="inline-flex items-center gap-1 rounded-md border border-hair bg-white px-2 py-0.5 text-[11px] text-ink-700 hover:bg-ink-50"
                  title="Im Log öffnen"
                >
                  Öffnen
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Recent Events ───────────────────────────────────────────────────

function RecentEvents({
  rows,
  loading,
}: {
  rows: EmailTrackingResponse["recent_events"];
  loading: boolean;
}) {
  if (loading && rows.length === 0) {
    return (
      <p className="py-6 text-center text-[12px] text-ink-500">
        <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />
        Lade…
      </p>
    );
  }
  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-[12px] text-ink-400">
        Keine Events im Zeitraum.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-md border border-hair">
      <table className="min-w-full divide-y divide-hair text-left text-[12px]">
        <thead className="bg-ink-50/40 text-[10.5px] uppercase tracking-[0.12em] text-ink-500">
          <tr>
            <th className="px-2 py-1.5 font-medium">Wann</th>
            <th className="px-2 py-1.5 font-medium">Typ</th>
            <th className="px-2 py-1.5 font-medium">Betreff / Empfänger</th>
            <th className="px-2 py-1.5 font-medium">Geo</th>
            <th className="px-2 py-1.5 font-medium">IP</th>
            <th className="px-2 py-1.5 font-medium">URL</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hair bg-white">
          {rows.map((ev) => {
            const meta = parseTrackingMetadata(ev.metadata);
            const geo =
              [meta?.city, meta?.country].filter(Boolean).join(", ") || "—";
            const isClick = ev.event_type === "click";
            return (
              <tr key={ev.id} className="align-top">
                <td
                  className="whitespace-nowrap px-2 py-1.5 text-ink-700"
                  title={fmtWhen(ev.created_at)}
                >
                  {fmtRelative(ev.created_at)}
                </td>
                <td className="px-2 py-1.5">
                  {isClick ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 text-[10.5px] font-medium text-sky-700">
                      <MousePointerClick className="h-3 w-3" />
                      click
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10.5px] font-medium text-emerald-700">
                      <Eye className="h-3 w-3" />
                      open
                    </span>
                  )}
                </td>
                <td className="px-2 py-1.5">
                  <Link
                    to={`/emails/logs?id=${encodeURIComponent(ev.job_id)}`}
                    className="block max-w-[18rem] truncate text-ink-800 hover:text-ink-900 hover:underline"
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
                <td className="whitespace-nowrap px-2 py-1.5 text-ink-700">
                  {geo}
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 font-mono text-[11.5px] text-ink-600">
                  {ev.ip_address || "—"}
                </td>
                <td className="px-2 py-1.5">
                  {isClick && ev.link_url ? (
                    <a
                      href={ev.link_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block max-w-[18rem] truncate text-ink-800 hover:text-ink-900 hover:underline"
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
    </div>
  );
}
