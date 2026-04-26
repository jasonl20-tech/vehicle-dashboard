import { ExternalLink, RefreshCw } from "lucide-react";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import PageHeader from "../components/ui/PageHeader";
import { controllingApiUrl, type ControllingResponse } from "../lib/controllingApi";
import {
  type OverviewRow,
  fmtCurrency,
  fmtNumber,
  makeApiUrls,
  rangeCurrentMonthUtc,
  rangeFromPreset,
  rangeTodayUtc,
  reportsUrl,
  useApi,
  type OneautoReportsResponse,
} from "../lib/customerApi";
import {
  OVERVIEW_STATS_URL,
  type OverviewDwm,
  type OverviewStatsResponse,
} from "../lib/overviewStatsApi";

// ---------- Farben (dezent, ohne Box) ----------

const C = {
  a: "hsl(214 45% 42%)",
  b: "hsl(170 32% 40%)",
  c: "hsl(32 40% 48%)",
  d: "hsl(280 20% 48%)",
  pie1: "hsl(214 40% 48%)",
  pie2: "hsl(32 45% 52%)",
};

// ---------- Format ----------

function fmtHours(h: number | null | undefined): string {
  if (h == null || !Number.isFinite(h)) return "–";
  if (h <= 0) return "0";
  if (h < 1 / 60) return `${Math.round(h * 3600)} s`;
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 24) return `${h.toFixed(1)} h`;
  if (h < 24 * 14) return `${(h / 24).toFixed(1)} Tage`;
  return `${(h / (24 * 7)).toFixed(1)} Wo.`;
}

function dwmRows(d: OverviewDwm) {
  return [
    { label: "Heute", n: d.day },
    { label: "7 Tage", n: d.week },
    { label: "Monat", n: d.month },
  ];
}

// ---------- Sektion (flach) ----------

function Section({
  title,
  to,
  hint,
  children,
  tall,
}: {
  title: string;
  to: string;
  hint?: string;
  children: ReactNode;
  tall?: boolean;
}) {
  return (
    <section className="border-b border-hair/90 py-8 last:mb-0 last:border-0 sm:py-9">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[13px] font-semibold tracking-tight text-ink-800">
          {title}
        </h2>
        <Link
          to={to}
          className="inline-flex items-center gap-0.5 text-[11.5px] text-ink-500 transition-colors hover:text-ink-800"
        >
          Details
          <ExternalLink className="h-3 w-3 opacity-60" aria-hidden />
        </Link>
      </div>
      {hint && <p className="mb-3 max-w-2xl text-[11.5px] leading-relaxed text-ink-500">{hint}</p>}
      <div className={tall ? "h-[200px] w-full min-w-0" : "h-[180px] w-full min-w-0"}>
        {children}
      </div>
    </section>
  );
}

// ---------- Mini-Charts ----------

