import {
  AlertCircle,
  ArrowLeft,
  ChevronRight,
  Loader2,
  LogOut,
  RefreshCw,
  Search,
  User as UserIcon,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
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

// ---------- Page ----------

export default function UserAnalyticsPage() {
  const { user, logout } = useAuth();
  const [range, setRange] = useState<Range>(() => rangeFromPreset("30d"));
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [selectedIp, setSelectedIp] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const url = useMemo(
    () =>
      userAnalyticsApiUrl(range, {
        user: selectedUser,
        ip: selectedIp,
        gapMinutes: 5,
        limit: 100_000,
      }),
    [range, selectedUser, selectedIp],
  );

  const { data, error, loading, reload } =
    useApi<UserAnalyticsResponse>(url);

  // Wenn der User gewechselt wird, IP zurücksetzen.
  const onSelectUser = useCallback((u: string) => {
    setSelectedUser((prev) => (prev === u ? prev : u));
    setSelectedIp(null);
  }, []);

  const filteredUsers = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!data?.users) return [];
    if (!t) return data.users;
    return data.users.filter((u) => u.user.toLowerCase().includes(t));
  }, [data?.users, q]);

  // Auto-Auswahl des ersten Users.
  useEffect(() => {
    if (selectedUser) return;
    const first = data?.users?.[0]?.user ?? null;
    if (first) setSelectedUser(first);
  }, [data?.users, selectedUser]);

  const aside = (
    <Sidebar
      users={filteredUsers}
      total={data?.users?.length ?? 0}
      loading={loading && !data}
      error={error}
      query={q}
      onQuery={setQ}
      selectedUser={selectedUser}
      onSelectUser={onSelectUser}
      selectedIp={selectedIp}
      onSelectIp={setSelectedIp}
      detail={data?.detail ?? null}
    />
  );

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-paper text-ink-900">
      <header className="shrink-0 border-b border-hair bg-paper">
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

      <div className="flex min-h-0 flex-1 basis-0 flex-col overflow-hidden">
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
            selectedUser={selectedUser}
            selectedIp={selectedIp}
            onSelectIp={setSelectedIp}
          />
        </SplitView>
      </div>
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
  selectedUser,
  onSelectUser,
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
  selectedUser: string | null;
  onSelectUser: (u: string) => void;
  selectedIp: string | null;
  onSelectIp: (ip: string | null) => void;
  detail: DetailReport | null;
}) {
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
              const active = u.user === selectedUser;
              return (
                <li key={u.user}>
                  <button
                    type="button"
                    onClick={() => onSelectUser(u.user)}
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
                        {fmtNumber(u.uniqueIps)} IP
                      </p>
                    </div>
                    {active && (
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-400" />
                    )}
                  </button>
                  {active && detail && detail.perIp.length > 0 && (
                    <ul className="border-t border-hair bg-ink-50/40 py-1">
                      <li>
                        <button
                          type="button"
                          onClick={() => onSelectIp(null)}
                          className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11.5px] transition ${
                            selectedIp == null
                              ? "bg-ink-900/[0.05] text-ink-900"
                              : "text-ink-600 hover:bg-night-900/[0.04]"
                          }`}
                        >
                          <span className="font-medium">Gesamt</span>
                          <span className="ml-auto text-[10.5px] text-ink-400">
                            {fmtNumber(detail.summary.eventCount)} Events
                          </span>
                        </button>
                      </li>
                      {detail.perIp.map((ip) => {
                        const active = selectedIp === ip.ip;
                        return (
                          <li key={ip.ip}>
                            <button
                              type="button"
                              onClick={() => onSelectIp(ip.ip)}
                              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11.5px] transition ${
                                active
                                  ? "bg-ink-900/[0.05] text-ink-900"
                                  : "text-ink-600 hover:bg-night-900/[0.04]"
                              }`}
                            >
                              <span className="truncate font-mono">
                                {ip.ip || "(leer)"}
                              </span>
                              <span className="ml-auto whitespace-nowrap text-[10.5px] text-ink-400">
                                {fmtNumber(ip.events)}
                              </span>
                            </button>
                          </li>
                        );
                      })}
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

