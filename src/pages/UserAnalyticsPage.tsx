import {
  AlertCircle,
  ArrowLeft,
  ChevronRight,
  FileDown,
  Loader2,
  LogOut,
  RefreshCw,
  Search,
  Users as UsersIcon,
} from "lucide-react";
import {
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { Logo } from "../components/brand/Logo";
import SplitView from "../components/layout/SplitView";
import { useAuth } from "../lib/auth";
import {
  PRESETS,
  aeTimestampToDate,
  fmtDateTime,
  fmtNumber,
  fmtRelative,
  rangeFromPreset,
  useApi,
  type Range,
} from "../lib/customerApi";
import {
  userAnalyticsApiUrl,
  type DetailReport,
  type UserAnalyticsResponse,
  type UserListEntry,
} from "../lib/userAnalyticsApi";

// ---------- Format-Helper ----------

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
  if (Math.abs(v) < 1) return `${v.toFixed(2)} ${unit}`;
  if (Math.abs(v) < 100) return `${v.toFixed(1)} ${unit}`;
  return `${fmtNumber(v, { maximumFractionDigits: 0 })} ${unit}`;
}

function fmtMs(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return "–";
  if (ms < 1) return `${ms.toFixed(2)} ms`;
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function fmtHours(h: number | null | undefined): string {
  if (h == null || !Number.isFinite(h)) return "–";
  if (h <= 0) return "0";
  if (h < 1 / 60) return `${Math.round(h * 3600)} s`;
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 24) return `${h.toFixed(1)} h`;
  if (h < 24 * 14) return `${(h / 24).toFixed(1)} Tage`;
  if (h < 24 * 30 * 6) return `${(h / 24 / 7).toFixed(1)} Wochen`;
  return `${(h / 24 / 30).toFixed(1)} Monate`;
}

function fmtDay(s: string): string {
  // s ist YYYY-MM-DD
  try {
    const d = new Date(`${s}T00:00:00Z`);
    return new Intl.DateTimeFormat("de-DE", {
      day: "2-digit",
      month: "2-digit",
      timeZone: "UTC",
    }).format(d);
  } catch {
    return s;
  }
}

function shortenUserAgent(ua: string | null | undefined): string {
  if (!ua) return "–";
  // Heuristisch: Browser + OS extrahieren
  const browserMatch =
    /(Edg|OPR|Chrome|Firefox|Version|Safari|MSIE|Trident)\/([\d.]+)/i.exec(ua);
  const osMatch =
    /(Windows NT [\d.]+|Mac OS X [\d_.]+|iPhone OS [\d_]+|Android [\d.]+|Linux)/i.exec(
      ua,
    );
  let browser: string | null = null;
  if (browserMatch) {
    const name =
      browserMatch[1] === "Edg"
        ? "Edge"
        : browserMatch[1] === "OPR"
          ? "Opera"
          : browserMatch[1] === "Version"
            ? "Safari"
            : browserMatch[1];
    browser = `${name} ${browserMatch[2].split(".")[0]}`;
  }
  let os: string | null = null;
  if (osMatch) {
    os = osMatch[1].replace(/_/g, ".").replace("Mac OS X", "macOS");
  }
  if (browser && os) return `${browser} · ${os}`;
  if (browser) return browser;
  if (os) return os;
  return ua.length > 80 ? `${ua.slice(0, 77)}…` : ua;
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

const WEEKDAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

const ALL_USERS_KEY = "__all__";

// ---------- Page ----------

export default function UserAnalyticsPage() {
  const { user, logout } = useAuth();
  const [range, setRange] = useState<Range>(() => rangeFromPreset("30d"));
  // selection: entweder der konkrete user-name oder ALL_USERS_KEY
  const [selection, setSelection] = useState<string>(ALL_USERS_KEY);
  const [selectedIp, setSelectedIp] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const isAggregate = selection === ALL_USERS_KEY;
  const url = useMemo(
    () =>
      userAnalyticsApiUrl(range, {
        user: isAggregate ? null : selection,
        ip: selectedIp,
        aggregate: isAggregate,
        gapMinutes: 5,
        limit: 100_000,
      }),
    [range, selection, selectedIp, isAggregate],
  );

  const { data, error, loading, reload } =
    useApi<UserAnalyticsResponse>(url);

  const onSelect = useCallback((key: string) => {
    setSelection((prev) => (prev === key ? prev : key));
    setSelectedIp(null);
  }, []);

  const filteredUsers = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!data?.users) return [];
    if (!t) return data.users;
    return data.users.filter((u) => u.user.toLowerCase().includes(t));
  }, [data?.users, q]);

  const aside = (
    <Sidebar
      users={filteredUsers}
      total={data?.users?.length ?? 0}
      loading={loading && !data}
      error={error}
      query={q}
      onQuery={setQ}
      selection={selection}
      onSelect={onSelect}
      selectedIp={selectedIp}
      onSelectIp={setSelectedIp}
      detail={data?.detail ?? null}
    />
  );

  const handlePrint = useCallback(() => {
    if (typeof window === "undefined") return;
    window.print();
  }, []);

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-paper text-ink-900">
      {/* On-screen Top-Bar (für Druck ausgeblendet) */}
      <header className="shrink-0 border-b border-hair bg-paper print:hidden">
        <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-[12px] text-ink-500 transition-colors hover:text-ink-900"
            >
              <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
              Plattform
            </Link>
            <span aria-hidden className="h-4 w-px shrink-0 bg-hair" />
            <Link to="/" className="inline-flex min-w-0 items-center gap-2">
              <Logo className="h-[15px] w-auto shrink-0 text-ink-900/80" />
              <span className="hidden truncate text-[11px] uppercase tracking-[0.18em] text-ink-400 sm:inline">
                User Analytics
              </span>
            </Link>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <RangeSelector range={range} onRange={setRange} />
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-md border border-hair bg-white px-2.5 py-1.5 text-[11px] font-medium text-ink-700 transition hover:bg-night-900/[0.04]"
            >
              <FileDown className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">PDF Export</span>
            </button>
            <button
              type="button"
              onClick={() => reload()}
              className="inline-flex items-center gap-1.5 rounded-md border border-hair bg-white px-2.5 py-1.5 text-[11px] font-medium text-ink-700 transition hover:bg-night-900/[0.04]"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
              />
              <span className="hidden sm:inline">Aktualisieren</span>
            </button>
            {user && (
              <span className="hidden max-w-[120px] truncate text-[12px] text-ink-500 md:inline">
                {user.benutzername}
              </span>
            )}
            <button
              type="button"
              onClick={() => void logout()}
              className="inline-flex items-center gap-2 rounded-md border border-hair bg-white px-2.5 py-1.5 text-[12px] font-medium text-ink-800 transition-colors hover:bg-night-900/[0.04]"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Abmelden</span>
            </button>
          </div>
        </div>
      </header>

      {/* Screen-Content */}
      <div className="flex min-h-0 flex-1 basis-0 flex-col overflow-hidden print:hidden">
        <SplitView
          storageKey="ui.userAnalytics.aside"
          asideLabel="User"
          asideWidthClass="md:w-[300px]"
          asideContent={aside}
          className="min-h-0 flex-1"
        >
          <DetailPane
            data={data}
            loading={loading}
            error={error}
            selection={selection}
            selectedIp={selectedIp}
            onSelectIp={setSelectedIp}
            range={range}
          />
        </SplitView>
      </div>

      {/* Print-only Layout (DIN A4) */}
      <PrintReport data={data} range={range} />
    </div>
  );
}

// ---------- Range Selector ----------

function RangeSelector({
  range,
  onRange,
}: {
  range: Range;
  onRange: (r: Range) => void;
}) {
  return (
    <div className="hidden gap-1 rounded-md border border-hair bg-white p-0.5 sm:inline-flex">
      {PRESETS.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onRange(rangeFromPreset(p.id))}
          className={`rounded px-2 py-1 text-[11px] font-medium transition ${
            range.preset === p.id
              ? "bg-ink-900 text-white"
              : "text-ink-600 hover:bg-night-900/[0.04]"
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

// ---------- Sidebar ----------

function Sidebar({
  users,
  total,
  loading,
  error,
  query,
  onQuery,
  selection,
  onSelect,
  selectedIp,
  onSelectIp,
  detail,
}: {
  users: UserListEntry[];
  total: number;
  loading: boolean;
  error: string | null;
  query: string;
  onQuery: (q: string) => void;
  selection: string;
  onSelect: (key: string) => void;
  selectedIp: string | null;
  onSelectIp: (ip: string | null) => void;
  detail: DetailReport | null;
}) {
  const isAllSelected = selection === ALL_USERS_KEY;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-hair p-3 pr-9">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-400">
          User ({total})
        </p>
        <div className="relative mt-2">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="User suchen …"
            className="w-full rounded-md border border-hair bg-white py-1.5 pl-8 pr-2 text-[12.5px] text-ink-800 placeholder:text-ink-400 focus:border-ink-400 focus:outline-none"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Eintrag „Alle User" */}
        <button
          type="button"
          onClick={() => onSelect(ALL_USERS_KEY)}
          className={`flex w-full items-center gap-2 border-b border-hair px-3 py-2.5 text-left transition ${
            isAllSelected ? "bg-ink-900/[0.06]" : "hover:bg-night-900/[0.04]"
          }`}
        >
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink-900 text-[11px] font-semibold text-white">
            <UsersIcon className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-medium text-ink-900">
              Alle User · Gesamt
            </p>
            <p className="text-[10.5px] text-ink-500">
              Aggregierter Bericht über alle Plattform-User
            </p>
          </div>
          {isAllSelected && (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-400" />
          )}
        </button>
        {isAllSelected && detail && detail.perIp.length > 0 && (
          <ul className="border-b border-hair bg-ink-50/40 py-1">
            <SidebarIpItem
              ip={null}
              count={detail.summary.eventCount}
              active={selectedIp == null}
              onClick={() => onSelectIp(null)}
              label="Gesamt"
            />
            {detail.perIp.slice(0, 8).map((ip) => (
              <SidebarIpItem
                key={ip.ip}
                ip={ip.ip}
                count={ip.events}
                active={selectedIp === ip.ip}
                onClick={() => onSelectIp(ip.ip)}
              />
            ))}
          </ul>
        )}

        {loading && users.length === 0 ? (
          <div className="flex items-center gap-2 p-4 text-[12px] text-ink-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Lade …
          </div>
        ) : error && users.length === 0 ? (
          <div className="flex items-start gap-2 px-3 py-3 text-[12px] text-accent-rose">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="break-words">{error}</span>
          </div>
        ) : users.length === 0 ? (
          <p className="px-3 py-4 text-[12px] text-ink-400">Keine User im Zeitraum.</p>
        ) : (
          <ul className="divide-y divide-hair">
            {users.map((u) => {
              const active = !isAllSelected && u.user === selection;
              return (
                <li key={u.user}>
                  <button
                    type="button"
                    onClick={() => onSelect(u.user)}
                    className={`flex w-full items-center gap-2 px-3 py-2.5 text-left transition ${
                      active ? "bg-ink-900/[0.06]" : "hover:bg-night-900/[0.04]"
                    }`}
                  >
                    <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink-100 text-[11px] font-semibold uppercase text-ink-700">
                      {u.user.slice(0, 2)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-medium text-ink-900">
                        {u.user}
                      </p>
                      <p className="truncate text-[10.5px] text-ink-500">
                        {fmtNumber(u.eventCount)} Events ·{" "}
                        {fmtNumber(u.actionCount)} Aktionen ·{" "}
                        {fmtDuration(u.totalActiveSec)} aktiv
                      </p>
                    </div>
                    {active && (
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-400" />
                    )}
                  </button>
                  {active && detail && detail.perIp.length > 0 && (
                    <ul className="border-t border-hair bg-ink-50/40 py-1">
                      <SidebarIpItem
                        ip={null}
                        count={detail.summary.eventCount}
                        active={selectedIp == null}
                        onClick={() => onSelectIp(null)}
                        label="Gesamt"
                      />
                      {detail.perIp.map((ip) => (
                        <SidebarIpItem
                          key={ip.ip}
                          ip={ip.ip}
                          count={ip.events}
                          active={selectedIp === ip.ip}
                          onClick={() => onSelectIp(ip.ip)}
                        />
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function SidebarIpItem({
  ip,
  count,
  active,
  onClick,
  label,
}: {
  ip: string | null;
  count: number;
  active: boolean;
  onClick: () => void;
  label?: string;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11.5px] transition ${
          active ? "bg-ink-900/[0.05] text-ink-900" : "text-ink-600 hover:bg-night-900/[0.04]"
        }`}
      >
        <span className="truncate font-mono">{label ?? ip ?? "(leer)"}</span>
        <span className="ml-auto whitespace-nowrap text-[10.5px] text-ink-400">
          {fmtNumber(count)}
        </span>
      </button>
    </li>
  );
}

// ---------- Detail-Pane (Layout-Skelett) ----------

