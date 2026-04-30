import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Briefcase,
  Inbox,
  KeyRound,
  Mail,
  RefreshCw,
  TimerReset,
  TrendingUp,
} from "lucide-react";
import {
  useCallback,
  useMemo,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CountUp } from "../components/Premium";
import { controllingApiUrl, type ControllingResponse } from "../lib/controllingApi";
import {
  fmtCurrency,
  fmtNumber,
  makeApiUrls,
  rangeCurrentMonthUtc,
  rangeFromPreset,
  rangeTodayUtc,
  reportsUrl,
  useApi,
  type OneautoReportsResponse,
  type OverviewRow,
} from "../lib/customerApi";
import {
  OVERVIEW_STATS_URL,
  type OverviewDailyPoint,
  type OverviewStatsResponse,
} from "../lib/overviewStatsApi";

// ────────────────────────────────────────────────────────────────────────
// Farb-Token & Util
// ────────────────────────────────────────────────────────────────────────

const C = {
  blue: "hsl(214 75% 52%)",
  blueSoft: "hsl(214 75% 92%)",
  mint: "hsl(165 55% 42%)",
  mintSoft: "hsl(165 50% 92%)",
  amber: "hsl(35 85% 50%)",
  amberSoft: "hsl(35 85% 92%)",
  purple: "hsl(265 55% 55%)",
  purpleSoft: "hsl(265 55% 92%)",
  rose: "hsl(350 75% 56%)",
  roseSoft: "hsl(350 70% 94%)",
  ink: "hsl(220 16% 22%)",
  inkSoft: "hsl(220 8% 45%)",
  hair: "hsl(220 14% 90%)",
} as const;

function fmtHours(h: number | null | undefined): string {
  if (h == null || !Number.isFinite(h)) return "–";
  if (h <= 0) return "0";
  if (h < 1 / 60) return `${Math.round(h * 3600)} s`;
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 24) return `${h.toFixed(1)} h`;
  if (h < 24 * 14) return `${(h / 24).toFixed(1)} Tage`;
  return `${(h / (24 * 7)).toFixed(1)} Wo.`;
}

function shortDay(iso: string): string {
  // "YYYY-MM-DD" → "DD.MM."
  if (iso.length < 10) return iso;
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;
}

function delta(today: number, yesterday: number): number | null {
  if (yesterday === 0) {
    return today > 0 ? null : 0;
  }
  return ((today - yesterday) / yesterday) * 100;
}

// ────────────────────────────────────────────────────────────────────────
// Building blocks
// ────────────────────────────────────────────────────────────────────────

/**
 * Flacher Container: keine Border/Schatten/Bubbles. Lediglich vertikaler
 * Abstand und – falls nötig – ein dezenter Top-Trenner. Der gesamte
 * Übersicht-Look soll ruhig und tabellarisch wirken.
 */