// ---------- Detail-Bereich ----------

function DetailPane({
  data,
  loading,
  error,
  selectedUser,
  selectedIp,
  onSelectIp,
}: {
  data: UserAnalyticsResponse | null;
  loading: boolean;
  error: string | null;
  selectedUser: string | null;
  selectedIp: string | null;
  onSelectIp: (ip: string | null) => void;
}) {
  if (!selectedUser) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-12">
        <div className="max-w-md text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-ink-900 text-white">
            <UserIcon className="h-5 w-5" />
          </div>
          <h2 className="mt-4 font-display text-[22px] tracking-tightish text-ink-900">
            Wähle einen User links
          </h2>
          <p className="mt-3 text-[13px] leading-relaxed text-ink-500">
            Datenquelle: Analytics Engine{" "}
            <span className="font-mono text-ink-700">controll_platform_logs</span>.
            Werte für „verbleibende Fahrzeuge" werden erst ab{" "}
            <span className="font-mono text-ink-700">2026-05-02 19:32:50</span>{" "}
            verwendet; die fehlerhafte Zeile am{" "}
            <span className="font-mono text-ink-700">2026-05-03 07:36:49</span>{" "}
            wird ignoriert.
          </p>
        </div>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center text-[13px] text-ink-400">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Lade Detaildaten …
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
        <span className="ml-1 font-mono text-ink-800">{selectedUser}</span>
        {selectedIp ? (
          <>
            {" "}/ <span className="font-mono text-ink-800">{selectedIp}</span>
          </>
        ) : null}
        {" "}im Zeitraum.
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <DetailHeader detail={detail} onSelectIp={onSelectIp} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1500px] space-y-6 px-4 py-6 sm:px-6">
          <SummaryCards detail={detail} />
          <RemainingByModeBlock detail={detail} />
          <TimelineBlock detail={detail} />
          <NetworkSpeedBlock detail={detail} />
          <PerModeBlock detail={detail} />
          <TopRowsBlock detail={detail} />
          <PerIpBlock detail={detail} onSelectIp={onSelectIp} />
          <DistributionBlock detail={detail} />
          <SessionsBlock detail={detail} />
        </div>
      </div>
    </div>
  );
}

function DetailHeader({
  detail,
  onSelectIp,
}: {
  detail: DetailReport;
  onSelectIp: (ip: string | null) => void;
}) {
  return (
    <div className="shrink-0 border-b border-hair bg-white px-4 py-3 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-ink-400">
            User-Bericht
          </p>
          <h2 className="mt-0.5 font-display text-[22px] tracking-tightish text-ink-900">
            {detail.user}
          </h2>
          <p className="text-[11.5px] text-ink-500">
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
              <>{fmtNumber(detail.summary.uniqueIps)} IP-Adressen · {fmtNumber(detail.summary.uniqueDays)} Tage aktiv</>
            )}
            {detail.summary.firstTs && detail.summary.lastTs && (
              <>
                {" · "}
                {fmtDateTime(detail.summary.firstTs)} → {fmtDateTime(detail.summary.lastTs)}
                {" · "}
                {fmtRelative(detail.summary.lastTs)}
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------- Card-Helper ----------

function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "accent";
}) {
  return (
    <div
      className={`rounded-xl border border-hair bg-white p-4 ${tone === "accent" ? "ring-1 ring-ink-900/[0.04]" : ""}`}
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-400">
        {label}
      </p>
      <p className="mt-1.5 font-display text-[20px] tracking-tightish text-ink-900">
        {value}
      </p>
      {hint && <p className="mt-1 text-[11px] text-ink-500">{hint}</p>}
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h3 className="text-[14px] font-semibold tracking-tightish text-ink-900">
            {title}
          </h3>
          {hint && (
            <p className="text-[11.5px] text-ink-500">{hint}</p>
          )}
        </div>
      </div>
      <div>{children}</div>
    </section>
  );
}

// ---------- Blöcke ----------