function DetailPane({
  data,
  loading,
  error,
  selection,
  selectedIp,
  onSelectIp,
  range,
}: {
  data: UserAnalyticsResponse | null;
  loading: boolean;
  error: string | null;
  selection: string;
  selectedIp: string | null;
  onSelectIp: (ip: string | null) => void;
  range: Range;
}) {
  if (loading && !data) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center text-[13px] text-ink-400">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Lade Daten …
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex min-h-0 flex-1 items-start gap-2 px-6 py-8 text-[13px] text-accent-rose">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  const detail = data?.detail ?? null;

  if (!detail) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-12 text-[13px] text-ink-500">
        Keine Daten für{" "}
        <span className="ml-1 font-mono text-ink-800">
          {selection === ALL_USERS_KEY ? "Alle User" : selection}
        </span>
        {selectedIp ? (
          <>
            {" / "}
            <span className="font-mono text-ink-800">{selectedIp}</span>
          </>
        ) : null}
        {" "}im Zeitraum.
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <DetailHeader
        detail={detail}
        users={data?.users ?? []}
        range={range}
        onSelectIp={onSelectIp}
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1500px] divide-y divide-hair">
          <DailyActivityBlock detail={detail} />
          <TempoBlock detail={detail} />
          <KpiBlock detail={detail} />
          <ModesBlock detail={detail} />
          <ButtonsTimelineBlock detail={detail} />
          <ActivityChartBlock detail={detail} />
          <NetworkSpeedBlock detail={detail} />
          <SessionsBlock detail={detail} />
          <PerIpBlock detail={detail} onSelectIp={onSelectIp} />
          <DistributionBlock detail={detail} />
          <VehiclesBlock detail={detail} />
          <BreakdownsBlock detail={detail} />
        </div>
      </div>
    </div>
  );
}

function DetailHeader({
  detail,
  users,
  range,
  onSelectIp,
}: {
  detail: DetailReport;
  users: UserListEntry[];
  range: Range;
  onSelectIp: (ip: string | null) => void;
}) {
  const isAggregate = detail.scope.aggregate;
  const s = detail.summary;
  const subtitle = (
    <>
      <span className="font-mono">{range.from}</span>
      {" → "}
      <span className="font-mono">{range.to}</span>
      {s.firstTs && s.lastTs && (
        <>
          {" · letzte Aktivität "}
          {fmtRelative(s.lastTs)}
        </>
      )}
    </>
  );
  return (
    <div className="shrink-0 border-b border-hair bg-white px-4 py-4 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-400">
            User-Bericht
          </p>
          <h2 className="mt-0.5 font-display text-[26px] tracking-tightish text-ink-900">
            {isAggregate
              ? `Alle User (${s.uniqueUsers} aktiv)`
              : detail.user}
          </h2>
          {s.primaryUserAgent && (
            <p
              className="mt-0.5 truncate font-mono text-[11.5px] text-ink-500"
              title={s.primaryUserAgent}
            >
              {shortenUserAgent(s.primaryUserAgent)}
            </p>
          )}
          <p className="mt-1.5 text-[12px] text-ink-500">{subtitle}</p>
          <p className="mt-0.5 text-[11.5px] text-ink-500">
            {detail.scope.ip ? (
              <>
                eingeschränkt auf IP{" "}
                <span className="font-mono text-ink-700">{detail.scope.ip}</span>
                {" · "}
                <button
                  type="button"
                  onClick={() => onSelectIp(null)}
                  className="text-ink-700 underline-offset-2 hover:underline"
                >
                  Filter aufheben
                </button>
              </>
            ) : (
              <>
                {fmtNumber(s.uniqueIps)} IP-Adressen ·{" "}
                {fmtNumber(s.uniqueDays)} Tage aktiv ·{" "}
                {users.length} User in der Liste
              </>
            )}
          </p>
        </div>
        <HeaderHighlight
          totalActiveSec={s.totalActiveSec}
          totalRemaining={s.totalRemaining}
          etaHoursActive={s.etaHoursActive}
          etaHoursCalendar={s.etaHoursCalendar}
        />
      </div>
    </div>
  );
}

function HeaderHighlight({
  totalActiveSec,
  totalRemaining,
  etaHoursActive,
  etaHoursCalendar,
}: {
  totalActiveSec: number;
  totalRemaining: number | null;
  etaHoursActive: number | null;
  etaHoursCalendar: number | null;
}) {
  return (
    <div className="grid grid-cols-3 gap-x-8 gap-y-1 text-right">
      <div>
        <p className="text-[10px] uppercase tracking-[0.14em] text-ink-400">
          Aktive Zeit
        </p>
        <p className="mt-0.5 font-display text-[22px] leading-none tracking-tightish text-ink-900">
          {(totalActiveSec / 3600).toFixed(1)}
          <span className="ml-1 text-[12px] text-ink-500">h</span>
        </p>
        <p className="text-[10px] text-ink-500">{fmtDuration(totalActiveSec)}</p>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-[0.14em] text-ink-400">
          Offen aktuell
        </p>
        <p className="mt-0.5 font-display text-[22px] leading-none tracking-tightish text-ink-900">
          {totalRemaining != null ? fmtNumber(totalRemaining) : "–"}
        </p>
        <p className="text-[10px] text-ink-500">Fahrzeuge in allen Modi</p>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-[0.14em] text-ink-400">
          Restdauer
        </p>
        <p className="mt-0.5 font-display text-[22px] leading-none tracking-tightish text-ink-900">
          {fmtHours(etaHoursActive)}
        </p>
        <p className="text-[10px] text-ink-500">
          24-h-Sicht: {fmtHours(etaHoursCalendar)}
        </p>
      </div>
    </div>
  );
}

// ---------- KPI-Block (kein Kästchen-Look, Listen-Tabelle) ----------

function KpiRow({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="grid grid-cols-12 items-baseline gap-2 border-b border-dashed border-hair py-2 last:border-b-0">
      <dt className="col-span-5 text-[12px] text-ink-500 sm:col-span-4">{label}</dt>
      <dd className="col-span-7 font-mono text-[14px] text-ink-900 sm:col-span-4">
        {value}
      </dd>
      {hint && (
        <dd className="col-span-12 text-[11px] text-ink-500 sm:col-span-4">
          {hint}
        </dd>
      )}
    </div>
  );
}

function SectionHeader({
  title,
  hint,
  right,
}: {
  title: string;
  hint?: string;
  right?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="max-w-3xl">
        <h3 className="text-[16px] font-semibold tracking-tightish text-ink-900">
          {title}
        </h3>
        {hint && (
          <p className="mt-1 text-[12px] leading-relaxed text-ink-500">{hint}</p>
        )}
      </div>
      {right}
    </div>
  );
}

function Block({
  children,
  title,
  hint,
  right,
}: {
  children: ReactNode;
  title: string;
  hint?: string;
  right?: ReactNode;
}) {
  return (
    <section className="px-4 py-10 sm:px-8 sm:py-12">
      <SectionHeader title={title} hint={hint} right={right} />
      {children}
    </section>
  );
}

function SubHeading({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mt-10 mb-4 max-w-3xl">
      <h4 className="text-[12.5px] font-semibold uppercase tracking-[0.14em] text-ink-700">
        {children}
      </h4>
      {hint && (
        <p className="mt-1 text-[11.5px] leading-relaxed text-ink-500">{hint}</p>
      )}
    </div>
  );
}

// ---------- Daily Activity (Top-Block, eigenständiger Datums-Filter) ----------