function Block({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={`animate-fade-up ${className}`}>{children}</div>;
}

function SectionHeader({
  title,
  subtitle,
  to,
  icon: Icon,
}: {
  title: string;
  subtitle?: string;
  to?: string;
  icon?: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        {Icon && (
          <Icon className="h-3.5 w-3.5 shrink-0 text-ink-500" aria-hidden />
        )}
        <div className="min-w-0">
          <h3 className="truncate text-[13px] font-semibold tracking-tight text-ink-900">
            {title}
          </h3>
          {subtitle && (
            <p className="mt-0.5 truncate text-[11.5px] text-ink-500">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {to && (
        <Link
          to={to}
          className="press group inline-flex shrink-0 items-center gap-0.5 text-[11.5px] text-ink-500 transition-colors hover:text-ink-900"
        >
          Details
          <ArrowRight
            className="h-3 w-3 transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </Link>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  loading,
  series,
  color,
  to,
  icon: Icon,
  hint,
  daily,
}: {
  label: string;
  value: number | null;
  loading: boolean;
  /** 30 Tage Sparkline-Werte (last value = today). */
  series?: OverviewDailyPoint[];
  color: string;
  to?: string;
  icon: ComponentType<{ className?: string }>;
  hint?: string;
  daily?: OverviewDailyPoint[];
}) {
  // Delta heute vs. gestern aus Daily-Series ableiten.
  const dlt = useMemo(() => {
    if (!daily || daily.length < 2) return null;
    const today = daily[daily.length - 1].n;
    const yesterday = daily[daily.length - 2].n;
    return delta(today, yesterday);
  }, [daily]);

  const cardCls =
    "group relative flex h-full min-w-0 flex-col py-4 transition-colors animate-fade-up";

  const inner = (
    <>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className="inline-flex h-3 w-3 shrink-0 items-center justify-center"
              style={{ color }}
              aria-hidden
            >
              <Icon className="h-3 w-3" />
            </span>
            <p className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-500">
              {label}
            </p>
          </div>
          <p
            className="mt-2.5 font-display text-[34px] leading-none tracking-tighter2 text-ink-900"
            aria-live="polite"
          >
            {loading || value == null ? "—" : <CountUp value={value} />}
          </p>
          {hint && (
            <p
              className="mt-1.5 truncate text-[11px] text-ink-500"
              title={hint}
            >
              {hint}
            </p>
          )}
        </div>
        {dlt != null && Number.isFinite(dlt) && (
          <span
            className={`inline-flex shrink-0 items-center gap-0.5 text-[11px] font-medium tabular-nums ${
              dlt > 0
                ? "text-accent-mint"
                : dlt < 0
                  ? "text-accent-rose"
                  : "text-ink-500"
            }`}
            title="Veränderung gegenüber gestern"
          >
            {dlt > 0 ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : dlt < 0 ? (
              <ArrowDownRight className="h-3 w-3" />
            ) : (
              <ArrowRight className="h-3 w-3" />
            )}
            {Math.abs(dlt) >= 1000
              ? "999%+"
              : `${Math.abs(Math.round(dlt))}%`}
          </span>
        )}
      </div>
      {series && series.length > 0 && (
        <div className="mt-3 -mx-0.5 h-10">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={series}
              margin={{ top: 1, right: 1, bottom: 0, left: 1 }}
            >
              <defs>
                <linearGradient
                  id={`kpi-grad-${label.replace(/\s+/g, "-")}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor={color} stopOpacity={0.32} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Tooltip
                cursor={{ stroke: color, strokeOpacity: 0.35 }}
                contentStyle={{
                  fontSize: 11,
                  border: "none",
                  borderRadius: 4,
                  boxShadow: "0 1px 6px hsl(0 0% 0% / 0.06)",
                  padding: "3px 8px",
                }}
                labelFormatter={(l) => shortDay(String(l))}
                formatter={(v: number) => [fmtNumber(v), "Anzahl"]}
              />
              <Area
                type="monotone"
                dataKey="n"
                stroke={color}
                strokeWidth={1.5}
                fill={`url(#kpi-grad-${label.replace(/\s+/g, "-")})`}
                dot={false}
                activeDot={{
                  r: 3,
                  fill: color,
                  stroke: "white",
                  strokeWidth: 1.5,
                }}
                isAnimationActive={false}
              />
              <XAxis dataKey="date" hide />
              <YAxis hide domain={[0, "auto"]} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </>
  );

  return to ? (
    <Link
      to={to}
      className={`${cardCls} press accent-on-hover text-ink-700 px-4 hover:bg-ink-50/40`}
    >
      {inner}
    </Link>
  ) : (
    <div className={`${cardCls} px-4`}>{inner}</div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Main Trend Chart
// ────────────────────────────────────────────────────────────────────────

type TrendKey = "submissions" | "trialSubmissions" | "newsletter";

const TREND_LABELS: Record<TrendKey, string> = {
  submissions: "Anfragen",
  trialSubmissions: "Test-Anfragen",
  newsletter: "Newsletter",
};

const TREND_COLORS: Record<TrendKey, string> = {
  submissions: C.blue,
  trialSubmissions: C.amber,
  newsletter: C.mint,
};

function TrendChart({
  daily,
}: {
  daily: NonNullable<OverviewStatsResponse["daily"]>;
}) {
  const data = useMemo(() => {
    const days = daily.submissions.length;
    return Array.from({ length: days }, (_, i) => ({
      date: daily.submissions[i].date,
      submissions: daily.submissions[i].n,
      trialSubmissions: daily.trialSubmissions[i]?.n ?? 0,
      newsletter: daily.newsletter[i]?.n ?? 0,
    }));
  }, [daily]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <defs>
          {(Object.keys(TREND_COLORS) as TrendKey[]).map((k) => (
            <linearGradient key={k} id={`trend-${k}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={TREND_COLORS[k]} stopOpacity={0.25} />
              <stop offset="100%" stopColor={TREND_COLORS[k]} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid stroke={C.hair} vertical={false} strokeDasharray="2 4" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: C.inkSoft }}
          axisLine={false}
          tickLine={false}
          tickFormatter={shortDay}
          minTickGap={28}
        />
        <YAxis
          tick={{ fontSize: 10, fill: C.inkSoft }}
          width={36}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            fontSize: 12,
            border: "none",
            borderRadius: 6,
            boxShadow: "0 4px 12px hsl(0 0% 0% / 0.08)",
            padding: "6px 10px",
          }}
          labelFormatter={(l) => shortDay(String(l))}
          formatter={(v: number, name: string) => [
            fmtNumber(v),
            TREND_LABELS[name as TrendKey] ?? name,
          ]}
        />
        <Legend
          wrapperStyle={{ fontSize: 11, paddingTop: 6 }}
          formatter={(v: string) => TREND_LABELS[v as TrendKey] ?? v}
          iconType="circle"
        />
        {(Object.keys(TREND_COLORS) as TrendKey[]).map((k) => (
          <Area
            key={k}
            type="monotone"
            dataKey={k}
            stroke={TREND_COLORS[k]}
            strokeWidth={2}
            fill={`url(#trend-${k})`}
            dot={false}
            activeDot={{ r: 3 }}
            isAnimationActive={false}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Sub-charts (existing, refined)
// ────────────────────────────────────────────────────────────────────────

function OneautoHistoryChart({ data }: { data: OneautoReportsResponse | null }) {
  const months = data?.months ?? [];
  const chart = useMemo(() => {
    const slice = months.slice(0, 12).reverse();
    return slice.map((m) => ({
      name:
        m.month.length >= 7
          ? `${m.month.slice(5, 7)}/${m.month.slice(2, 4)}`
          : m.month,
      eur: Number(m.eur ?? 0),
      gbp: Number(m.gbp ?? 0),
      views: Number(m.views ?? 0),
    }));
  }, [months]);
  if (chart.length === 0) {
    return <EmptyChart label="Noch keine Monatswerte" />;
  }
  const totalEur = chart.reduce((acc, m) => acc + m.eur, 0);
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-baseline justify-between px-1 pb-1">
        <p className="text-[10.5px] uppercase tracking-[0.12em] text-ink-500">
          Letzte {chart.length} Monate · EUR (ca.)
        </p>
        <p className="font-display text-[18px] tracking-tightish text-ink-900">
          {fmtCurrency(totalEur, "EUR")}
        </p>
      </div>
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
            <defs>
              <linearGradient id="bar-eur" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C.purple} stopOpacity={0.95} />
                <stop offset="100%" stopColor={C.purple} stopOpacity={0.55} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={C.hair} vertical={false} strokeDasharray="2 4" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 9.5, fill: C.inkSoft }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: C.inkSoft }}
              width={48}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) =>
                v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(v)
              }
            />
            <Tooltip
              cursor={{ fill: "hsl(220 20% 96% / 0.5)" }}
              contentStyle={{
                fontSize: 12,
                border: "none",
                borderRadius: 6,
                boxShadow: "0 4px 12px hsl(0 0% 0% / 0.08)",
              }}
              formatter={(v: number, n: string) =>
                n === "eur"
                  ? [fmtCurrency(v, "EUR"), "EUR (ca.)"]
                  : [fmtNumber(v), n]
              }
            />
            <Bar
              dataKey="eur"
              maxBarSize={28}
              fill="url(#bar-eur)"
              radius={[3, 3, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function RequestsChart({
  day,
  week,
  month,
}: {
  day: number;
  week: number;
  month: number;
}) {
  const data = useMemo(
    () => [
      { label: "Heute", n: day, color: C.blue },
      { label: "7 Tage", n: week, color: `${C.blue}cc` },
      { label: "Monat", n: month, color: `${C.blue}99` },
    ],
    [day, week, month],
  );
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
        barCategoryGap="25%"
      >
        <CartesianGrid stroke={C.hair} vertical={false} strokeDasharray="2 4" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: C.inkSoft }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: C.inkSoft }}
          width={48}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: "hsl(220 20% 96% / 0.5)" }}
          contentStyle={{
            fontSize: 12,
            border: "none",
            borderRadius: 6,
            boxShadow: "0 4px 12px hsl(0 0% 0% / 0.08)",
          }}
          formatter={(v: number) => [fmtNumber(v), "Requests"]}
        />
        <Bar dataKey="n" maxBarSize={56} radius={[3, 3, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function KeysSplitChart({
  productive,
  test,
}: {
  productive: number;
  test: number;
}) {
  const data = useMemo(
    () => [
      { name: "Produktiv", value: Math.max(0, productive), color: C.purple },
      { name: "Test", value: Math.max(0, test), color: C.amber },
    ],
    [productive, test],
  );
  const total = data.reduce((a, d) => a + d.value, 0);
  if (total === 0) {
    return <EmptyChart label="Keine aktiven Keys" />;
  }
  return (
    <div className="flex h-full items-center gap-4">
      <div className="relative h-full min-w-0 flex-[1.4]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="60%"
              outerRadius="92%"
              paddingAngle={2}
              strokeWidth={0}
              isAnimationActive={false}
            >
              {data.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v: number, n: string) => [
                `${fmtNumber(v)} · ${total > 0 ? Math.round((v / total) * 100) : 0}%`,
                n,
              ]}
              contentStyle={{
                fontSize: 12,
                border: "none",
                borderRadius: 6,
                boxShadow: "0 4px 12px hsl(0 0% 0% / 0.08)",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <p className="font-display text-[24px] leading-none tracking-tighter2 text-ink-900">
            {fmtNumber(total)}
          </p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-ink-500">
            Aktive Keys
          </p>
        </div>
      </div>
      <ul className="flex flex-1 flex-col gap-2 text-[12px]">
        {data.map((d) => (
          <li key={d.name} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: d.color }}
              />
              <span className="truncate text-ink-700">{d.name}</span>
            </span>
            <span className="shrink-0 tabular-nums text-ink-900">
              {fmtNumber(d.value)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EtaCompareBar({
  noNew,
  withFlow,
}: {
  noNew: number | null;
  withFlow: number | null;
}) {
  const h1 = noNew && Number.isFinite(noNew) ? Math.max(0, noNew) : 0;
  const h2 = withFlow && Number.isFinite(withFlow) ? Math.max(0, withFlow) : 0;
  if (h1 <= 0 && h2 <= 0) {
    return <EmptyChart label="Keine Schätzwerte" />;
  }
  const data = [
    { name: "Ohne neuen Zufluss", h: h1, color: C.mint },
    { name: "Bei laufendem Zufluss", h: h2, color: C.rose },
  ];
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        layout="vertical"
        data={data}
        margin={{ top: 4, right: 28, left: 8, bottom: 0 }}
      >
        <CartesianGrid stroke={C.hair} horizontal={false} strokeDasharray="2 4" />
        <XAxis
          type="number"
          tick={{ fontSize: 10, fill: C.inkSoft }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v}h`}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={150}
          tick={{ fontSize: 10.5, fill: C.inkSoft }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: "hsl(220 20% 96% / 0.4)" }}
          contentStyle={{
            fontSize: 12,
            border: "none",
            borderRadius: 6,
            boxShadow: "0 4px 12px hsl(0 0% 0% / 0.08)",
          }}
          formatter={(v: number) => [fmtHours(v), "ETA"]}
        />
        <Bar dataKey="h" maxBarSize={20} radius={[0, 4, 4, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function NewslettersVsAnfragenLines({
  daily,
}: {
  daily: NonNullable<OverviewStatsResponse["daily"]>;
}) {
  const data = useMemo(() => {
    const len = daily.submissions.length;
    return Array.from({ length: len }, (_, i) => ({
      date: daily.submissions[i].date,
      submissions: daily.submissions[i].n,
      newsletter: daily.newsletter[i]?.n ?? 0,
    }));
  }, [daily]);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={C.hair} vertical={false} strokeDasharray="2 4" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 9.5, fill: C.inkSoft }}
          axisLine={false}
          tickLine={false}
          tickFormatter={shortDay}
          minTickGap={32}
        />
        <YAxis
          tick={{ fontSize: 10, fill: C.inkSoft }}
          width={32}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            fontSize: 12,
            border: "none",
            borderRadius: 6,
            boxShadow: "0 4px 12px hsl(0 0% 0% / 0.08)",
          }}
          labelFormatter={(l) => shortDay(String(l))}
          formatter={(v: number, n: string) => [
            fmtNumber(v),
            n === "submissions" ? "Anfragen" : "Newsletter",
          ]}
        />
        <Line
          type="monotone"
          dataKey="submissions"
          stroke={C.blue}
          strokeWidth={1.8}
          dot={false}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="newsletter"
          stroke={C.mint}
          strokeWidth={1.8}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="grid h-full place-items-center text-[12.5px] text-ink-500">
      {label}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────────────

type JobsResp = { total: number };

export default function OverviewPage() {
  const api = useMemo(() => makeApiUrls("customers"), []);
  const [reqUrls] = useState(() => ({
    day: api.overview(rangeTodayUtc()),
    week: api.overview(rangeFromPreset("7d")),
    month: api.overview(rangeCurrentMonthUtc()),
  }));
  const [cRange] = useState(() => rangeFromPreset("7d"));
  const controllingUrl = useMemo(
    () =>
      controllingApiUrl(cRange, {
        gapMinutes: 30,
        blob4: "nonempty",
        limit: 100_000,
      }),
    [cRange],
  );
  const oneautoUrl = useMemo(() => reportsUrl(12), []);
  const jobsUrl = "/api/intern-analytics/controll-jobs?check=0&limit=1" as const;

  const stat = useApi<OverviewStatsResponse>(OVERVIEW_STATS_URL);
  const reqD = useApi<{ row: OverviewRow }>(reqUrls.day);
  const reqW = useApi<{ row: OverviewRow }>(reqUrls.week);
  const reqM = useApi<{ row: OverviewRow }>(reqUrls.month);
  const oneauto = useApi<OneautoReportsResponse>(oneautoUrl);
  const ctrl = useApi<ControllingResponse>(controllingUrl);
  const jobs = useApi<JobsResp>(jobsUrl);

  const reloadAll = useCallback(() => {
    stat.reload();
    reqD.reload();
    reqW.reload();
    reqM.reload();
    oneauto.reload();
    ctrl.reload();
    jobs.reload();
  }, [stat, reqD, reqW, reqM, oneauto, ctrl, jobs]);

  const anyLoading =
    stat.loading ||
    reqD.loading ||
    reqW.loading ||
    reqM.loading ||
    oneauto.loading ||
    ctrl.loading ||
    jobs.loading;

  const errorParts = [
    stat.error,
    reqD.error,
    reqW.error,
    reqM.error,
    oneauto.error,
    ctrl.error,
    jobs.error,
  ].filter(Boolean);

  const rDay = reqD.error ? 0 : (reqD.data?.row?.requests ?? 0);
  const rWeek = reqW.error ? 0 : (reqW.data?.row?.requests ?? 0);
  const rMonth = reqM.error ? 0 : (reqM.data?.row?.requests ?? 0);
  const requestsReady =
    !reqD.error &&
    !reqW.error &&
    !reqM.error &&
    !reqD.loading &&
    !reqW.loading &&
    !reqM.loading;

  const daily = stat.data?.daily;

  const activeKeysTotal = stat.data?.activeKeys
    ? stat.data.activeKeys.productive + stat.data.activeKeys.test
    : null;

  const updatedAt = useMemo(() => new Date().toLocaleTimeString("de-DE"), [
    // recompute when any of these change
    stat.data,
    reqD.data,
    reqW.data,
    reqM.data,
    oneauto.data,
    ctrl.data,
    jobs.data,
  ]);

  return (
    <>
      {/* Header — kompakte Toolbar; der Seitenname steht bereits oben */}
      <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <p className="max-w-2xl text-[13px] leading-relaxed text-ink-500">
          Live-Kennzahlen aus Website, API, Oneauto und Controlling — mit
          30-Tage-Trends pro Quelle. Klick auf eine Karte öffnet die
          Detailansicht.
        </p>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-[11px] tabular-nums text-ink-400">
            zuletzt {updatedAt}
          </span>
          <button
            type="button"
            onClick={reloadAll}
            disabled={anyLoading}
            className="inline-flex items-center gap-1.5 rounded-md border border-hair bg-white px-3 py-1.5 text-[12.5px] text-ink-700 shadow-sm transition-colors hover:border-ink-300 hover:text-ink-900 disabled:opacity-40"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${anyLoading ? "animate-spin" : ""}`}
              aria-hidden
            />
            Aktualisieren
          </button>
        </div>
      </div>

      {errorParts.length > 0 && (
        <p
          className="mb-6 rounded-md border border-accent-rose/30 bg-accent-rose/5 px-3 py-2 text-[12px] text-accent-rose"
          role="status"
        >
          {errorParts.join(" · ")}
        </p>
      )}

      {/* KPI Strip — flach, mit dezentem Trenner zwischen den Spalten */}
      <div className="stagger-children mb-10 grid grid-cols-1 divide-y divide-hair border-y border-hair sm:grid-cols-2 sm:divide-y-0 sm:divide-x lg:grid-cols-5">
        <KpiCard
          label="Anfragen heute"
          value={stat.data?.website.submissions.day ?? null}
          loading={stat.loading}
          color={C.blue}
          icon={Inbox}
          to="/kunden/anfragen"
          hint={
            stat.data
              ? `Monat: ${fmtNumber(stat.data.website.submissions.month)} · 7 T: ${fmtNumber(stat.data.website.submissions.week)}`
              : undefined
          }
          series={daily?.submissions}
          daily={daily?.submissions}
        />
        <KpiCard
          label="Test-Anfragen"
          value={stat.data?.website.trialSubmissions.day ?? null}
          loading={stat.loading}
          color={C.amber}
          icon={Inbox}
          to="/kunden/test-anfragen"
          hint={
            stat.data
              ? `Monat: ${fmtNumber(stat.data.website.trialSubmissions.month)} · 7 T: ${fmtNumber(stat.data.website.trialSubmissions.week)}`
              : undefined
          }
          series={daily?.trialSubmissions}
          daily={daily?.trialSubmissions}
        />
        <KpiCard
          label="Newsletter"
          value={stat.data?.website.newsletter.day ?? null}
          loading={stat.loading}
          color={C.mint}
          icon={Mail}
          to="/kunden/newsletter"
          hint={
            stat.data
              ? `Monat: ${fmtNumber(stat.data.website.newsletter.month)} · 7 T: ${fmtNumber(stat.data.website.newsletter.week)}`
              : undefined
          }
          series={daily?.newsletter}
          daily={daily?.newsletter}
        />
        <KpiCard
          label="Aktive Keys"
          value={activeKeysTotal}
          loading={stat.loading}
          color={C.purple}
          icon={KeyRound}
          to="/kunden/keys"
          hint={
            stat.data?.activeKeys
              ? `Produktiv: ${fmtNumber(stat.data.activeKeys.productive)} · Test: ${fmtNumber(stat.data.activeKeys.test)}`
              : "Kein Keys-Binding"
          }
        />
        <KpiCard
          label="Offene Jobs"
          value={jobs.data?.total ?? null}
          loading={jobs.loading}
          color={C.rose}
          icon={Briefcase}
          to="/intern-analytics/jobs"
          hint="Controlling – check = 0"
        />
      </div>

      {/* Trend (full width) */}
      <Block className="mb-12">
        <SectionHeader
          title="30-Tage-Trend"
          subtitle="Anfragen, Test-Anfragen und Newsletter (UTC, lückenfüllend)"
          icon={TrendingUp}
        />
        <div className="h-[320px] w-full">
          {daily ? (
            <TrendChart daily={daily} />
          ) : (
            <EmptyChart
              label={
                stat.loading
                  ? "Lade Trends …"
                  : stat.error
                    ? "Trends nicht verfügbar"
                    : "Keine Daten"
              }
            />
          )}
        </div>
      </Block>

      {/* Sub-charts grid — Linien-/Trenner-Layout statt Boxes */}
      <div className="grid grid-cols-1 gap-x-12 gap-y-12 border-t border-hair pt-10 lg:grid-cols-12">
        <Block className="lg:col-span-7 lg:border-r lg:border-hair lg:pr-12">
          <SectionHeader
            title="Oneauto-Bilanz"
            subtitle="Letzte 12 Monate · EUR (ca.)"
            icon={TrendingUp}
            to="/analytics/oneauto-reports"
          />
          <div className="h-[280px] w-full">
            {oneauto.error ? (
              <EmptyChart label="Oneauto: Fehler beim Laden" />
            ) : oneauto.loading && !oneauto.data ? (
              <EmptyChart label="Lade …" />
            ) : (
              <OneautoHistoryChart data={oneauto.data} />
            )}
          </div>
        </Block>

        <Block className="lg:col-span-5">
          <SectionHeader
            title="Aktive Keys: Verteilung"
            subtitle="Nur unabgelaufene Keys"
            icon={KeyRound}
            to="/kunden/keys"
          />
          <div className="h-[280px] w-full">
            {stat.data?.activeKeys ? (
              <KeysSplitChart
                productive={stat.data.activeKeys.productive}
                test={stat.data.activeKeys.test}
              />
            ) : (
              <EmptyChart
                label={
                  stat.loading ? "Lade …" : "Kein customer_keys-Binding"
                }
              />
            )}
          </div>
        </Block>

        <Block className="lg:col-span-5 lg:border-t lg:border-hair lg:pt-10">
          <SectionHeader
            title="Kunden-API: Requests"
            subtitle="Heute · 7 Tage · Monat"
            icon={TrendingUp}
            to="/analytics/kunden-api"
          />
          <div className="h-[260px] w-full">
            {!requestsReady ? (
              <EmptyChart
                label={
                  reqD.error || reqW.error || reqM.error
                    ? "API: Fehler"
                    : "Lade …"
                }
              />
            ) : (
              <RequestsChart day={rDay} week={rWeek} month={rMonth} />
            )}
          </div>
        </Block>

        <Block className="lg:col-span-7 lg:border-l lg:border-t lg:border-hair lg:pl-12 lg:pt-10">
          <SectionHeader
            title="Anfragen vs. Newsletter"
            subtitle="Tagesvergleich (30 Tage)"
            icon={TrendingUp}
            to="/kunden/newsletter"
          />
          <div className="h-[260px] w-full">
            {daily ? (
              <NewslettersVsAnfragenLines daily={daily} />
            ) : (
              <EmptyChart label="Keine Daten" />
            )}
          </div>
        </Block>

        <Block className="lg:col-span-12 lg:border-t lg:border-hair lg:pt-10">
          <SectionHeader
            title="Voraussichtliche Bearbeitungszeit"
            subtitle="7-Tage-Rückblick · Session-Gap 30 min · nur Zeilen mit blob4"
            icon={TimerReset}
            to="/intern-analytics/controlling"
          />
          <div className="h-[180px] w-full">
            {ctrl.error ? (
              <EmptyChart label="Controlling: Fehler beim Laden" />
            ) : ctrl.data ? (
              <EtaCompareBar
                noNew={ctrl.data.global.etaIfNoNewHours}
                withFlow={ctrl.data.global.etaIfKeepsAddingHours}
              />
            ) : (
              <EmptyChart label="Lade …" />
            )}
          </div>
        </Block>
      </div>
    </>
  );
}