function SummaryCards({ detail }: { detail: DetailReport }) {
  const s = detail.summary;
  return (
    <Section title="Übersicht">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Stat
          label="Events"
          value={fmtNumber(s.eventCount)}
          hint={`davon ${fmtNumber(s.actionCount)} Aktionen (shortcut:*)`}
        />
        <Stat
          label="Sessions"
          value={fmtNumber(s.sessionCount)}
          hint={`Ø ${fmtDuration(s.avgSessionSec)} · max. ${fmtDuration(s.longestSessionSec)}`}
        />
        <Stat
          label="Aktive Zeit gesamt"
          value={fmtDuration(s.totalActiveSec)}
          hint={`${fmtNumber(s.uniqueDays)} Tage · ${fmtNumber(s.uniqueIps)} IPs`}
        />
        <Stat
          label="Events / Sekunde"
          value={
            s.eventsPerSec != null
              ? `${s.eventsPerSec.toFixed(2)} /s`
              : "–"
          }
          hint={`≈ ${fmtRate(s.eventsPerMinute, "/min")} · ${fmtRate(s.eventsPerActiveHour, "/h")}`}
          tone="accent"
        />
        <Stat
          label="Aktionen / Sekunde"
          value={
            s.actionsPerSec != null
              ? `${s.actionsPerSec.toFixed(2)} /s`
              : "–"
          }
          hint={`≈ ${fmtRate(s.actionsPerMinute, "/min")} · ${fmtRate(s.actionsPerActiveHour, "/h")}`}
          tone="accent"
        />
        <Stat
          label="Fahrzeuge / aktive Stunde"
          value={fmtRate(s.vehiclesPerActiveHour, "/h")}
          hint="Summe der Rückgänge in double2..5"
        />
        <Stat
          label="Erstes Event"
          value={s.firstTs ? fmtDateTime(s.firstTs) : "–"}
          hint={s.firstTs ? fmtRelative(s.firstTs) : undefined}
        />
        <Stat
          label="Letztes Event"
          value={s.lastTs ? fmtDateTime(s.lastTs) : "–"}
          hint={s.lastTs ? fmtRelative(s.lastTs) : undefined}
        />
      </div>
    </Section>
  );
}