function DwmBar({
  d,
  color,
}: {
  d: OverviewDwm;
  color: string;
}) {
  const data = useMemo(() => dwmRows(d), [d.day, d.week, d.month]);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="hsl(220 10% 88%)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: "hsl(220 8% 45%)" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: "hsl(220 8% 45%)" }}
          width={40}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip
          cursor={{ fill: "hsl(220 20% 96% / 0.5)" }}
          contentStyle={{
            fontSize: 12,
            border: "none",
            borderRadius: 4,
            boxShadow: "0 1px 8px hsl(0 0% 0% / 0.08)",
          }}
          formatter={(v: number) => [fmtNumber(v), "Wert"]}
        />
        <Bar dataKey="n" name="Anzahl" maxBarSize={48} fill={color} radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function RequestsBar({ day, week, month }: { day: number; week: number; month: number }) {
  const data = useMemo(
    () => [
      { label: "Heute", n: day },
      { label: "7 Tage", n: week },
      { label: "Monat", n: month },
    ],
    [day, week, month],
  );
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="hsl(220 10% 88%)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: "hsl(220 8% 45%)" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: "hsl(220 8% 45%)" }}
          width={44}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: "hsl(220 20% 96% / 0.5)" }}
          contentStyle={{
            fontSize: 12,
            border: "none",
            borderRadius: 4,
            boxShadow: "0 1px 8px hsl(0 0% 0% / 0.08)",
          }}
          formatter={(v: number) => [fmtNumber(v), "Requests"]}
        />
        <Bar dataKey="n" name="Requests" maxBarSize={48} fill={C.a} radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function OneautoHistoryBars({ data }: { data: OneautoReportsResponse | null }) {
  const months = data?.months ?? [];
  const chart = useMemo(() => {
    const slice = months.slice(0, 6).reverse();
    return slice.map((m) => ({
      name:
        m.month.length >= 7
          ? `${m.month.slice(5, 7)}/${m.month.slice(2, 4)}`
          : m.month,
      eur: m.eur ?? 0,
      gbp: m.gbp,
      views: m.views,
    }));
  }, [months]);
  if (chart.length === 0) return <EmptyChart label="Noch keine Monatswerte" />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chart} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="hsl(220 10% 88%)" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 9, fill: "hsl(220 8% 45%)" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: "hsl(220 8% 45%)" }}
          width={48}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: "hsl(220 20% 96% / 0.5)" }}
          contentStyle={{
            fontSize: 12,
            border: "none",
            borderRadius: 4,
            boxShadow: "0 1px 8px hsl(0 0% 0% / 0.08)",
          }}
          formatter={(v: number, name: string) => {
            if (name === "eur") return [v != null ? fmtCurrency(v, "EUR") : "–", "EUR (ca.)"];
            if (name === "gbp") return [fmtCurrency(v, "GBP"), "GBP"];
            return [fmtNumber(v), name];
          }}
        />
        <Bar dataKey="eur" name="eur" maxBarSize={32} fill={C.b} radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function KeysSplitPie({ productive, test }: { productive: number; test: number }) {
  const data = useMemo(
    () => [
      { name: "Produktiv", value: Math.max(0, productive) },
      { name: "Test", value: Math.max(0, test) },
    ],
    [productive, test],
  );
  if (data.every((d) => d.value === 0)) {
    return <EmptyChart label="Keine aktiven Keys" />;
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius="42%"
          outerRadius="70%"
          paddingAngle={2}
          strokeWidth={0}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={i === 0 ? C.pie1 : C.pie2} />
          ))}
        </Pie>
        <Tooltip
          formatter={(v: number, n: string) => [fmtNumber(v), n]}
          contentStyle={{
            fontSize: 12,
            border: "none",
            borderRadius: 4,
            boxShadow: "0 1px 8px hsl(0 0% 0% / 0.08)",
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

function OpenJobsBar({ total }: { total: number }) {
  const data = useMemo(
    () => [{ label: "Offen", n: total }],
    [total],
  );
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="hsl(220 10% 88%)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis hide />
        <Tooltip
          cursor={false}
          contentStyle={{ fontSize: 12, border: "none" }}
          formatter={(v: number) => [fmtNumber(v), "Jobs"]}
        />
        <Bar dataKey="n" maxBarSize={64} fill={C.c} radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function EtaCompareBar({ noNew, withFlow }: { noNew: number | null; withFlow: number | null }) {
  const h1 = noNew && Number.isFinite(noNew) ? Math.max(0, noNew) : 0;
  const h2 = withFlow && Number.isFinite(withFlow) ? Math.max(0, withFlow) : 0;
  const data = useMemo(
    () => [
      { name: "Ohne neuen Zufluss", h: h1 },
      { name: "Bei lauf. Zufluss", h: h2 },
    ],
    [h1, h2],
  );
  if (h1 <= 0 && h2 <= 0) {
    return <EmptyChart label="Keine Schätzwerte" />;
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        layout="vertical"
        data={data}
        margin={{ top: 4, right: 20, left: 4, bottom: 0 }}
      >
        <CartesianGrid stroke="hsl(220 10% 88%)" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 10 }} domain={[0, "auto"]} allowDecimals tickFormatter={(v) => `${v}h`} />
        <YAxis
          type="category"
          dataKey="name"
          width={120}
          tick={{ fontSize: 9.5, fill: "hsl(220 8% 40%)" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: "hsl(220 20% 96% / 0.4)" }}
          contentStyle={{ fontSize: 12, border: "none" }}
          formatter={(v: number) => [fmtHours(v), "ETA"]}
        />
        <Bar dataKey="h" maxBarSize={16} fill={C.d} radius={[0, 2, 2, 0]} />
      </BarChart>
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

// ---------- Seite ----------

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
  const anyError =
    stat.error ||
    reqD.error ||
    reqW.error ||
    reqM.error ||
    oneauto.error ||
    ctrl.error ||
    jobs.error;

  const rDay = reqD.error ? 0 : (reqD.data?.row?.requests ?? 0);
  const rWeek = reqW.error ? 0 : (reqW.data?.row?.requests ?? 0);
  const rMonth = reqM.error ? 0 : (reqM.data?.row?.requests ?? 0);
  const requestsReady = !reqD.error && !reqW.error && !reqM.error && !reqD.loading && !reqW.loading && !reqM.loading;

  return (
    <>
      <div className="mb-2 flex flex-col gap-3 sm:mb-4 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader
          eyebrow="Dashboard"
          title="Übersicht"
          description="Aktuelle Kennzahlen als Verläufe und Verteilungen – Anfragen, API, Oneauto, Keys, Controlling."
        />
        <button
          type="button"
          onClick={reloadAll}
          disabled={anyLoading}
          className="inline-flex items-center gap-1.5 self-start text-[12.5px] text-ink-600 transition-opacity hover:text-ink-900 disabled:opacity-40"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${anyLoading ? "animate-spin" : ""}`}
            aria-hidden
          />
          Aktualisieren
        </button>
      </div>

      {anyError && (
        <p className="mb-6 text-[12.5px] text-ink-600" role="status">
          {[
            stat.error,
            reqD.error,
            reqW.error,
            reqM.error,
            oneauto.error,
            ctrl.error,
            jobs.error,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}

      <div className="max-w-5xl">
        {stat.data ? (
          <>
            <div className="grid gap-0 sm:grid-cols-1 lg:grid-cols-3 lg:gap-8">
              <Section
                title="Anfragen (Website)"
                to="/kunden/anfragen"
                hint="Heute/7 Tage/Monat (UTC) – identische Definition wie in der API."
              >
                <DwmBar d={stat.data.website.submissions} color={C.a} />
              </Section>
              <Section
                title="Test-Anfragen"
                to="/kunden/test-anfragen"
                hint="Testformular, gleiche Zeiträume wie oben."
              >
                <DwmBar d={stat.data.website.trialSubmissions} color={C.b} />
              </Section>
              <Section
                title="Newsletter"
                to="/kunden/newsletter"
                hint="Anmeldungen, gleiche Zeiträume."
              >
                <DwmBar d={stat.data.website.newsletter} color={C.c} />
              </Section>
            </div>
          </>
        ) : stat.error ? (
          <p className="py-4 text-[12.5px] text-accent-rose">Website-Statistiken: {stat.error}</p>
        ) : (
          <p className="py-4 text-[12.5px] text-ink-500">Lade Anfrage-Daten …</p>
        )}

        <Section
          title="Oneauto-Abrechnung (letzte Monate, EUR ca.)"
          to="/analytics/oneauto-reports"
          hint="Aktueller Monat inklusive; Vorschau solange Monat offen. Balken: geschätzter EUR-Betrag pro Monat."
          tall
        >
          {oneauto.error ? (
            <p className="pt-8 text-[12.5px] text-accent-rose">{oneauto.error}</p>
          ) : oneauto.loading && !oneauto.data ? (
            <p className="pt-8 text-[12.5px] text-ink-500">Laden …</p>
          ) : (
            <OneautoHistoryBars data={oneauto.data} />
          )}
        </Section>

        <Section
          title="Kunden-API: Requests (alle produktiven Keys)"
          to="/analytics/kunden-api"
          hint="Zeitfenster: heute = Mitternacht UTC ab jetzt, 7 Tage rollierend, Monat = Kalendermonat."
        >
          {reqD.error || reqW.error || reqM.error ? (
            <p className="pt-8 text-[12.5px] text-accent-rose">API-Analytics: Fehler beim Laden</p>
          ) : !requestsReady ? (
            <p className="pt-8 text-[12.5px] text-ink-500">Laden …</p>
          ) : (
            <RequestsBar
              day={rDay}
              week={rWeek}
              month={rMonth}
            />
          )}
        </Section>

        <Section
          title="Aktive Keys (Produktiv vs. Test)"
          to="/kunden/keys"
          hint="Nur unabgelaufene; Verteilung als Anteile. Kein Key-Binding: Bereich leer."
        >
          {stat.data?.activeKeys == null ? (
            <EmptyChart
              label={stat.loading ? "Laden …" : "Kein `customer_keys`-Binding"}
            />
          ) : (
            <KeysSplitPie
              productive={stat.data.activeKeys.productive}
              test={stat.data.activeKeys.test}
            />
          )}
        </Section>

        <div className="grid gap-0 sm:grid-cols-1 lg:grid-cols-2 lg:gap-12">
          <Section title="Offene Controlling-Jobs" to="/intern-analytics/jobs" hint="Status „offen“ (check = 0).">
            {jobs.error ? (
              <p className="pt-8 text-[12.5px] text-accent-rose">{jobs.error}</p>
            ) : (
              <OpenJobsBar total={jobs.data?.total ?? 0} />
            )}
          </Section>

          <Section
            title="Voraussichtliche Bearbeitungszeit (Stunden, global)"
            to="/intern-analytics/controlling"
            hint="7 Tage Rückblick, Session-Gap 30 min, nur Zeilen mit blob4."
          >
            {ctrl.error ? (
              <p className="pt-8 text-[12.5px] text-accent-rose">{ctrl.error}</p>
            ) : ctrl.data ? (
              <EtaCompareBar
                noNew={ctrl.data.global.etaIfNoNewHours}
                withFlow={ctrl.data.global.etaIfKeepsAddingHours}
              />
            ) : (
              <p className="pt-8 text-[12.5px] text-ink-500">Laden …</p>
            )}
          </Section>
        </div>
      </div>
    </>
  );
}