function DailyActivityBlock({ detail }: { detail: DetailReport }) {
  const days = detail.dailyActivity;
  const hasData = days.length > 0;
  const minDay = hasData ? days[0].day : "";
  const maxDay = hasData ? days[days.length - 1].day : "";

  const [from, setFrom] = useState<string>(minDay);
  const [to, setTo] = useState<string>(maxDay);

  // Initial-Range setzen, sobald Daten geladen sind
  if (hasData && !from && !to) {
    // setState im Render — wir vermeiden das, indem wir Defaults nur einmal setzen
  }
  // Fallback zur Anzeige, wenn from/to leer
  const fromEff = from || minDay;
  const toEff = to || maxDay;

  const filtered = useMemo(() => {
    if (!hasData) return [];
    return days.filter((d) => d.day >= fromEff && d.day <= toEff);
  }, [days, fromEff, toEff, hasData]);

  const data = filtered.map((d) => ({
    day: d.day,
    label: fmtDay(d.day),
    activeMin: d.activeSec / 60,
    activeHours: d.activeSec / 3600,
    sessions: d.sessions,
    events: d.events,
    actions: d.actions,
    processed: d.processed,
  }));

  // Aggregate für KPI-Zeile
  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, d) => {
        acc.activeSec += d.activeSec;
        acc.events += d.events;
        acc.actions += d.actions;
        acc.processed += d.processed;
        acc.sessions += d.sessions;
        return acc;
      },
      { activeSec: 0, events: 0, actions: 0, processed: 0, sessions: 0 },
    );
  }, [filtered]);
  const avgPerDay =
    filtered.length > 0 ? totals.activeSec / filtered.length / 3600 : 0;

  return (
    <Block
      title="Aktivität pro Tag"
      hint="Wie viele Stunden war der User pro Tag wirklich aktiv (Summe aller Sessions, UTC-Tagesgrenzen). Den Zeitraum kannst du über die beiden Datumsfelder rechts einschränken."
      right={
        hasData ? (
          <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-ink-600">
            <label className="inline-flex items-center gap-1">
              <span className="text-ink-500">von</span>
              <input
                type="date"
                value={fromEff}
                min={minDay}
                max={toEff}
                onChange={(e) => setFrom(e.target.value)}
                className="rounded-md border border-hair bg-white px-2 py-1 text-[11.5px] text-ink-800 focus:border-ink-400 focus:outline-none"
              />
            </label>
            <label className="inline-flex items-center gap-1">
              <span className="text-ink-500">bis</span>
              <input
                type="date"
                value={toEff}
                min={fromEff}
                max={maxDay}
                onChange={(e) => setTo(e.target.value)}
                className="rounded-md border border-hair bg-white px-2 py-1 text-[11.5px] text-ink-800 focus:border-ink-400 focus:outline-none"
              />
            </label>
            <button
              type="button"
              onClick={() => {
                setFrom(minDay);
                setTo(maxDay);
              }}
              className="rounded-md border border-hair bg-white px-2 py-1 text-[11px] text-ink-600 hover:bg-night-900/[0.04]"
            >
              Reset
            </button>
          </div>
        ) : null
      }
    >
      {!hasData ? (
        <p className="text-[12.5px] text-ink-500">Keine Tagesdaten im Zeitraum.</p>
      ) : (
        <>
          <div className="mb-3 grid grid-cols-2 gap-x-8 gap-y-1 sm:grid-cols-5">
            <HighlightStat
              label="Tage angezeigt"
              value={fmtNumber(filtered.length)}
            />
            <HighlightStat
              label="Aktive Zeit"
              value={fmtDuration(totals.activeSec)}
              hint={`Ø ${avgPerDay.toFixed(1)} h / Tag`}
            />
            <HighlightStat
              label="Sessions"
              value={fmtNumber(totals.sessions)}
            />
            <HighlightStat
              label="Aktionen"
              value={fmtNumber(totals.actions)}
            />
            <HighlightStat
              label="Bearbeitet"
              value={fmtNumber(totals.processed)}
            />
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                <defs>
                  <linearGradient id="ua-active" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0d0d0f" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#0d0d0f" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#eaeaec" strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "#6b6b73" }}
                  stroke="#cfcfd5"
                />
                <YAxis
                  unit=" h"
                  tick={{ fontSize: 10, fill: "#6b6b73" }}
                  stroke="#cfcfd5"
                />
                <Tooltip
                  wrapperStyle={{ fontSize: 11 }}
                  contentStyle={{ borderRadius: 6, border: "1px solid #eaeaec" }}
                  formatter={(v: number, name: string) => {
                    if (name === "Aktive Zeit (h)")
                      return [`${v.toFixed(2)} h`, name];
                    return [fmtNumber(v), name];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area
                  type="monotone"
                  dataKey="activeHours"
                  name="Aktive Zeit (h)"
                  stroke="#0d0d0f"
                  strokeWidth={1.5}
                  fill="url(#ua-active)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Mini-Tabelle */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-hair text-[10px] uppercase tracking-[0.12em] text-ink-500">
                  <th className="py-1.5 pr-3 text-left font-medium">Tag</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Aktive Zeit</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Sessions</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Events</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Aktionen</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Bearbeitet</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Ø Latenz</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hair/70">
                {filtered.map((d) => (
                  <tr key={d.day}>
                    <td className="py-1.5 pr-3 font-mono text-ink-700">{d.day}</td>
                    <td className="py-1.5 pr-3 text-right">
                      {fmtDuration(d.activeSec)}
                    </td>
                    <td className="py-1.5 pr-3 text-right">
                      {fmtNumber(d.sessions)}
                    </td>
                    <td className="py-1.5 pr-3 text-right">{fmtNumber(d.events)}</td>
                    <td className="py-1.5 pr-3 text-right">{fmtNumber(d.actions)}</td>
                    <td className="py-1.5 pr-3 text-right">{fmtNumber(d.processed)}</td>
                    <td className="py-1.5 pr-3 text-right text-ink-500">
                      {fmtMs(d.avgLatencyMs)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Block>
  );
}

// ---------- Tempo ----------

type TempoUnit = "min" | "hour";

function TempoBlock({ detail }: { detail: DetailReport }) {
  const [unit, setUnit] = useState<TempoUnit>("min");
  const days = detail.dailyActivity.filter((d) => d.activeSec > 0);
  const hasData = days.length > 0;

  const factor = unit === "min" ? 60 : 3600; // Sekunden -> Minute / Stunde
  const unitLabel = unit === "min" ? "/min" : "/h";
  const unitLong = unit === "min"
    ? "Aktionen pro aktive Minute"
    : "Aktionen pro aktive Stunde";

  const data = days.map((d) => ({
    day: d.day,
    label: fmtDay(d.day),
    tempo: d.activeSec > 0 ? (d.actions * factor) / d.activeSec : 0,
    actions: d.actions,
    activeMin: d.activeSec / 60,
  }));

  // Gesamtdurchschnitt: actions / activeSec (über den ganzen Bericht).
  const s = detail.summary;
  const overallAvg =
    s.totalActiveSec > 0 ? (s.actionCount * factor) / s.totalActiveSec : 0;

  // Spitze + arith. Schnitt der Tageswerte (sekundärer Hinweis)
  const peak = data.reduce((mx, d) => (d.tempo > mx ? d.tempo : mx), 0);
  const dayAvg =
    data.length > 0 ? data.reduce((a, b) => a + b.tempo, 0) / data.length : 0;

  // Tempo pro Modus aus perMode (verwendet activeSec & actions je Modus,
  // basierend auf den Sessions im jeweiligen Modus)
  const perModeTempo = detail.perMode
    .filter((m) => m.activeSec > 0 && m.actions > 0)
    .map((m) => ({
      mode: m.mode || "(leer)",
      tempo: (m.actions * factor) / m.activeSec,
      activeSec: m.activeSec,
      actions: m.actions,
      events: m.events,
    }))
    .sort((a, b) => b.tempo - a.tempo);

  return (
    <Block
      title="Tempo"
      hint={`${unitLong} – pro Tag, pro Modus und im Durchschnitt über den ganzen Zeitraum (rote gestrichelte Linie). Tempo zählt nur echte Aktionen (shortcut:*) und teilt sie durch die echte aktive Zeit.`}
      right={
        <div className="inline-flex overflow-hidden rounded-md border border-hair bg-white text-[11.5px]">
          {(["min", "hour"] as TempoUnit[]).map((u, i) => (
            <button
              key={u}
              type="button"
              onClick={() => setUnit(u)}
              className={`px-2.5 py-1 transition-colors ${
                u === unit
                  ? "bg-ink-900 text-white"
                  : "text-ink-600 hover:bg-ink-50"
              } ${i > 0 ? "border-l border-hair" : ""}`}
            >
              {u === "min" ? "pro Minute" : "pro Stunde"}
            </button>
          ))}
        </div>
      }
    >
      {!hasData ? (
        <p className="text-[12.5px] text-ink-500">
          Keine Aktivität im Zeitraum – kein Tempo berechenbar.
        </p>
      ) : (
        <>
          <SubHeading hint="Schneller Überblick über die Geschwindigkeit, mit der der User wirklich gearbeitet hat – im gesamten Zeitraum, an den besten Tagen und im Durchschnitt.">
            Kennzahlen
          </SubHeading>
          <div className="mb-6 grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.14em] text-ink-400">
                Durchschnitt
              </p>
              <p className="mt-0.5 font-display text-[26px] leading-none tracking-tightish text-ink-900">
                {overallAvg.toFixed(unit === "min" ? 2 : 1)}
                <span className="ml-1 text-[12px] text-ink-500">
                  {unitLabel}
                </span>
              </p>
              <p className="text-[10.5px] text-ink-500">
                gesamt {fmtNumber(s.actionCount)} Aktionen ÷{" "}
                {fmtDuration(s.totalActiveSec)}
              </p>
            </div>
            <HighlightStat
              label="Spitze (Tag)"
              value={
                <>
                  {peak.toFixed(unit === "min" ? 2 : 1)}
                  <span className="ml-1 text-[11px] text-ink-500">
                    {unitLabel}
                  </span>
                </>
              }
              hint={`an ${
                data.find((d) => d.tempo === peak)?.day ?? "—"
              }`}
            />
            <HighlightStat
              label="Ø Tageswert"
              value={
                <>
                  {dayAvg.toFixed(unit === "min" ? 2 : 1)}
                  <span className="ml-1 text-[11px] text-ink-500">
                    {unitLabel}
                  </span>
                </>
              }
              hint={`über ${data.length} aktive Tage`}
            />
            <HighlightStat
              label="Aktionen / Sekunde"
              value={
                s.actionsPerSec != null ? `${s.actionsPerSec.toFixed(3)} /s` : "–"
              }
              hint="basierend auf der echten Arbeitszeit"
            />
          </div>
          <SubHeading hint="Jede Säule zeigt das Tempo eines Tages. Die rote gestrichelte Linie ist der Durchschnitt über den gesamten Zeitraum.">
            Pro Tag
          </SubHeading>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={data}
                margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
              >
                <defs>
                  <linearGradient id="tempo-day" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0d0d0f" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#0d0d0f" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#eaeaec" strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "#6b6b73" }}
                  stroke="#cfcfd5"
                />
                <YAxis
                  unit={` ${unitLabel}`}
                  tick={{ fontSize: 10, fill: "#6b6b73" }}
                  stroke="#cfcfd5"
                />
                <Tooltip
                  wrapperStyle={{ fontSize: 11 }}
                  contentStyle={{ borderRadius: 6, border: "1px solid #eaeaec" }}
                  formatter={(v: number, name: string) => {
                    if (name === unitLong) {
                      return [
                        `${v.toFixed(unit === "min" ? 2 : 1)} ${unitLabel}`,
                        name,
                      ];
                    }
                    return [fmtNumber(v), name];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area
                  type="monotone"
                  dataKey="tempo"
                  name={unitLong}
                  stroke="#0d0d0f"
                  strokeWidth={1.75}
                  fill="url(#tempo-day)"
                />
                <ReferenceLine
                  y={overallAvg}
                  stroke="#dc2626"
                  strokeDasharray="5 4"
                  strokeWidth={1.5}
                  ifOverflow="extendDomain"
                  label={{
                    value: `Ø ${overallAvg.toFixed(unit === "min" ? 2 : 1)} ${unitLabel}`,
                    position: "right",
                    fontSize: 10,
                    fill: "#dc2626",
                  }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <SubHeading hint="Tempo aufgeteilt nach Modus (Korrektur, Skalierung, …). Aktive Zeit wird pro Modus aus den jeweiligen Sessions berechnet, sodass Wechsel zwischen Modi sauber abgebildet werden.">
            Pro Modus
          </SubHeading>
          {perModeTempo.length === 0 ? (
            <p className="text-[12.5px] text-ink-500">
              Keine Aktionen mit messbarer aktiver Zeit pro Modus.
            </p>
          ) : (
            <>
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={perModeTempo}
                    margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
                  >
                    <defs>
                      <linearGradient id="tempo-mode" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#1f6feb" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="#1f6feb" stopOpacity={0.04} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#eaeaec" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="mode"
                      tick={{ fontSize: 11, fill: "#6b6b73" }}
                      stroke="#cfcfd5"
                    />
                    <YAxis
                      unit={` ${unitLabel}`}
                      tick={{ fontSize: 10, fill: "#6b6b73" }}
                      stroke="#cfcfd5"
                    />
                    <Tooltip
                      wrapperStyle={{ fontSize: 11 }}
                      contentStyle={{ borderRadius: 6, border: "1px solid #eaeaec" }}
                      formatter={(v: number, name: string) => {
                        if (name === "Tempo")
                          return [
                            `${(v as number).toFixed(unit === "min" ? 2 : 1)} ${unitLabel}`,
                            name,
                          ];
                        return [fmtNumber(v as number), name];
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="tempo"
                      name="Tempo"
                      stroke="#1f6feb"
                      strokeWidth={1.75}
                      fill="url(#tempo-mode)"
                    />
                    <ReferenceLine
                      y={overallAvg}
                      stroke="#dc2626"
                      strokeDasharray="5 4"
                      strokeWidth={1.5}
                      ifOverflow="extendDomain"
                      label={{
                        value: `Ø ${overallAvg.toFixed(unit === "min" ? 2 : 1)} ${unitLabel}`,
                        position: "right",
                        fontSize: 10,
                        fill: "#dc2626",
                      }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-5 overflow-x-auto">
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="border-b border-hair text-[10.5px] uppercase tracking-[0.12em] text-ink-500">
                      <th className="py-2 pr-3 text-left font-medium">Modus</th>
                      <th className="py-2 pr-3 text-right font-medium">
                        Tempo {unitLabel}
                      </th>
                      <th className="py-2 pr-3 text-right font-medium">
                        Aktionen
                      </th>
                      <th className="py-2 pr-3 text-right font-medium">
                        Events
                      </th>
                      <th className="py-2 pr-3 text-right font-medium">
                        Aktive Zeit
                      </th>
                      <th className="py-2 pr-3 text-right font-medium">
                        vs. Ø
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hair/70">
                    {perModeTempo.map((m) => {
                      const diff =
                        overallAvg > 0
                          ? ((m.tempo - overallAvg) / overallAvg) * 100
                          : 0;
                      return (
                        <tr key={m.mode}>
                          <td className="py-2 pr-3 font-medium text-ink-900">
                            {m.mode}
                          </td>
                          <td className="py-2 pr-3 text-right font-mono">
                            {m.tempo.toFixed(unit === "min" ? 2 : 1)}
                          </td>
                          <td className="py-2 pr-3 text-right">
                            {fmtNumber(m.actions)}
                          </td>
                          <td className="py-2 pr-3 text-right text-ink-500">
                            {fmtNumber(m.events)}
                          </td>
                          <td className="py-2 pr-3 text-right text-ink-500">
                            {fmtDuration(m.activeSec)}
                          </td>
                          <td
                            className={`py-2 pr-3 text-right font-mono ${
                              diff >= 0 ? "text-emerald-700" : "text-red-700"
                            }`}
                          >
                            {diff >= 0 ? "+" : ""}
                            {diff.toFixed(0)} %
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </Block>
  );
}

function HighlightStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.14em] text-ink-400">
        {label}
      </p>
      <p className="mt-0.5 font-display text-[18px] leading-tight tracking-tightish text-ink-900">
        {value}
      </p>
      {hint && <p className="text-[10.5px] text-ink-500">{hint}</p>}
    </div>
  );
}

// ---------- Buttons-Timeline ----------

const BUTTON_COLORS = [
  "#1f6feb",
  "#dc7a3b",
  "#10b981",
  "#a855f7",
  "#ef4444",
  "#0ea5e9",
];

function ButtonsTimelineBlock({ detail }: { detail: DetailReport }) {
  if (!detail.buttonsTimeline.length || detail.topButtonNames.length === 0) {
    return null;
  }
  const data = detail.buttonsTimeline.map((b) => {
    const row: Record<string, number | string | null> = {
      bucket: b.bucket,
      label: bucketLabel(b.bucket),
      latency: b.avgLatencyMs ?? null,
    };
    for (const name of detail.topButtonNames) {
      row[name] = b.counts[name] ?? 0;
    }
    return row;
  });

  return (
    <Block
      title="Aktionen über Zeit"
      hint="Welche Buttons wurden gedrückt – pro Zeit-Bucket gruppiert. Eine Fläche pro Top-Button. Die schwarze gestrichelte Linie zeigt die Ø Latenz (rechte Achse), damit du sehen kannst, ob langsamere Phasen mit weniger Aktionen zusammenfallen."
    >
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 8, right: 12, bottom: 8, left: 0 }}
          >
            <defs>
              {detail.topButtonNames.map((name, idx) => (
                <linearGradient
                  key={name}
                  id={`btn-${idx}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor={BUTTON_COLORS[idx % BUTTON_COLORS.length]}
                    stopOpacity={0.45}
                  />
                  <stop
                    offset="100%"
                    stopColor={BUTTON_COLORS[idx % BUTTON_COLORS.length]}
                    stopOpacity={0.04}
                  />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid stroke="#eaeaec" strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "#6b6b73" }}
              stroke="#cfcfd5"
            />
            <YAxis
              yAxisId="L"
              tick={{ fontSize: 10, fill: "#6b6b73" }}
              stroke="#cfcfd5"
            />
            <YAxis
              yAxisId="R"
              orientation="right"
              unit=" ms"
              tick={{ fontSize: 10, fill: "#6b6b73" }}
              stroke="#cfcfd5"
            />
            <Tooltip
              wrapperStyle={{ fontSize: 11 }}
              contentStyle={{ borderRadius: 6, border: "1px solid #eaeaec" }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {detail.topButtonNames.map((name, idx) => (
              <Area
                key={name}
                yAxisId="L"
                type="monotone"
                dataKey={name}
                name={name}
                stroke={BUTTON_COLORS[idx % BUTTON_COLORS.length]}
                strokeWidth={1.5}
                fill={`url(#btn-${idx})`}
                stackId={undefined}
              />
            ))}
            <Line
              yAxisId="R"
              type="monotone"
              dataKey="latency"
              name="Ø Latenz (ms)"
              stroke="#0d0d0f"
              strokeWidth={1.25}
              strokeDasharray="4 3"
              dot={false}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Block>
  );
}

function KpiBlock({ detail }: { detail: DetailReport }) {
  const s = detail.summary;
  return (
    <Block
      title="Übersicht"
      hint={
        'Alle wichtigen Kennzahlen auf einen Blick. „Aktive Zeit" = Summe aller Sessions (echte Arbeitszeit). „24-h-Sicht" = der gesamte Reportzeitraum, also auch Pausen und Nächte. „Restdauer" rechnet die aktuell offenen Fahrzeuge mit der gemessenen Rate hoch.'
      }
    >
      <div className="grid grid-cols-1 gap-x-10 gap-y-1 md:grid-cols-2">
        <dl>
          <KpiRow label="Events gesamt" value={fmtNumber(s.eventCount)} />
          <KpiRow
            label="Aktionen (shortcut:*)"
            value={fmtNumber(s.actionCount)}
            hint={`Quote: ${
              s.eventCount > 0
                ? `${((s.actionCount / s.eventCount) * 100).toFixed(1)} %`
                : "–"
            }`}
          />
          <KpiRow label="Sessions" value={fmtNumber(s.sessionCount)} />
          <KpiRow
            label="Aktive Zeit gesamt"
            value={fmtDuration(s.totalActiveSec)}
            hint={`Ø ${fmtDuration(s.avgSessionSec)} · längste ${fmtDuration(
              s.longestSessionSec,
            )}`}
          />
          <KpiRow
            label="Reportzeitraum"
            value={`${(s.rangeDays || 0).toFixed(2)} Tage`}
            hint={`${fmtNumber(s.rangeSpanSec)} s im Range`}
          />
          <KpiRow
            label="Aktive Tage"
            value={fmtNumber(s.uniqueDays)}
            hint={`davon ${fmtNumber(s.uniqueIps)} IP-Adressen${
              detail.scope.aggregate
                ? ` · ${fmtNumber(s.uniqueUsers)} User`
                : ""
            }`}
          />
        </dl>
        <dl>
          <KpiRow
            label="Events / Sek."
            value={
              s.eventsPerSec != null ? `${s.eventsPerSec.toFixed(2)} /s` : "–"
            }
            hint={`${fmtRate(s.eventsPerMinute, "/min")} · ${fmtRate(s.eventsPerActiveHour)}`}
          />
          <KpiRow
            label="Aktionen / Sek."
            value={
              s.actionsPerSec != null ? `${s.actionsPerSec.toFixed(2)} /s` : "–"
            }
            hint={`${fmtRate(s.actionsPerMinute, "/min")} · ${fmtRate(
              s.actionsPerActiveHour,
            )}`}
          />
          <KpiRow
            label="Bearbeitete Fahrzeuge"
            value={fmtNumber(s.processedTotal)}
            hint="Summe aus Rückgang von double2..5 (ab 2026-05-02 19:32:50)"
          />
          <KpiRow
            label="Ø Fahrzeuge / aktive h"
            value={fmtRate(s.vehiclesPerActiveHour)}
            hint="basierend auf der echten Arbeitszeit"
          />
          <KpiRow
            label="Ø Fahrzeuge / Kalendertag"
            value={fmtRate(s.vehiclesPerCalendarDay, "/Tag")}
            hint={`24-h-Sicht über den ganzen Zeitraum · ${fmtRate(
              s.vehiclesPerCalendarHour,
            )}`}
          />
          <KpiRow
            label="Aktuell offen (alle Modi)"
            value={s.totalRemaining != null ? fmtNumber(s.totalRemaining) : "–"}
            hint="Summe der zuletzt gemessenen verbleibenden Fahrzeuge"
          />
          <KpiRow
            label="Restdauer (echte Arbeitszeit)"
            value={fmtHours(s.etaHoursActive)}
            hint={`offen ÷ Ø Fahrzeuge / aktive h${
              s.etaHoursActive != null && s.etaHoursActive > 0
                ? ` ≈ ${(s.etaHoursActive / 24).toFixed(1)} Arbeitstage à 24 h`
                : ""
            }`}
          />
          <KpiRow
            label="Restdauer (24-h-Sicht)"
            value={fmtHours(s.etaHoursCalendar)}
            hint="offen ÷ Ø Fahrzeuge / Kalenderstunde"
          />
          <KpiRow
            label="Erstes / letztes Event"
            value={
              s.firstTs && s.lastTs
                ? `${fmtDateTime(s.firstTs)} → ${fmtDateTime(s.lastTs)}`
                : "–"
            }
          />
        </dl>
      </div>
    </Block>
  );
}

// ---------- Modus-Bestände ----------

function ModesBlock({ detail }: { detail: DetailReport }) {
  return (
    <Block
      title="Verbleibende Fahrzeuge je Modus"
      hint={
        'Wie viele Fahrzeuge sind aktuell pro Modus noch offen (double2..5, ab 2026-05-02 19:32:50). „Bearbeitet" ist die Summe aller Rückgänge im Bestand, „/h" die durchschnittliche Bearbeitungsrate, „Restdauer" = aktuell offen ÷ Rate.'
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-hair text-[10.5px] uppercase tracking-[0.12em] text-ink-500">
              <th className="py-2 pr-4 text-left font-medium">Modus</th>
              <th className="py-2 pr-4 text-right font-medium">Aktuell offen</th>
              <th className="py-2 pr-4 text-right font-medium">min</th>
              <th className="py-2 pr-4 text-right font-medium">max</th>
              <th className="py-2 pr-4 text-right font-medium">Bearbeitet</th>
              <th className="py-2 pr-4 text-right font-medium">/h</th>
              <th className="py-2 pr-4 text-right font-medium">Restdauer</th>
              <th className="py-2 pr-4 text-right font-medium">zuletzt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hair/70">
            {detail.remainingByMode.map((r) => (
              <tr key={r.mode}>
                <td className="py-2 pr-4 font-medium text-ink-900">{r.mode}</td>
                <td className="py-2 pr-4 text-right font-mono">
                  {r.latestOpen != null ? fmtNumber(r.latestOpen) : "–"}
                </td>
                <td className="py-2 pr-4 text-right text-ink-600">
                  {r.minOpen != null ? fmtNumber(r.minOpen) : "–"}
                </td>
                <td className="py-2 pr-4 text-right text-ink-600">
                  {r.maxOpen != null ? fmtNumber(r.maxOpen) : "–"}
                </td>
                <td className="py-2 pr-4 text-right">{fmtNumber(r.processed)}</td>
                <td className="py-2 pr-4 text-right text-ink-600">
                  {fmtRate(r.processedPerHour)}
                </td>
                <td className="py-2 pr-4 text-right">
                  {fmtHours(r.etaHours)}
                </td>
                <td className="py-2 pr-4 text-right text-ink-500">
                  {r.latestTs ? fmtDateTime(r.latestTs) : "–"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Block>
  );
}

// ---------- Activity-Chart (Events × Latenz) ----------

function ActivityChartBlock({ detail }: { detail: DetailReport }) {
  if (!detail.timeline.length) return null;
  const data = detail.timeline.map((p) => ({
    ts: p.bucket,
    label: bucketLabel(p.bucket),
    events: p.events,
    actions: p.actions,
    processed: p.processed,
    latency: p.avgLatencyMs,
  }));
  return (
    <Block
      title="Aktivität · Events × Internetgeschwindigkeit"
      hint="Pro Zeit-Bucket: Events, Aktionen und bearbeitete Fahrzeuge als Balken (linke Achse). Die schwarze Linie zeigt zusätzlich die Ø Latenz in Millisekunden (rechte Achse) – so siehst du auf einen Blick, wann die Verbindung am schnellsten war."
    >
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
            <defs>
              <linearGradient id="act-events" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#9aa2ac" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#9aa2ac" stopOpacity={0.04} />
              </linearGradient>
              <linearGradient id="act-actions" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0d0d0f" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#0d0d0f" stopOpacity={0.04} />
              </linearGradient>
              <linearGradient id="act-proc" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1f6feb" stopOpacity={0.45} />
                <stop offset="100%" stopColor="#1f6feb" stopOpacity={0.04} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#eaeaec" strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#6b6b73" }} stroke="#cfcfd5" />
            <YAxis
              yAxisId="L"
              tick={{ fontSize: 10, fill: "#6b6b73" }}
              stroke="#cfcfd5"
            />
            <YAxis
              yAxisId="R"
              orientation="right"
              unit=" ms"
              tick={{ fontSize: 10, fill: "#6b6b73" }}
              stroke="#cfcfd5"
            />
            <Tooltip
              wrapperStyle={{ fontSize: 11 }}
              contentStyle={{ borderRadius: 6, border: "1px solid #eaeaec" }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Area
              yAxisId="L"
              type="monotone"
              dataKey="events"
              name="Events"
              stroke="#9aa2ac"
              strokeWidth={1.5}
              fill="url(#act-events)"
            />
            <Area
              yAxisId="L"
              type="monotone"
              dataKey="actions"
              name="Aktionen"
              stroke="#0d0d0f"
              strokeWidth={1.5}
              fill="url(#act-actions)"
            />
            <Area
              yAxisId="L"
              type="monotone"
              dataKey="processed"
              name="Bearbeitet"
              stroke="#1f6feb"
              strokeWidth={1.5}
              fill="url(#act-proc)"
            />
            <Line
              yAxisId="R"
              type="monotone"
              dataKey="latency"
              name="Ø Latenz (ms)"
              stroke="#dc7a3b"
              strokeWidth={1.5}
              dot={false}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Block>
  );
}

// ---------- Internetgeschwindigkeit ----------

function NetworkSpeedBlock({ detail }: { detail: DetailReport }) {
  const n = detail.network;
  const points = detail.latencyPoints;
  const scatter = useMemo(
    () =>
      points.map((p) => ({
        x: aeTimestampToDate(p.ts).getTime(),
        y: p.ms,
        ts: p.ts,
      })),
    [points],
  );

  const vehicles = detail.vehicleLatency;
  const vehicleData = vehicles.map((v) => ({
    label: v.label,
    avg: v.avgLatencyMs ?? 0,
    max: v.maxLatencyMs ?? 0,
    count: v.actions,
  }));

  return (
    <Block
      title="Internetgeschwindigkeit (Latenz)"
      hint="Latenz pro Aktion in Millisekunden (Quelle: blob7). Oben die Statistik-Kennzahlen, dann die Verteilung über die Zeit (Streudiagramm) und unten die schlechtesten/häufigsten Fahrzeuge nach Latenz."
    >
      <SubHeading hint="Statistische Kennzahlen aller gemessenen Latenzen. p95 z. B. heißt: 95 % aller Aktionen waren schneller als dieser Wert.">
        Kennzahlen
      </SubHeading>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <dl className="lg:col-span-4">
          <KpiRow label="Samples" value={fmtNumber(n.samples)} />
          <KpiRow label="Ø" value={fmtMs(n.avgMs)} />
          <KpiRow label="min" value={fmtMs(n.minMs)} />
          <KpiRow label="max" value={fmtMs(n.maxMs)} />
          <KpiRow label="p50" value={fmtMs(n.p50Ms)} />
          <KpiRow label="p95" value={fmtMs(n.p95Ms)} />
          <KpiRow label="p99" value={fmtMs(n.p99Ms)} />
        </dl>
        <div className="lg:col-span-8">
          <p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-ink-400">
            Latenz-Verlauf · jeder Punkt = eine einzelne Aktion
          </p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                <CartesianGrid stroke="#eaeaec" strokeDasharray="3 3" />
                <XAxis
                  dataKey="x"
                  type="number"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={(t) =>
                    new Intl.DateTimeFormat("de-DE", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "UTC",
                    }).format(new Date(t))
                  }
                  tick={{ fontSize: 10, fill: "#6b6b73" }}
                  stroke="#cfcfd5"
                />
                <YAxis
                  dataKey="y"
                  type="number"
                  unit=" ms"
                  tick={{ fontSize: 10, fill: "#6b6b73" }}
                  stroke="#cfcfd5"
                />
                <ZAxis range={[20, 21]} />
                <Tooltip
                  wrapperStyle={{ fontSize: 11 }}
                  contentStyle={{ borderRadius: 6, border: "1px solid #eaeaec" }}
                  formatter={(v: number) => [`${Math.round(v)} ms`, "Latenz"]}
                  labelFormatter={(t) =>
                    new Intl.DateTimeFormat("de-DE", {
                      dateStyle: "short",
                      timeStyle: "medium",
                      timeZone: "UTC",
                    }).format(new Date(Number(t)))
                  }
                />
                <Scatter data={scatter} fill="#0d0d0f" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {vehicleData.length > 0 && (
        <>
          <SubHeading hint="Top-Fahrzeuge mit dem höchsten Latenz-Mittelwert. Hilft, einzelne Renderings zu identifizieren, die regelmäßig langsam laden.">
            Fahrzeug · Internetgeschwindigkeit
          </SubHeading>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={vehicleData}
                margin={{ top: 4, right: 8, bottom: 4, left: 0 }}
                layout="vertical"
              >
                <CartesianGrid stroke="#eaeaec" strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  unit=" ms"
                  tick={{ fontSize: 10, fill: "#6b6b73" }}
                  stroke="#cfcfd5"
                />
                <YAxis
                  dataKey="label"
                  type="category"
                  width={170}
                  tick={{ fontSize: 10, fill: "#6b6b73" }}
                  stroke="#cfcfd5"
                />
                <Tooltip
                  wrapperStyle={{ fontSize: 11 }}
                  contentStyle={{ borderRadius: 6, border: "1px solid #eaeaec" }}
                  formatter={(v: number, n: string) => [`${Math.round(v)} ms`, n]}
                  labelFormatter={(l) => String(l)}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="avg" name="Ø ms" fill="#0d0d0f" radius={[0, 2, 2, 0]} />
                <Bar dataKey="max" name="max ms" fill="#dc7a3b" radius={[0, 2, 2, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </Block>
  );
}

// ---------- Sessions ----------

function SessionsBlock({ detail }: { detail: DetailReport }) {
  if (!detail.sessions.length) return null;
  const sessions = detail.sessions.slice(-30).reverse();
  return (
    <Block
      title={`Sessions (zuletzt ${sessions.length} von ${detail.sessions.length})`}
      hint="Eine Session ist ein Block zusammenhängender Aktivität. Eine Pause von ≥ 5 Minuten beendet die laufende Session und startet eine neue."
    >
      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-hair text-[10.5px] uppercase tracking-[0.12em] text-ink-500">
              <th className="py-2 pr-4 text-left font-medium">Start</th>
              <th className="py-2 pr-4 text-left font-medium">Ende</th>
              <th className="py-2 pr-4 text-right font-medium">Dauer</th>
              <th className="py-2 pr-4 text-right font-medium">Events</th>
              <th className="py-2 pr-4 text-right font-medium">Aktionen</th>
              <th className="py-2 pr-4 text-left font-medium">Modi</th>
              <th className="py-2 pr-4 text-left font-medium">IPs</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hair/70">
            {sessions.map((s, idx) => (
              <tr key={`${s.start}|${idx}`}>
                <td className="py-2 pr-4 text-ink-700">{fmtDateTime(s.start)}</td>
                <td className="py-2 pr-4 text-ink-700">{fmtDateTime(s.end)}</td>
                <td className="py-2 pr-4 text-right">{fmtDuration(s.durationSec)}</td>
                <td className="py-2 pr-4 text-right">{fmtNumber(s.events)}</td>
                <td className="py-2 pr-4 text-right">{fmtNumber(s.actions)}</td>
                <td className="py-2 pr-4 truncate text-ink-600" title={s.modes.join(", ")}>
                  {s.modes.join(", ") || "–"}
                </td>
                <td className="py-2 pr-4 truncate font-mono text-ink-600" title={s.ips.join(", ")}>
                  {s.ips.join(", ") || "–"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Block>
  );
}

// ---------- Per-IP ----------

function PerIpBlock({
  detail,
  onSelectIp,
}: {
  detail: DetailReport;
  onSelectIp: (ip: string | null) => void;
}) {
  if (!detail.perIp.length) return null;
  return (
    <Block
      title="IP-Adressen"
      hint="Aufschlüsselung nach IP. Klick auf eine IP, um den ganzen Bericht auf diese IP einzuschränken – nützlich, um Office vs. Home oder mobile Sessions zu vergleichen."
    >
      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-hair text-[10.5px] uppercase tracking-[0.12em] text-ink-500">
              <th className="py-2 pr-4 text-left font-medium">IP</th>
              <th className="py-2 pr-4 text-right font-medium">Events</th>
              <th className="py-2 pr-4 text-right font-medium">Aktionen</th>
              <th className="py-2 pr-4 text-right font-medium">Aktiv</th>
              <th className="py-2 pr-4 text-right font-medium">Ø Latenz</th>
              <th className="py-2 pr-4 text-left font-medium">Erstes</th>
              <th className="py-2 pr-4 text-left font-medium">Letztes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hair/70">
            {detail.perIp.map((ip) => (
              <tr key={ip.ip}>
                <td className="py-2 pr-4 font-mono text-ink-900">
                  <button
                    type="button"
                    onClick={() => onSelectIp(ip.ip)}
                    className="text-left hover:underline"
                  >
                    {ip.ip || "(leer)"}
                  </button>
                </td>
                <td className="py-2 pr-4 text-right">{fmtNumber(ip.events)}</td>
                <td className="py-2 pr-4 text-right">{fmtNumber(ip.actions)}</td>
                <td className="py-2 pr-4 text-right text-ink-600">
                  {fmtDuration(ip.activeSec)}
                </td>
                <td className="py-2 pr-4 text-right">{fmtMs(ip.avgLatencyMs)}</td>
                <td className="py-2 pr-4 text-ink-600">
                  {ip.firstTs ? fmtDateTime(ip.firstTs) : "–"}
                </td>
                <td className="py-2 pr-4 text-ink-600">
                  {ip.lastTs ? fmtDateTime(ip.lastTs) : "–"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Block>
  );
}

// ---------- Verteilungen ----------

function DistributionBlock({ detail }: { detail: DetailReport }) {
  const hourData = detail.perHourOfDay.map((h) => ({
    label: `${String(h.hour).padStart(2, "0")}h`,
    events: h.events,
    actions: h.actions,
  }));
  const wdData = detail.perWeekday.map((w) => ({
    label: WEEKDAYS[w.weekday] ?? String(w.weekday),
    events: w.events,
    actions: w.actions,
  }));
  return (
    <Block
      title="Verteilungen"
      hint="Wann arbeitet der User typischerweise? Links die Stunde des Tages (UTC, also für lokale Zeit ggf. Verschiebung beachten), rechts der Wochentag. Hilft, Arbeitsmuster zu erkennen."
    >
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-ink-400">
            Stunde (UTC) · wann am Tag
          </p>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hourData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                <defs>
                  <linearGradient id="dist-h-events" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#9aa2ac" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#9aa2ac" stopOpacity={0.04} />
                  </linearGradient>
                  <linearGradient id="dist-h-actions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0d0d0f" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#0d0d0f" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#eaeaec" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#6b6b73" }} stroke="#cfcfd5" />
                <YAxis tick={{ fontSize: 10, fill: "#6b6b73" }} stroke="#cfcfd5" />
                <Tooltip
                  wrapperStyle={{ fontSize: 11 }}
                  contentStyle={{ borderRadius: 6, border: "1px solid #eaeaec" }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area
                  type="monotone"
                  dataKey="events"
                  name="Events"
                  stroke="#9aa2ac"
                  strokeWidth={1.5}
                  fill="url(#dist-h-events)"
                />
                <Area
                  type="monotone"
                  dataKey="actions"
                  name="Aktionen"
                  stroke="#0d0d0f"
                  strokeWidth={1.5}
                  fill="url(#dist-h-actions)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div>
          <p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-ink-400">
            Wochentag · welcher Tag der Woche
          </p>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={wdData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                <defs>
                  <linearGradient id="dist-wd-events" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#9aa2ac" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#9aa2ac" stopOpacity={0.04} />
                  </linearGradient>
                  <linearGradient id="dist-wd-actions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0d0d0f" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#0d0d0f" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#eaeaec" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#6b6b73" }} stroke="#cfcfd5" />
                <YAxis tick={{ fontSize: 10, fill: "#6b6b73" }} stroke="#cfcfd5" />
                <Tooltip
                  wrapperStyle={{ fontSize: 11 }}
                  contentStyle={{ borderRadius: 6, border: "1px solid #eaeaec" }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area
                  type="monotone"
                  dataKey="events"
                  name="Events"
                  stroke="#9aa2ac"
                  strokeWidth={1.5}
                  fill="url(#dist-wd-events)"
                />
                <Area
                  type="monotone"
                  dataKey="actions"
                  name="Aktionen"
                  stroke="#0d0d0f"
                  strokeWidth={1.5}
                  fill="url(#dist-wd-actions)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </Block>
  );
}

// ---------- Vehicle-Suche unten ----------

function VehiclesBlock({ detail }: { detail: DetailReport }) {
  const [vq, setVq] = useState("");
  const filtered = useMemo(() => {
    const t = vq.trim().toLowerCase();
    if (!t) return detail.vehicles;
    return detail.vehicles.filter((v) => {
      const haystack = [v.brand, v.model, v.year, v.body, v.trim, v.color]
        .join(" ")
        .toLowerCase();
      return haystack.includes(t);
    });
  }, [vq, detail.vehicles]);
  const visible = filtered.slice(0, 50);

  return (
    <Block
      title={`Fahrzeuge (${detail.vehicles.length})`}
      hint={'Liste der bearbeiteten Fahrzeuge inkl. der zugehörigen User, Modi und Ansichten. Über die Suche kannst du gezielt nach Marke, Modell, Baujahr o. Ä. filtern – z. B. „Audi", „Tesla", „2024".'}
      right={
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
          <input
            value={vq}
            onChange={(e) => setVq(e.target.value)}
            placeholder="Fahrzeug suchen …"
            className="w-full rounded-md border border-hair bg-white py-1.5 pl-8 pr-2 text-[12.5px] text-ink-800 placeholder:text-ink-400 focus:border-ink-400 focus:outline-none"
          />
        </div>
      }
    >
      {detail.vehicles.length === 0 ? (
        <p className="text-[12.5px] text-ink-500">Keine Fahrzeuge im Zeitraum.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-hair text-[10.5px] uppercase tracking-[0.12em] text-ink-500">
                  <th className="py-2 pr-4 text-left font-medium">Fahrzeug</th>
                  <th className="py-2 pr-4 text-left font-medium">Body / Trim / Farbe</th>
                  <th className="py-2 pr-4 text-right font-medium">Events</th>
                  <th className="py-2 pr-4 text-right font-medium">Aktionen</th>
                  <th className="py-2 pr-4 text-left font-medium">Letzte Aktion</th>
                  <th className="py-2 pr-4 text-left font-medium">User</th>
                  <th className="py-2 pr-4 text-left font-medium">Ansichten</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hair/70">
                {visible.map((v, idx) => (
                  <tr key={`${v.label}|${idx}`}>
                    <td className="py-2 pr-4 font-medium text-ink-900">
                      {v.label || `${v.brand} ${v.model}`}
                    </td>
                    <td className="py-2 pr-4 text-ink-600">
                      {[v.body, v.trim, v.color].filter(Boolean).join(" / ") || "–"}
                    </td>
                    <td className="py-2 pr-4 text-right">{fmtNumber(v.events)}</td>
                    <td className="py-2 pr-4 text-right">{fmtNumber(v.actions)}</td>
                    <td className="py-2 pr-4 text-ink-600">
                      {v.lastTs ? fmtDateTime(v.lastTs) : "–"}
                    </td>
                    <td className="py-2 pr-4">
                      <ul className="flex flex-wrap gap-1">
                        {v.users.slice(0, 4).map((u) => (
                          <li
                            key={u.user}
                            className="rounded border border-hair bg-white px-1.5 py-0.5 text-[10.5px] text-ink-700"
                          >
                            {u.user}
                            <span className="ml-1 text-ink-400">
                              {fmtNumber(u.events)}
                            </span>
                          </li>
                        ))}
                        {v.users.length > 4 && (
                          <li className="text-[10.5px] text-ink-400">
                            +{v.users.length - 4} weitere
                          </li>
                        )}
                      </ul>
                    </td>
                    <td className="py-2 pr-4">
                      <ul className="flex flex-wrap gap-1">
                        {v.views.slice(0, 6).map((vw) => (
                          <li
                            key={vw.view}
                            className="rounded bg-ink-50 px-1.5 py-0.5 font-mono text-[10.5px] text-ink-700"
                          >
                            {vw.view}
                            <span className="ml-1 text-ink-400">{fmtNumber(vw.count)}</span>
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length > visible.length && (
            <p className="mt-2 text-[11px] text-ink-500">
              Zeige {visible.length} von {filtered.length} Treffern. Schränke die Suche
              ein, um weitere zu sehen.
            </p>
          )}
        </>
      )}
    </Block>
  );
}

// ---------- Top-Aufschlüsselungen ----------

function BreakdownsBlock({ detail }: { detail: DetailReport }) {
  return (
    <Block
      title="Aufschlüsselungen"
      hint="Top-Listen über den ganzen Berichtszeitraum: häufigste Aktionen, Modi, Marken, Modelle und Ansichten – jeweils mit Mini-Bar zur visuellen Einordnung."
    >
      <div className="grid grid-cols-1 gap-x-12 gap-y-8 md:grid-cols-2 xl:grid-cols-3">
        <RankList
          title="Aktionen (shortcut:*)"
          items={detail.topActions.map((a) => ({ key: a.button, label: a.button, value: a.count }))}
        />
        <RankList
          title="Modi"
          items={detail.topModes.map((m) => ({ key: m.mode, label: m.mode || "(leer)", value: m.count }))}
        />
        <RankList
          title="Marken"
          items={detail.topBrands.map((b) => ({ key: b.brand, label: b.brand, value: b.count }))}
        />
        <RankList
          title="Modelle"
          items={detail.topModels.map((m, i) => ({
            key: `${m.brand}|${m.model}|${i}`,
            label: `${m.brand} ${m.model}`,
            value: m.count,
          }))}
        />
        <RankList
          title="Ansichten"
          items={detail.topViews.map((v) => ({ key: v.view, label: v.view, value: v.count }))}
        />
        <RankList
          title="Per-Modus (Aktivität)"
          items={detail.perMode.map((m) => ({
            key: m.mode,
            label: `${m.mode || "(leer)"} · ${fmtNumber(m.actions)} Aktionen`,
            value: m.events,
          }))}
        />
      </div>
    </Block>
  );
}

function RankList({
  title,
  items,
}: {
  title: string;
  items: Array<{ key: string; label: string; value: number }>;
}) {
  const max = items.reduce((m, x) => Math.max(m, x.value), 0) || 1;
  return (
    <div>
      <p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-ink-400">{title}</p>
      {items.length === 0 ? (
        <p className="text-[12px] text-ink-400">– keine –</p>
      ) : (
        <ol className="space-y-1.5">
          {items.map((it, idx) => {
            const pct = (it.value / max) * 100;
            return (
              <li key={it.key} className="grid grid-cols-12 items-center gap-3 text-[12px]">
                <span className="col-span-1 text-right font-mono text-ink-400">{idx + 1}</span>
                <span className="col-span-7 truncate font-mono text-ink-800" title={it.label}>
                  {it.label}
                </span>
                <span className="col-span-2 text-right text-ink-600">
                  {fmtNumber(it.value)}
                </span>
                <span className="col-span-2 h-1 overflow-hidden rounded bg-ink-100">
                  <span className="block h-full bg-ink-900" style={{ width: `${Math.max(2, pct)}%` }} />
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

// ---------- DIN-A4 Print-Layout ----------

// Feste Chart-Breite in px für DIN-A4 Druck (~178mm Inhaltsbreite bei 96dpi).
// Höhe pro Chart wählen wir je Aufruf passend.
const PRINT_CHART_W = 670;

// Recharts in einem hidden-Container braucht feste Größen, weil es sonst
// nicht layouted wird und am Ende SVG mit width/height 0 produziert.
function PrintAreaChart({
  data,
  series,
  height = 170,
  yUnit,
  xKey = "label",
  referenceY,
  referenceLabel,
}: {
  data: Array<Record<string, number | string | null>>;
  series: Array<{ key: string; name: string; color: string; gradientId: string }>;
  height?: number;
  yUnit?: string;
  xKey?: string;
  referenceY?: number;
  referenceLabel?: string;
}) {
  return (
    <div className="avoid-break" style={{ width: PRINT_CHART_W, height }}>
      <ComposedChart
        width={PRINT_CHART_W}
        height={height}
        data={data}
        margin={{ top: 4, right: 16, bottom: 4, left: 0 }}
      >
        <defs>
          {series.map((s) => (
            <linearGradient
              key={s.gradientId}
              id={s.gradientId}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor={s.color} stopOpacity={0.45} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0.04} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid stroke="#e3e3e6" strokeDasharray="3 3" />
        <XAxis
          dataKey={xKey}
          tick={{ fontSize: 8, fill: "#6b6b73" }}
          stroke="#cfcfd5"
          interval="preserveStartEnd"
        />
        <YAxis
          unit={yUnit ? ` ${yUnit}` : ""}
          tick={{ fontSize: 8, fill: "#6b6b73" }}
          stroke="#cfcfd5"
          width={40}
        />
        <Legend wrapperStyle={{ fontSize: 9 }} />
        {series.map((s) => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stroke={s.color}
            strokeWidth={1.4}
            fill={`url(#${s.gradientId})`}
            isAnimationActive={false}
          />
        ))}
        {referenceY != null && (
          <ReferenceLine
            y={referenceY}
            stroke="#dc2626"
            strokeDasharray="5 4"
            strokeWidth={1.25}
            label={
              referenceLabel
                ? {
                    value: referenceLabel,
                    position: "right",
                    fontSize: 8,
                    fill: "#dc2626",
                  }
                : undefined
            }
          />
        )}
      </ComposedChart>
    </div>
  );
}

function PrintScatterChart({
  data,
  height = 170,
}: {
  data: Array<{ x: number; y: number }>;
  height?: number;
}) {
  return (
    <div className="avoid-break" style={{ width: PRINT_CHART_W, height }}>
      <ScatterChart
        width={PRINT_CHART_W}
        height={height}
        margin={{ top: 4, right: 16, bottom: 4, left: 0 }}
      >
        <CartesianGrid stroke="#e3e3e6" strokeDasharray="3 3" />
        <XAxis
          dataKey="x"
          type="number"
          domain={["dataMin", "dataMax"]}
          tickFormatter={(t) =>
            new Intl.DateTimeFormat("de-DE", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "UTC",
            }).format(new Date(t))
          }
          tick={{ fontSize: 8, fill: "#6b6b73" }}
          stroke="#cfcfd5"
        />
        <YAxis
          dataKey="y"
          type="number"
          unit=" ms"
          tick={{ fontSize: 8, fill: "#6b6b73" }}
          stroke="#cfcfd5"
          width={42}
        />
        <ZAxis range={[8, 9]} />
        <Scatter data={data} fill="#0d0d0f" isAnimationActive={false} />
      </ScatterChart>
    </div>
  );
}

function PrintReport({
  data,
  range,
}: {
  data: UserAnalyticsResponse | null;
  range: Range;
}) {
  const detail = data?.detail ?? null;
  const generatedAt = useMemo(
    () =>
      new Intl.DateTimeFormat("de-DE", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date()),
    [data?.detail],
  );
  if (!detail) return null;
  const s = detail.summary;

  // ----------- Daten für Charts auf den PDF-Seiten -----------
  const overallTempoMin =
    s.totalActiveSec > 0 ? (s.actionCount * 60) / s.totalActiveSec : 0;
  const overallTempoHour =
    s.totalActiveSec > 0 ? (s.actionCount * 3600) / s.totalActiveSec : 0;

  const dailyChartData = detail.dailyActivity.map((d) => ({
    label: fmtDay(d.day),
    activeHours: +(d.activeSec / 3600).toFixed(2),
    tempoMin:
      d.activeSec > 0 ? +((d.actions * 60) / d.activeSec).toFixed(2) : 0,
  }));

  const tempoModeData = detail.perMode
    .filter((m) => m.activeSec > 0 && m.actions > 0)
    .map((m) => ({
      label: m.mode || "(leer)",
      tempo: +((m.actions * 60) / m.activeSec).toFixed(2),
    }))
    .sort((a, b) => b.tempo - a.tempo);

  const buttonsChartData = detail.buttonsTimeline.map((b) => {
    const row: Record<string, number | string | null> = {
      label: bucketLabel(b.bucket),
    };
    for (const name of detail.topButtonNames) {
      row[name] = b.counts[name] ?? 0;
    }
    return row;
  });
  const buttonsSeries = detail.topButtonNames.map((name, idx) => ({
    key: name,
    name,
    color: BUTTON_COLORS[idx % BUTTON_COLORS.length],
    gradientId: `pdf-btn-${idx}`,
  }));

  const activityChartData = detail.timeline.map((p) => ({
    label: bucketLabel(p.bucket),
    events: p.events,
    actions: p.actions,
    processed: p.processed,
  }));

  const scatterData = detail.latencyPoints.map((p) => ({
    x: aeTimestampToDate(p.ts).getTime(),
    y: p.ms,
  }));

  // Verteilungs-Daten aus DistributionBlock-Logik nachbilden
  const hourMap = new Map<number, { events: number; actions: number }>();
  const wdMap = new Map<number, { events: number; actions: number }>();
  for (const t of detail.timeline) {
    const d = aeTimestampToDate(t.bucket);
    const h = d.getUTCHours();
    const wd = d.getUTCDay();
    const hAcc = hourMap.get(h) || { events: 0, actions: 0 };
    hAcc.events += t.events;
    hAcc.actions += t.actions;
    hourMap.set(h, hAcc);
    const wdAcc = wdMap.get(wd) || { events: 0, actions: 0 };
    wdAcc.events += t.events;
    wdAcc.actions += t.actions;
    wdMap.set(wd, wdAcc);
  }
  const hourPdfData = Array.from({ length: 24 }, (_, h) => ({
    label: `${String(h).padStart(2, "0")}h`,
    events: hourMap.get(h)?.events ?? 0,
    actions: hourMap.get(h)?.actions ?? 0,
  }));
  const wdNames = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  const wdPdfData = Array.from({ length: 7 }, (_, i) => ({
    label: wdNames[i],
    events: wdMap.get(i)?.events ?? 0,
    actions: wdMap.get(i)?.actions ?? 0,
  }));

  const TOTAL_PAGES = 8;
  const userLabel = detail.scope.aggregate
    ? `Alle User (${s.uniqueUsers} aktiv)`
    : detail.user;

  return (
    <div className="hidden print:block">
      <style>{`
        @page { size: A4 portrait; margin: 18mm 16mm 22mm 16mm; }
        @media print {
          html, body { background: white; color: #0d0d0f; }
          .pdf-page { page-break-after: always; }
          .pdf-page:last-child { page-break-after: auto; }
          .avoid-break { break-inside: avoid; page-break-inside: avoid; }
          thead { display: table-header-group; }
          tr, td, th { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      {/* SEITE 1 — Cover & Hero */}
      <PrintPage
        pageNumber={1}
        totalPages={TOTAL_PAGES}
        generatedAt={generatedAt}
        userAgent={s.primaryUserAgent}
        userLabel={userLabel}
      >
        <h1 className="font-display text-[28px] tracking-tightish">
          User Analytics Report
        </h1>
        <p className="mt-1 text-[12px] text-ink-700">
          Auswertung der Plattform-Aktivität anhand der Cloudflare Analytics
          Engine (<span className="font-mono">controll_platform_logs</span>).
          Zeitraum:{" "}
          <span className="font-mono">{range.from}</span> →{" "}
          <span className="font-mono">{range.to}</span>.
        </p>

        <div className="mt-3 grid grid-cols-3 gap-3 rounded border border-hair px-3 py-2">
          <PdfHero
            label="Aktive Zeit"
            value={`${(s.totalActiveSec / 3600).toFixed(1)} h`}
            sub={fmtDuration(s.totalActiveSec)}
          />
          <PdfHero
            label="Offen aktuell"
            value={
              s.totalRemaining != null ? fmtNumber(s.totalRemaining) : "–"
            }
            sub="Fahrzeuge in allen Modi"
          />
          <PdfHero
            label="Restdauer"
            value={fmtHours(s.etaHoursActive)}
            sub={`24-h-Sicht: ${fmtHours(s.etaHoursCalendar)}`}
          />
        </div>

        <h2 className="mt-5 text-[14px] font-semibold tracking-tightish">
          1. Aktivität pro Tag
        </h2>
        <p className="text-[11px] leading-relaxed text-ink-700">
          Wie viele Stunden war der User pro Kalendertag (UTC) aktiv. Sessions,
          die über Mitternacht laufen, werden anteilig auf beide Tage verteilt.
        </p>
        {dailyChartData.length === 0 ? (
          <p className="mt-2 text-[11px] text-ink-500">– keine Tagesdaten –</p>
        ) : (
          <PrintAreaChart
            data={dailyChartData}
            yUnit="h"
            height={150}
            series={[
              {
                key: "activeHours",
                name: "Aktive Zeit (h)",
                color: "#0d0d0f",
                gradientId: "pdf-active",
              },
            ]}
          />
        )}

        <h2 className="mt-4 text-[14px] font-semibold tracking-tightish">
          2. Übersicht
        </h2>
        <p className="text-[11px] leading-relaxed text-ink-700">
          „Aktive Zeit" misst die echte Arbeitszeit des Users (Sessions mit
          5-Minuten-Pausen-Schwelle). Die <em>Kalendertag-Sicht</em> verteilt
          die bearbeiteten Fahrzeuge gleichmäßig über den ganzen Reportzeitraum.
          „Restdauer" rechnet die aktuell offenen Fahrzeuge mit der gemessenen
          Rate des Users hoch.
        </p>
        <table className="mt-2 w-full border-collapse text-[10.5px]">
          <tbody>
            <PrintRow label="Events gesamt" value={fmtNumber(s.eventCount)} />
            <PrintRow
              label="Aktionen (shortcut:*)"
              value={`${fmtNumber(s.actionCount)} (${
                s.eventCount > 0
                  ? `${((s.actionCount / s.eventCount) * 100).toFixed(1)} %`
                  : "–"
              })`}
            />
            <PrintRow label="Sessions" value={fmtNumber(s.sessionCount)} />
            <PrintRow
              label="Aktive Zeit gesamt"
              value={fmtDuration(s.totalActiveSec)}
            />
            <PrintRow
              label="Ø / längste Session"
              value={`${fmtDuration(s.avgSessionSec)} · ${fmtDuration(s.longestSessionSec)}`}
            />
            <PrintRow
              label="Reportzeitraum"
              value={`${(s.rangeDays || 0).toFixed(2)} Tage · ${fmtNumber(s.rangeSpanSec)} s`}
            />
            <PrintRow
              label="Aktive Tage / IPs"
              value={`${fmtNumber(s.uniqueDays)} Tage · ${fmtNumber(s.uniqueIps)} IPs${
                detail.scope.aggregate
                  ? ` · ${fmtNumber(s.uniqueUsers)} User`
                  : ""
              }`}
            />
            <PrintRow
              label="Tempo gesamt"
              value={`${overallTempoMin.toFixed(2)} Aktionen/min · ${overallTempoHour.toFixed(1)} /h`}
            />
            <PrintRow
              label="Bearbeitete Fahrzeuge"
              value={fmtNumber(s.processedTotal)}
            />
            <PrintRow
              label="Ø Fahrzeuge / aktive h"
              value={fmtRate(s.vehiclesPerActiveHour)}
            />
            <PrintRow
              label="Ø Fahrzeuge / Kalendertag"
              value={fmtRate(s.vehiclesPerCalendarDay, "/Tag")}
            />
            <PrintRow
              label="Aktuell offen (alle Modi)"
              value={
                s.totalRemaining != null ? fmtNumber(s.totalRemaining) : "–"
              }
            />
            <PrintRow
              label="Restdauer (echte Arbeitszeit)"
              value={fmtHours(s.etaHoursActive)}
            />
            <PrintRow
              label="Restdauer (24-h-Sicht)"
              value={fmtHours(s.etaHoursCalendar)}
            />
            <PrintRow
              label="Erstes / letztes Event"
              value={
                s.firstTs && s.lastTs
                  ? `${fmtDateTime(s.firstTs)} → ${fmtDateTime(s.lastTs)}`
                  : "–"
              }
            />
          </tbody>
        </table>
      </PrintPage>

      {/* SEITE 2 — Verbleibend & Tagestabelle */}
      <PrintPage
        pageNumber={2}
        totalPages={TOTAL_PAGES}
        generatedAt={generatedAt}
        userAgent={s.primaryUserAgent}
        userLabel={userLabel}
      >
        <h2 className="text-[14px] font-semibold tracking-tightish">
          3. Verbleibende Fahrzeuge je Modus
        </h2>
        <p className="text-[11px] leading-relaxed text-ink-700">
          Werte aus <span className="font-mono">double2..5</span> ab{" "}
          <span className="font-mono">2026-05-02 19:32:50</span>. „Bearbeitet"
          ist die Summe der Rückgänge des Bestands über die Eventreihen.
          „Restdauer" rechnet aktuell offene Fahrzeuge mit der gemessenen Rate
          des Users hoch.
        </p>
        <table className="mt-2 w-full border-collapse text-[11px]">
          <thead>
            <tr className="border-b border-hair text-left">
              <th className="py-1.5 pr-3">Modus</th>
              <th className="py-1.5 pr-3 text-right">Aktuell offen</th>
              <th className="py-1.5 pr-3 text-right">min</th>
              <th className="py-1.5 pr-3 text-right">max</th>
              <th className="py-1.5 pr-3 text-right">Bearbeitet</th>
              <th className="py-1.5 pr-3 text-right">/h</th>
              <th className="py-1.5 pr-3 text-right">Restdauer</th>
            </tr>
          </thead>
          <tbody>
            {detail.remainingByMode.map((r) => (
              <tr key={r.mode} className="border-b border-hair/60">
                <td className="py-1.5 pr-3">{r.mode}</td>
                <td className="py-1.5 pr-3 text-right font-mono">
                  {r.latestOpen != null ? fmtNumber(r.latestOpen) : "–"}
                </td>
                <td className="py-1.5 pr-3 text-right">
                  {r.minOpen != null ? fmtNumber(r.minOpen) : "–"}
                </td>
                <td className="py-1.5 pr-3 text-right">
                  {r.maxOpen != null ? fmtNumber(r.maxOpen) : "–"}
                </td>
                <td className="py-1.5 pr-3 text-right">
                  {fmtNumber(r.processed)}
                </td>
                <td className="py-1.5 pr-3 text-right">
                  {fmtRate(r.processedPerHour)}
                </td>
                <td className="py-1.5 pr-3 text-right">
                  {fmtHours(r.etaHours)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 className="mt-6 text-[14px] font-semibold tracking-tightish">
          4. Aktivität pro Tag · Detail
        </h2>
        <p className="text-[11px] leading-relaxed text-ink-700">
          Tabellarische Aufstellung der täglichen Werte (zuletzt 31 Tage).
          „Tempo /min" zählt nur echte Aktionen (
          <span className="font-mono">shortcut:*</span>) pro aktiver Minute des
          Tages.
        </p>
        {detail.dailyActivity.length === 0 ? (
          <p className="mt-2 text-[11px] text-ink-500">– keine Tagesdaten –</p>
        ) : (
          <table className="mt-2 w-full border-collapse text-[10.5px]">
            <thead>
              <tr className="border-b border-hair text-left">
                <th className="py-1.5 pr-3">Tag</th>
                <th className="py-1.5 pr-3 text-right">Aktive Zeit</th>
                <th className="py-1.5 pr-3 text-right">Sessions</th>
                <th className="py-1.5 pr-3 text-right">Events</th>
                <th className="py-1.5 pr-3 text-right">Aktionen</th>
                <th className="py-1.5 pr-3 text-right">Tempo /min</th>
                <th className="py-1.5 pr-3 text-right">Bearbeitet</th>
                <th className="py-1.5 pr-3 text-right">Ø Latenz</th>
              </tr>
            </thead>
            <tbody>
              {detail.dailyActivity.slice(-31).map((d) => {
                const tempoMin =
                  d.activeSec > 0 ? (d.actions * 60) / d.activeSec : 0;
                return (
                  <tr key={d.day} className="border-b border-hair/60">
                    <td className="py-1.5 pr-3 font-mono">{d.day}</td>
                    <td className="py-1.5 pr-3 text-right">
                      {fmtDuration(d.activeSec)}
                    </td>
                    <td className="py-1.5 pr-3 text-right">
                      {fmtNumber(d.sessions)}
                    </td>
                    <td className="py-1.5 pr-3 text-right">
                      {fmtNumber(d.events)}
                    </td>
                    <td className="py-1.5 pr-3 text-right">
                      {fmtNumber(d.actions)}
                    </td>
                    <td className="py-1.5 pr-3 text-right">
                      {d.activeSec > 0 ? tempoMin.toFixed(2) : "–"}
                    </td>
                    <td className="py-1.5 pr-3 text-right">
                      {fmtNumber(d.processed)}
                    </td>
                    <td className="py-1.5 pr-3 text-right">
                      {fmtMs(d.avgLatencyMs)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </PrintPage>

      {/* SEITE 3 — Tempo */}
      <PrintPage
        pageNumber={3}
        totalPages={TOTAL_PAGES}
        generatedAt={generatedAt}
        userAgent={s.primaryUserAgent}
        userLabel={userLabel}
      >
        <h2 className="text-[14px] font-semibold tracking-tightish">
          5. Tempo
        </h2>
        <p className="text-[11px] leading-relaxed text-ink-700">
          Aktionen pro aktiver Minute. Die rote gestrichelte Linie zeigt den
          Gesamtdurchschnitt über den ganzen Reportzeitraum.
        </p>
        <p className="mt-1 text-[11px] text-ink-700">
          Tempo gesamt:{" "}
          <strong>{overallTempoMin.toFixed(2)} Aktionen/min</strong> ·{" "}
          {overallTempoHour.toFixed(1)} Aktionen/h
        </p>

        <h3 className="mt-3 text-[12px] font-semibold tracking-tightish">
          Pro Tag
        </h3>
        {dailyChartData.length === 0 ? (
          <p className="mt-2 text-[11px] text-ink-500">– keine Daten –</p>
        ) : (
          <PrintAreaChart
            data={dailyChartData}
            yUnit="/min"
            height={170}
            referenceY={overallTempoMin}
            referenceLabel={`Ø ${overallTempoMin.toFixed(2)} /min`}
            series={[
              {
                key: "tempoMin",
                name: "Tempo (Aktionen/min)",
                color: "#0d0d0f",
                gradientId: "pdf-tempo-day",
              },
            ]}
          />
        )}

        <h3 className="mt-4 text-[12px] font-semibold tracking-tightish">
          Pro Modus
        </h3>
        {tempoModeData.length === 0 ? (
          <p className="mt-2 text-[11px] text-ink-500">
            – keine Modus-Daten mit messbarer Aktivität –
          </p>
        ) : (
          <>
            <PrintAreaChart
              data={tempoModeData}
              yUnit="/min"
              height={150}
              referenceY={overallTempoMin}
              referenceLabel={`Ø ${overallTempoMin.toFixed(2)} /min`}
              series={[
                {
                  key: "tempo",
                  name: "Tempo (Aktionen/min)",
                  color: "#1f6feb",
                  gradientId: "pdf-tempo-mode",
                },
              ]}
            />
            <table className="mt-3 w-full border-collapse text-[10.5px]">
              <thead>
                <tr className="border-b border-hair text-left">
                  <th className="py-1.5 pr-3">Modus</th>
                  <th className="py-1.5 pr-3 text-right">Aktionen</th>
                  <th className="py-1.5 pr-3 text-right">Aktive Zeit</th>
                  <th className="py-1.5 pr-3 text-right">Tempo /min</th>
                  <th className="py-1.5 pr-3 text-right">Tempo /h</th>
                  <th className="py-1.5 pr-3 text-right">vs. Ø</th>
                </tr>
              </thead>
              <tbody>
                {detail.perMode
                  .filter((m) => m.activeSec > 0 && m.actions > 0)
                  .map((m) => {
                    const tMin = (m.actions * 60) / m.activeSec;
                    const tHour = (m.actions * 3600) / m.activeSec;
                    const diff =
                      overallTempoMin > 0
                        ? ((tMin - overallTempoMin) / overallTempoMin) * 100
                        : 0;
                    return (
                      <tr key={m.mode} className="border-b border-hair/60">
                        <td className="py-1.5 pr-3">{m.mode || "(leer)"}</td>
                        <td className="py-1.5 pr-3 text-right">
                          {fmtNumber(m.actions)}
                        </td>
                        <td className="py-1.5 pr-3 text-right">
                          {fmtDuration(m.activeSec)}
                        </td>
                        <td className="py-1.5 pr-3 text-right">
                          {tMin.toFixed(2)}
                        </td>
                        <td className="py-1.5 pr-3 text-right">
                          {tHour.toFixed(1)}
                        </td>
                        <td className="py-1.5 pr-3 text-right">
                          {diff >= 0 ? "+" : ""}
                          {diff.toFixed(0)} %
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </>
        )}
      </PrintPage>

      {/* SEITE 4 — Aktionen über Zeit */}
      <PrintPage
        pageNumber={4}
        totalPages={TOTAL_PAGES}
        generatedAt={generatedAt}
        userAgent={s.primaryUserAgent}
        userLabel={userLabel}
      >
        <h2 className="text-[14px] font-semibold tracking-tightish">
          6. Aktionen über Zeit
        </h2>
        <p className="text-[11px] leading-relaxed text-ink-700">
          Welche Buttons wurden gedrückt – pro Zeit-Bucket. Eine Fläche pro
          Top-Button (Top {detail.topButtonNames.length}). Die Latenz pro Bucket
          steht in der Tabelle.
        </p>

        {buttonsChartData.length === 0 || buttonsSeries.length === 0 ? (
          <p className="mt-2 text-[11px] text-ink-500">
            – keine Aktionsverläufe –
          </p>
        ) : (
          <>
            <PrintAreaChart
              data={buttonsChartData}
              series={buttonsSeries}
              height={210}
            />
            <h3 className="mt-3 text-[12px] font-semibold tracking-tightish">
              Detail-Tabelle (zuletzt 25 Buckets)
            </h3>
            <table className="mt-2 w-full border-collapse text-[9.5px]">
              <thead>
                <tr className="border-b border-hair text-left">
                  <th className="py-1.5 pr-3">Zeit-Bucket</th>
                  {detail.topButtonNames.map((b) => (
                    <th key={b} className="py-1.5 pr-3 text-right">
                      {b}
                    </th>
                  ))}
                  <th className="py-1.5 pr-3 text-right">Ø Latenz</th>
                </tr>
              </thead>
              <tbody>
                {detail.buttonsTimeline.slice(-25).map((b) => (
                  <tr key={b.bucket} className="border-b border-hair/60">
                    <td className="py-1.5 pr-3 font-mono">{b.bucket}</td>
                    {detail.topButtonNames.map((name) => (
                      <td key={name} className="py-1.5 pr-3 text-right">
                        {fmtNumber(b.counts[name] ?? 0)}
                      </td>
                    ))}
                    <td className="py-1.5 pr-3 text-right">
                      {fmtMs(b.avgLatencyMs)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </PrintPage>

      {/* SEITE 5 — Aktivitätsverlauf + Internet */}
      <PrintPage
        pageNumber={5}
        totalPages={TOTAL_PAGES}
        generatedAt={generatedAt}
        userAgent={s.primaryUserAgent}
        userLabel={userLabel}
      >
        <h2 className="text-[14px] font-semibold tracking-tightish">
          7. Aktivität · Events / Aktionen / Bearbeitet
        </h2>
        <p className="text-[11px] leading-relaxed text-ink-700">
          Pro Zeit-Bucket: Events (grau), echte Aktionen (schwarz) und
          bearbeitete Fahrzeuge (blau).
        </p>
        {activityChartData.length === 0 ? (
          <p className="mt-2 text-[11px] text-ink-500">– keine Verlaufsdaten –</p>
        ) : (
          <PrintAreaChart
            data={activityChartData}
            height={170}
            series={[
              {
                key: "events",
                name: "Events",
                color: "#9aa2ac",
                gradientId: "pdf-act-evt",
              },
              {
                key: "actions",
                name: "Aktionen",
                color: "#0d0d0f",
                gradientId: "pdf-act-act",
              },
              {
                key: "processed",
                name: "Bearbeitet",
                color: "#1f6feb",
                gradientId: "pdf-act-proc",
              },
            ]}
          />
        )}

        <h2 className="mt-5 text-[14px] font-semibold tracking-tightish">
          8. Internetgeschwindigkeit
        </h2>
        <p className="text-[11px] leading-relaxed text-ink-700">
          Latenz pro Aktion (<span className="font-mono">blob7</span>) als ms.
          „p95" heißt: 95 % aller Aktionen waren schneller.
        </p>
        <table className="mt-2 w-full border-collapse text-[11px]">
          <tbody>
            <PrintRow
              label="Samples"
              value={fmtNumber(detail.network.samples)}
            />
            <PrintRow label="Ø" value={fmtMs(detail.network.avgMs)} />
            <PrintRow
              label="min / max"
              value={`${fmtMs(detail.network.minMs)} – ${fmtMs(detail.network.maxMs)}`}
            />
            <PrintRow
              label="p50 / p95 / p99"
              value={`${fmtMs(detail.network.p50Ms)} · ${fmtMs(detail.network.p95Ms)} · ${fmtMs(detail.network.p99Ms)}`}
            />
          </tbody>
        </table>
        {scatterData.length > 0 && (
          <>
            <h3 className="mt-3 text-[12px] font-semibold tracking-tightish">
              Latenz-Verlauf · jeder Punkt = eine Aktion
            </h3>
            <PrintScatterChart data={scatterData} height={150} />
          </>
        )}
        {detail.vehicleLatency.length > 0 && (
          <>
            <h3 className="mt-3 text-[12px] font-semibold tracking-tightish">
              Top-Fahrzeuge nach Latenz
            </h3>
            <table className="mt-2 w-full border-collapse text-[10px]">
              <thead>
                <tr className="border-b border-hair text-left">
                  <th className="py-1.5 pr-3">Fahrzeug</th>
                  <th className="py-1.5 pr-3 text-right">Aktionen</th>
                  <th className="py-1.5 pr-3 text-right">Ø ms</th>
                  <th className="py-1.5 pr-3 text-right">max ms</th>
                </tr>
              </thead>
              <tbody>
                {detail.vehicleLatency.slice(0, 12).map((v, i) => (
                  <tr key={i} className="border-b border-hair/60">
                    <td className="py-1.5 pr-3">{v.label}</td>
                    <td className="py-1.5 pr-3 text-right">
                      {fmtNumber(v.actions)}
                    </td>
                    <td className="py-1.5 pr-3 text-right">
                      {fmtMs(v.avgLatencyMs)}
                    </td>
                    <td className="py-1.5 pr-3 text-right">
                      {fmtMs(v.maxLatencyMs)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </PrintPage>

      {/* SEITE 6 — Verteilungen */}
      <PrintPage
        pageNumber={6}
        totalPages={TOTAL_PAGES}
        generatedAt={generatedAt}
        userAgent={s.primaryUserAgent}
        userLabel={userLabel}
      >
        <h2 className="text-[14px] font-semibold tracking-tightish">
          9. Verteilungen
        </h2>
        <p className="text-[11px] leading-relaxed text-ink-700">
          Wann arbeitet der User typischerweise? Oben die Stunde des Tages
          (UTC), unten der Wochentag.
        </p>

        <h3 className="mt-3 text-[12px] font-semibold tracking-tightish">
          Stunde des Tages (UTC)
        </h3>
        <PrintAreaChart
          data={hourPdfData}
          height={150}
          series={[
            {
              key: "events",
              name: "Events",
              color: "#9aa2ac",
              gradientId: "pdf-h-evt",
            },
            {
              key: "actions",
              name: "Aktionen",
              color: "#0d0d0f",
              gradientId: "pdf-h-act",
            },
          ]}
        />

        <h3 className="mt-4 text-[12px] font-semibold tracking-tightish">
          Wochentag
        </h3>
        <PrintAreaChart
          data={wdPdfData}
          height={150}
          series={[
            {
              key: "events",
              name: "Events",
              color: "#9aa2ac",
              gradientId: "pdf-wd-evt",
            },
            {
              key: "actions",
              name: "Aktionen",
              color: "#0d0d0f",
              gradientId: "pdf-wd-act",
            },
          ]}
        />

        <h2 className="mt-6 text-[14px] font-semibold tracking-tightish">
          10. Sessions (zuletzt 12)
        </h2>
        <p className="text-[11px] leading-relaxed text-ink-700">
          Eine Session ist ein Block zusammenhängender Aktivität. Eine Pause
          von ≥ 5 Minuten beendet die laufende Session.
        </p>
        {detail.sessions.length === 0 ? (
          <p className="mt-2 text-[11px] text-ink-500">– keine Sessions –</p>
        ) : (
          <table className="mt-2 w-full border-collapse text-[10px]">
            <thead>
              <tr className="border-b border-hair text-left">
                <th className="py-1.5 pr-3">Start</th>
                <th className="py-1.5 pr-3">Ende</th>
                <th className="py-1.5 pr-3 text-right">Events</th>
                <th className="py-1.5 pr-3 text-right">Aktionen</th>
                <th className="py-1.5 pr-3 text-right">Aktiv</th>
                <th className="py-1.5 pr-3">Modi</th>
              </tr>
            </thead>
            <tbody>
              {detail.sessions
                .slice(-12)
                .reverse()
                .map((sess, i) => (
                  <tr key={i} className="border-b border-hair/60">
                    <td className="py-1.5 pr-3 font-mono">
                      {fmtDateTime(sess.start)}
                    </td>
                    <td className="py-1.5 pr-3 font-mono">
                      {fmtDateTime(sess.end)}
                    </td>
                    <td className="py-1.5 pr-3 text-right">
                      {fmtNumber(sess.events)}
                    </td>
                    <td className="py-1.5 pr-3 text-right">
                      {fmtNumber(sess.actions)}
                    </td>
                    <td className="py-1.5 pr-3 text-right">
                      {fmtDuration(sess.durationSec)}
                    </td>
                    <td className="py-1.5 pr-3">
                      {sess.modes.join(", ") || "–"}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </PrintPage>

      {/* SEITE 7 — IPs + Aufschlüsselungen */}
      <PrintPage
        pageNumber={7}
        totalPages={TOTAL_PAGES}
        generatedAt={generatedAt}
        userAgent={s.primaryUserAgent}
        userLabel={userLabel}
      >
        <h2 className="text-[14px] font-semibold tracking-tightish">
          11. IP-Adressen
        </h2>
        <p className="text-[11px] leading-relaxed text-ink-700">
          Aufschlüsselung der Aktivität pro IP. Bei <em>Alle User</em> werden
          alle Plattform-User gemeinsam betrachtet.
        </p>
        {detail.perIp.length === 0 ? (
          <p className="mt-2 text-[11px] text-ink-500">– keine IP-Daten –</p>
        ) : (
          <table className="mt-2 w-full border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-hair text-left">
                <th className="py-1.5 pr-3">IP</th>
                <th className="py-1.5 pr-3 text-right">Events</th>
                <th className="py-1.5 pr-3 text-right">Aktionen</th>
                <th className="py-1.5 pr-3 text-right">Aktiv</th>
                <th className="py-1.5 pr-3 text-right">Ø Latenz</th>
              </tr>
            </thead>
            <tbody>
              {detail.perIp.slice(0, 30).map((ip) => (
                <tr key={ip.ip} className="border-b border-hair/60">
                  <td className="py-1.5 pr-3 font-mono">{ip.ip || "(leer)"}</td>
                  <td className="py-1.5 pr-3 text-right">
                    {fmtNumber(ip.events)}
                  </td>
                  <td className="py-1.5 pr-3 text-right">
                    {fmtNumber(ip.actions)}
                  </td>
                  <td className="py-1.5 pr-3 text-right">
                    {fmtDuration(ip.activeSec)}
                  </td>
                  <td className="py-1.5 pr-3 text-right">
                    {fmtMs(ip.avgLatencyMs)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <h2 className="mt-6 text-[14px] font-semibold tracking-tightish">
          12. Aufschlüsselungen
        </h2>
        <p className="text-[11px] leading-relaxed text-ink-700">
          Top-Listen über den ganzen Berichtszeitraum.
        </p>
        <div className="mt-2 grid grid-cols-2 gap-x-8 gap-y-4">
          <PrintRankList
            title="Aktionen (shortcut:*)"
            items={detail.topActions.map((a) => ({
              label: a.button,
              value: a.count,
            }))}
          />
          <PrintRankList
            title="Modi"
            items={detail.topModes.map((m) => ({
              label: m.mode || "(leer)",
              value: m.count,
            }))}
          />
          <PrintRankList
            title="Marken"
            items={detail.topBrands.map((b) => ({
              label: b.brand,
              value: b.count,
            }))}
          />
          <PrintRankList
            title="Modelle"
            items={detail.topModels.map((m) => ({
              label: `${m.brand} ${m.model}`,
              value: m.count,
            }))}
          />
          <PrintRankList
            title="Ansichten"
            items={detail.topViews.map((v) => ({
              label: v.view,
              value: v.count,
            }))}
          />
          <PrintRankList
            title="Per-Modus (Events / Aktionen)"
            items={detail.perMode.map((m) => ({
              label: `${m.mode || "(leer)"}`,
              value: m.events,
              extra: ` · ${fmtNumber(m.actions)} Aktionen`,
            }))}
          />
        </div>
      </PrintPage>

      {/* SEITE 8 — Fahrzeuge */}
      <PrintPage
        pageNumber={8}
        totalPages={TOTAL_PAGES}
        generatedAt={generatedAt}
        userAgent={s.primaryUserAgent}
        userLabel={userLabel}
      >
        <h2 className="text-[14px] font-semibold tracking-tightish">
          13. Fahrzeuge ({detail.vehicles.length})
        </h2>
        <p className="text-[11px] leading-relaxed text-ink-700">
          Bearbeitete Fahrzeuge im Zeitraum mit Anzahl Events / Aktionen sowie
          den Usern, die das jeweilige Fahrzeug bearbeitet haben.
        </p>
        {detail.vehicles.length === 0 ? (
          <p className="mt-2 text-[11px] text-ink-500">
            – keine Fahrzeug-Daten –
          </p>
        ) : (
          <table className="mt-2 w-full border-collapse text-[10.5px]">
            <thead>
              <tr className="border-b border-hair text-left">
                <th className="py-1.5 pr-3">Fahrzeug</th>
                <th className="py-1.5 pr-3 text-right">Events</th>
                <th className="py-1.5 pr-3 text-right">Aktionen</th>
                <th className="py-1.5 pr-3">User</th>
                <th className="py-1.5 pr-3">Ansichten</th>
              </tr>
            </thead>
            <tbody>
              {detail.vehicles.slice(0, 80).map((v, idx) => (
                <tr
                  key={`${v.label}|${idx}`}
                  className="border-b border-hair/60 align-top"
                >
                  <td className="py-1.5 pr-3 font-medium">
                    {v.label || `${v.brand} ${v.model}`}
                    {v.body || v.trim || v.color ? (
                      <span className="block text-[9.5px] font-normal text-ink-500">
                        {[v.body, v.trim, v.color].filter(Boolean).join(" / ")}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-1.5 pr-3 text-right">
                    {fmtNumber(v.events)}
                  </td>
                  <td className="py-1.5 pr-3 text-right">
                    {fmtNumber(v.actions)}
                  </td>
                  <td className="py-1.5 pr-3">
                    {v.users
                      .slice(0, 4)
                      .map((u) => `${u.user} (${u.events})`)
                      .join(", ")}
                    {v.users.length > 4 ? ` …` : ""}
                  </td>
                  <td className="py-1.5 pr-3 font-mono text-[9.5px]">
                    {v.views
                      .slice(0, 6)
                      .map((vw) => `${vw.view}(${vw.count})`)
                      .join(" ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {detail.vehicles.length > 80 && (
          <p className="mt-2 text-[10px] text-ink-500">
            Es werden die 80 aktivsten Fahrzeuge gedruckt. Weitere Fahrzeuge
            sind im Online-Bericht über die Suche zugänglich.
          </p>
        )}
      </PrintPage>
    </div>
  );
}

function PdfHero({
  label,
  value,
  sub,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
}) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-[0.16em] text-ink-500">
        {label}
      </p>
      <p className="font-display text-[16px] leading-tight">{value}</p>
      {sub && <p className="text-[9px] text-ink-500">{sub}</p>}
    </div>
  );
}

function PrintPage({
  pageNumber,
  totalPages,
  generatedAt,
  userLabel,
  userAgent,
  children,
}: {
  pageNumber: number;
  totalPages: number;
  generatedAt: string;
  userLabel: string;
  userAgent?: string | null;
  children: ReactNode;
}) {
  return (
    <article className="pdf-page relative px-0 py-0 text-ink-900">
      <header className="mb-6 flex items-end justify-between border-b border-ink-900/30 pb-3">
        <div className="flex items-center gap-3">
          <Logo className="h-5 w-auto text-ink-900" />
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-ink-500">
              User Analytics Report
            </p>
            <p className="font-display text-[16px] tracking-tightish text-ink-900">
              {userLabel}
            </p>
            {userAgent && (
              <p className="font-mono text-[9.5px] text-ink-500">
                {shortenUserAgent(userAgent)}
              </p>
            )}
          </div>
        </div>
        <p className="text-right text-[10px] text-ink-500">
          erstellt {generatedAt}
          <br />
          vehicleimagery.com · Plattform Reporting
        </p>
      </header>

      <main className="space-y-2">{children}</main>

      <footer className="absolute inset-x-0 bottom-[-12mm] flex items-center justify-between border-t border-hair pt-2 text-[10px] text-ink-500">
        <span>
          User Analytics — {userLabel}
        </span>
        <span>
          Seite {pageNumber} von {totalPages}
        </span>
      </footer>
    </article>
  );
}

function PrintRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <tr className="border-b border-hair/60">
      <td className="w-2/5 py-1.5 pr-3 text-ink-600">{label}</td>
      <td className="py-1.5 pr-3 font-mono text-ink-900">{value}</td>
    </tr>
  );
}

function PrintRankList({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; value: number; extra?: string }>;
}) {
  return (
    <div>
      <p className="mb-1 text-[10px] uppercase tracking-[0.16em] text-ink-500">{title}</p>
      {items.length === 0 ? (
        <p className="text-[10.5px] text-ink-500">– keine –</p>
      ) : (
        <ol className="space-y-0.5">
          {items.slice(0, 10).map((it, i) => (
            <li key={i} className="flex items-baseline justify-between gap-2 text-[10.5px]">
              <span className="truncate">
                <span className="mr-2 font-mono text-ink-400">{i + 1}.</span>
                {it.label}
                {it.extra && <span className="text-ink-500">{it.extra}</span>}
              </span>
              <span className="font-mono text-ink-700">{fmtNumber(it.value)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