function RemainingByModeBlock({ detail }: { detail: DetailReport }) {
  const rows = detail.remainingByMode;
  return (
    <Section
      title="Verbleibende Fahrzeuge je Modus (double2..5)"
      hint="Werte ab 2026-05-02 19:32:50; latester Stand aus den Events des Users."
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {rows.map((r) => (
          <div
            key={r.mode}
            className="flex flex-col gap-1.5 rounded-xl border border-hair bg-white p-4"
          >
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-400">
              {r.mode}
            </p>
            <p className="font-display text-[22px] tracking-tightish text-ink-900">
              {r.latestOpen != null ? fmtNumber(r.latestOpen) : "–"}
            </p>
            <p className="text-[11px] text-ink-500">
              min {r.minOpen != null ? fmtNumber(r.minOpen) : "–"} · max{" "}
              {r.maxOpen != null ? fmtNumber(r.maxOpen) : "–"}
            </p>
            <p className="text-[11px] text-ink-500">
              vom User bearbeitet: {fmtNumber(r.processed)}
              {" · "}
              {fmtRate(r.processedPerHour, "/h")}
            </p>
            {r.latestTs && (
              <p className="text-[10.5px] text-ink-400">
                zuletzt: {fmtDateTime(r.latestTs)}
              </p>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}

function TimelineBlock({ detail }: { detail: DetailReport }) {
  if (!detail.timeline.length) {
    return null;
  }
  const data = detail.timeline.map((p) => ({
    ts: p.bucket,
    label: bucketLabel(p.bucket),
    events: p.events,
    actions: p.actions,
    processed: p.processed,
    latency: p.avgLatencyMs,
  }));
  return (
    <Section
      title="Zeitverlauf"
      hint="Events / Aktionen / bearbeitete Fahrzeuge (Ø-Latenz als Linie)"
    >
      <div className="rounded-xl border border-hair bg-white p-3">
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
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
                tick={{ fontSize: 10, fill: "#6b6b73" }}
                stroke="#cfcfd5"
              />
              <Tooltip
                wrapperStyle={{ fontSize: 11 }}
                contentStyle={{ borderRadius: 6, border: "1px solid #eaeaec" }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="L" dataKey="events" name="Events" fill="#6e6e7a" radius={[2, 2, 0, 0]} />
              <Bar yAxisId="L" dataKey="actions" name="Aktionen" fill="#0d0d0f" radius={[2, 2, 0, 0]} />
              <Bar yAxisId="L" dataKey="processed" name="Bearbeitet" fill="#9aa2ac" radius={[2, 2, 0, 0]} />
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
      </div>
    </Section>
  );
}

function NetworkSpeedBlock({ detail }: { detail: DetailReport }) {
  const n = detail.network;
  const points = detail.latencyPoints;
  const scatter = useMemo(() => {
    return points.map((p) => {
      const ms = aeTimestampToDate(p.ts).getTime();
      return { x: ms, y: p.ms, ts: p.ts };
    });
  }, [points]);

  // „Fahrzeug : Internetgeschwindigkeit"-Diagramm
  const vehicles = detail.vehicleLatency;
  const vehicleData = vehicles.map((v) => ({
    label: v.label,
    avg: v.avgLatencyMs ?? 0,
    min: v.minLatencyMs ?? 0,
    max: v.maxLatencyMs ?? 0,
    count: v.actions,
  }));

  return (
    <Section
      title="Internetgeschwindigkeit (Latenz, blob7)"
      hint="Latenz pro Aktion in ms, plus Fahrzeug-Aggregation."
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Samples" value={fmtNumber(n.samples)} />
        <Stat label="Ø" value={fmtMs(n.avgMs)} />
        <Stat label="min" value={fmtMs(n.minMs)} />
        <Stat label="max" value={fmtMs(n.maxMs)} />
        <Stat label="p50" value={fmtMs(n.p50Ms)} />
        <Stat label="p95" value={fmtMs(n.p95Ms)} hint={`p99 ${fmtMs(n.p99Ms)}`} />
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-hair bg-white p-3">
          <p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-ink-400">
            Latenz-Verlauf
          </p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
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
        <div className="rounded-xl border border-hair bg-white p-3">
          <p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-ink-400">
            Fahrzeug : Internetgeschwindigkeit
          </p>
          {vehicleData.length === 0 ? (
            <p className="px-2 py-12 text-center text-[12px] text-ink-400">
              Keine Latenz-Samples mit Fahrzeug-Bezug vorhanden.
            </p>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={vehicleData}
                  margin={{ top: 8, right: 8, bottom: 8, left: 0 }}
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
                    width={150}
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
          )}
        </div>
      </div>
    </Section>
  );
}

function PerModeBlock({ detail }: { detail: DetailReport }) {
  if (!detail.perMode.length) return null;
  return (
    <Section title="Modus-Aufschlüsselung" hint="Aktivität pro blob3 (Korrektur, Skalierung, …)">
      <div className="overflow-x-auto rounded-xl border border-hair bg-white">
        <table className="w-full text-[12.5px]">
          <thead className="bg-ink-50 text-[10.5px] uppercase tracking-[0.12em] text-ink-500">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Modus</th>
              <th className="px-3 py-2 text-right font-medium">Events</th>
              <th className="px-3 py-2 text-right font-medium">Aktionen</th>
              <th className="px-3 py-2 text-right font-medium">Sessions</th>
              <th className="px-3 py-2 text-right font-medium">Aktiv</th>
              <th className="px-3 py-2 text-right font-medium">Aktionen / h</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hair">
            {detail.perMode.map((m) => (
              <tr key={m.mode}>
                <td className="px-3 py-2 font-medium text-ink-900">{m.mode || "(leer)"}</td>
                <td className="px-3 py-2 text-right">{fmtNumber(m.events)}</td>
                <td className="px-3 py-2 text-right">{fmtNumber(m.actions)}</td>
                <td className="px-3 py-2 text-right">{fmtNumber(m.sessions)}</td>
                <td className="px-3 py-2 text-right text-ink-600">{fmtDuration(m.activeSec)}</td>
                <td className="px-3 py-2 text-right">{fmtRate(m.actionsPerHour, "/h")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function TopRowsBlock({ detail }: { detail: DetailReport }) {
  return (
    <Section title="Tops" hint="Häufigste Aktionen, Modi, Fahrzeuge, Marken, Modelle, Ansichten.">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
        <TopList
          title="Aktionen (shortcut:*)"
          items={detail.topActions.map((a) => ({
            key: a.button,
            value: a.count,
            label: a.button,
          }))}
        />
        <TopList
          title="Modi"
          items={detail.topModes.map((m) => ({
            key: m.mode,
            value: m.count,
            label: m.mode || "(leer)",
          }))}
        />
        <TopList
          title="Fahrzeuge"
          items={detail.topVehicles.map((v, idx) => ({
            key: `${v.label}|${idx}`,
            value: v.count,
            label: v.label || `${v.brand} ${v.model}`,
          }))}
        />
        <TopList
          title="Marken"
          items={detail.topBrands.map((b) => ({
            key: b.brand,
            value: b.count,
            label: b.brand,
          }))}
        />
        <TopList
          title="Modelle"
          items={detail.topModels.map((m, i) => ({
            key: `${m.brand}|${m.model}|${i}`,
            value: m.count,
            label: `${m.brand} ${m.model}`,
          }))}
        />
        <TopList
          title="Ansichten"
          items={detail.topViews.map((v) => ({
            key: v.view,
            value: v.count,
            label: v.view,
          }))}
        />
      </div>
    </Section>
  );
}

function TopList({
  title,
  items,
}: {
  title: string;
  items: Array<{ key: string; value: number; label: string }>;
}) {
  const max = items.reduce((m, x) => Math.max(m, x.value), 0) || 1;
  return (
    <div className="rounded-xl border border-hair bg-white p-3">
      <p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-ink-400">
        {title}
      </p>
      {items.length === 0 ? (
        <p className="px-1 py-3 text-[12px] text-ink-400">– keine –</p>
      ) : (
        <ul className="space-y-1">
          {items.map((it) => {
            const pct = (it.value / max) * 100;
            return (
              <li key={it.key} className="text-[11.5px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-ink-700" title={it.label}>
                    {it.label}
                  </span>
                  <span className="shrink-0 text-ink-500">{fmtNumber(it.value)}</span>
                </div>
                <div className="mt-0.5 h-1 w-full overflow-hidden rounded bg-ink-100">
                  <div
                    className="h-full bg-ink-900"
                    style={{ width: `${Math.max(2, pct)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function PerIpBlock({
  detail,
  onSelectIp,
}: {
  detail: DetailReport;
  onSelectIp: (ip: string | null) => void;
}) {
  if (!detail.perIp.length) return null;
  return (
    <Section
      title="IP-Adressen"
      hint="Klick auf IP, um den Bericht auf diese IP einzuschränken."
    >
      <div className="overflow-x-auto rounded-xl border border-hair bg-white">
        <table className="w-full text-[12.5px]">
          <thead className="bg-ink-50 text-[10.5px] uppercase tracking-[0.12em] text-ink-500">
            <tr>
              <th className="px-3 py-2 text-left font-medium">IP</th>
              <th className="px-3 py-2 text-right font-medium">Events</th>
              <th className="px-3 py-2 text-right font-medium">Aktionen</th>
              <th className="px-3 py-2 text-right font-medium">Aktiv</th>
              <th className="px-3 py-2 text-right font-medium">Ø Latenz</th>
              <th className="px-3 py-2 text-left font-medium">Erstes</th>
              <th className="px-3 py-2 text-left font-medium">Letztes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hair">
            {detail.perIp.map((ip) => (
              <tr key={ip.ip}>
                <td className="px-3 py-2 font-mono text-ink-900">
                  <button
                    type="button"
                    onClick={() => onSelectIp(ip.ip)}
                    className="text-left hover:underline"
                  >
                    {ip.ip || "(leer)"}
                  </button>
                </td>
                <td className="px-3 py-2 text-right">{fmtNumber(ip.events)}</td>
                <td className="px-3 py-2 text-right">{fmtNumber(ip.actions)}</td>
                <td className="px-3 py-2 text-right text-ink-600">{fmtDuration(ip.activeSec)}</td>
                <td className="px-3 py-2 text-right">{fmtMs(ip.avgLatencyMs)}</td>
                <td className="px-3 py-2 text-ink-600">
                  {ip.firstTs ? fmtDateTime(ip.firstTs) : "–"}
                </td>
                <td className="px-3 py-2 text-ink-600">
                  {ip.lastTs ? fmtDateTime(ip.lastTs) : "–"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

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
    <Section title="Verteilungen" hint="Stunde des Tages (UTC) und Wochentag.">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-hair bg-white p-3">
          <p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-ink-400">
            Stunde (UTC)
          </p>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                <CartesianGrid stroke="#eaeaec" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#6b6b73" }} stroke="#cfcfd5" />
                <YAxis tick={{ fontSize: 10, fill: "#6b6b73" }} stroke="#cfcfd5" />
                <Tooltip
                  wrapperStyle={{ fontSize: 11 }}
                  contentStyle={{ borderRadius: 6, border: "1px solid #eaeaec" }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="events" name="Events" fill="#9aa2ac" radius={[2, 2, 0, 0]} />
                <Bar dataKey="actions" name="Aktionen" fill="#0d0d0f" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl border border-hair bg-white p-3">
          <p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-ink-400">
            Wochentag
          </p>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={wdData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                <CartesianGrid stroke="#eaeaec" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#6b6b73" }} stroke="#cfcfd5" />
                <YAxis tick={{ fontSize: 10, fill: "#6b6b73" }} stroke="#cfcfd5" />
                <Tooltip
                  wrapperStyle={{ fontSize: 11 }}
                  contentStyle={{ borderRadius: 6, border: "1px solid #eaeaec" }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="events" name="Events" fill="#9aa2ac" radius={[2, 2, 0, 0]} />
                <Bar dataKey="actions" name="Aktionen" fill="#0d0d0f" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </Section>
  );
}

function SessionsBlock({ detail }: { detail: DetailReport }) {
  if (!detail.sessions.length) return null;
  // Bei vielen Sessions kürzen.
  const sessions = detail.sessions.slice(-30).reverse();
  return (
    <Section
      title={`Sessions (zuletzt ${sessions.length} von ${detail.sessions.length})`}
      hint="5-Minuten-Lücken trennen Sessions."
    >
      <div className="overflow-x-auto rounded-xl border border-hair bg-white">
        <table className="w-full text-[12.5px]">
          <thead className="bg-ink-50 text-[10.5px] uppercase tracking-[0.12em] text-ink-500">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Start</th>
              <th className="px-3 py-2 text-left font-medium">Ende</th>
              <th className="px-3 py-2 text-right font-medium">Dauer</th>
              <th className="px-3 py-2 text-right font-medium">Events</th>
              <th className="px-3 py-2 text-right font-medium">Aktionen</th>
              <th className="px-3 py-2 text-left font-medium">Modi</th>
              <th className="px-3 py-2 text-left font-medium">IPs</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hair">
            {sessions.map((s, idx) => (
              <tr key={`${s.start}|${idx}`}>
                <td className="px-3 py-2 text-ink-700">{fmtDateTime(s.start)}</td>
                <td className="px-3 py-2 text-ink-700">{fmtDateTime(s.end)}</td>
                <td className="px-3 py-2 text-right">{fmtDuration(s.durationSec)}</td>
                <td className="px-3 py-2 text-right">{fmtNumber(s.events)}</td>
                <td className="px-3 py-2 text-right">{fmtNumber(s.actions)}</td>
                <td className="px-3 py-2 truncate text-ink-600" title={s.modes.join(", ")}>
                  {s.modes.join(", ") || "–"}
                </td>
                <td className="px-3 py-2 truncate font-mono text-ink-600" title={s.ips.join(", ")}>
                  {s.ips.join(", ") || "–"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
