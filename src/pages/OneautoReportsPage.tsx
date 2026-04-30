import { AlertCircle, Download, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
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
  type OneautoReportsResponse,
  fmtCurrency,
  fmtMonthLong,
  fmtNumber,
  reportsUrl,
  useApi,
} from "../lib/customerApi";

const MONTH_OPTIONS: Array<{ id: number; label: string }> = [
  { id: 6, label: "6 Monate" },
  { id: 12, label: "12 Monate" },
  { id: 24, label: "24 Monate" },
  { id: 36, label: "36 Monate" },
];

export default function OneautoReportsPage() {
  const [months, setMonths] = useState<number>(12);
  const url = useMemo(() => reportsUrl(months), [months]);
  const { data, error, loading, reload } = useApi<OneautoReportsResponse>(url);

  return (
    <>
      <Header
        months={months}
        onMonths={setMonths}
        loading={loading}
        onReload={reload}
        onExport={data ? () => exportCsv(data) : undefined}
      />

      {error && (
        <div className="mb-6 flex items-start gap-2.5 border-l-2 border-accent-rose bg-accent-rose/[0.06] px-3 py-2 text-[12.5px]">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-rose" />
          <span className="text-ink-700">{error}</span>
        </div>
      )}

      <Section title="Entwicklung Monat für Monat" meta="Chronologisch, älteste Monate links">
        <MonthlyTrend data={data} loading={loading} />
      </Section>

      <Totals data={data} loading={loading} />

      <Section title="Monatsabrechnung">
        <ReportTable data={data} loading={loading} />
      </Section>

      <Footnote pricePerView={data?.pricePerViewGbp ?? 0.02} />
    </>
  );
}

// ---------- Header ----------

function Header({
  months,
  onMonths,
  loading,
  onReload,
  onExport,
}: {
  months: number;
  onMonths: (m: number) => void;
  loading: boolean;
  onReload: () => void;
  onExport?: () => void;
}) {
  return (
    <header
      aria-label="Oneauto Reports"
      className="mb-6 border-b border-hair pb-4 animate-fade-down"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="max-w-2xl text-[13px] leading-relaxed text-ink-500">
          Monatliche Abrechnung der Bild-Views aller Oneauto-API-Keys
          (Kontoübergreifend: z. B. e6dd0c88…ac31 und e6dd0c88…9c76b). Pro
          View berechnen wir{" "}
          <span className="font-mono text-[12px] text-ink-700">£0,02</span> und
          rechnen mit dem ECB-Wechselkurs zum Monatsende in Euro um.
        </p>
        <div className="flex items-center gap-2">
          {onExport && (
            <button
              type="button"
              onClick={onExport}
              title="Als CSV exportieren"
              className="press inline-flex items-center gap-1.5 rounded-md border border-hair bg-white px-2.5 py-1.5 text-[11.5px] font-medium text-ink-600 transition hover:border-ink-300 hover:text-ink-900"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </button>
          )}
          <button
            type="button"
            onClick={onReload}
            title="Aktualisieren"
            className="press inline-flex h-8 w-8 items-center justify-center rounded-md border border-hair bg-white text-ink-500 transition-colors hover:border-ink-300 hover:text-ink-800"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>
      <div className="mt-5 inline-flex items-center gap-1 rounded-md border border-hair bg-paper p-0.5 text-[12px]">
        {MONTH_OPTIONS.map((o) => {
          const active = o.id === months;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onMonths(o.id)}
              className={`press rounded-[5px] px-2.5 py-1.5 transition-colors ${
                active
                  ? "bg-white text-ink-900 shadow-[0_1px_0_rgba(15,23,42,0.06)]"
                  : "text-ink-500 hover:text-ink-800"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </header>
  );
}

// ---------- Totals ----------

function Totals({
  data,
  loading,
}: {
  data: OneautoReportsResponse | null;
  loading: boolean;
}) {
  const t = data?.totals ?? { views: 0, gbp: 0, eur: null };
  const viewsTotal = safeNum(t.views);
  const gbpTotal = safeNum(t.gbp);
  return (
    <div className="stagger-children mb-12 grid grid-cols-1 divide-y divide-hair border-y border-hair sm:grid-cols-3 sm:divide-x sm:divide-y-0">
      <Tile
        label="Bild-Views gesamt"
        value={loading ? "…" : fmtNumber(viewsTotal)}
        sub={loading ? "" : `letzte ${data?.months.length ?? 0} Monate`}
      />
      <Tile
        label="Brutto (GBP)"
        value={loading ? "…" : fmtCurrency(gbpTotal, "GBP")}
        sub={loading ? "" : `${data?.pricePerViewGbp ?? 0.02} £ pro View`}
      />
      <Tile
        label="Brutto (EUR)"
        value={loading ? "…" : fmtCurrency(t.eur, "EUR")}
        sub={
          loading
            ? ""
            : t.eur == null
              ? "FX-Kurs unvollständig"
              : "umgerechnet via ECB"
        }
        tone={loading ? "neutral" : t.eur == null ? "warn" : "ok"}
      />
    </div>
  );
}

function safeNum(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function Tile({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "neutral" | "ok" | "warn";
}) {
  const subColor =
    tone === "ok"
      ? "text-accent-mint"
      : tone === "warn"
        ? "text-accent-amber"
        : "text-ink-400";
  return (
    <div className="animate-fade-up min-w-0 overflow-hidden px-5 py-6 first:pl-0 sm:px-6 lg:px-8 lg:first:pl-0">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-400">
        {label}
      </p>
      <p className="mt-3 min-w-0 break-words font-display text-[40px] leading-none tracking-tighter2 text-ink-900">
        {value}
      </p>
      {sub && (
        <p className={`mt-3 text-[12px] font-medium ${subColor}`}>{sub}</p>
      )}
    </div>
  );
}

// ---------- Section ----------

function Section({
  title,
  children,
  meta,
}: {
  title: string;
  children: React.ReactNode;
  meta?: string;
}) {
  return (
    <section className="animate-fade-up mb-12 border-t border-hair pt-10 first:border-t-0 first:pt-0">
      <div className="mb-5">
        <h2 className="font-display text-[20px] tracking-tightish text-ink-900">
          {title}
        </h2>
        {meta && (
          <p className="mt-1.5 text-[12.5px] text-ink-500">{meta}</p>
        )}
      </div>
      {children}
    </section>
  );
}

// ---------- Entwicklungs-Chart ----------

function monthShortUtc(iso: string): string {
  const d = new Date(
    iso.length === 7
      ? `${iso}-01T00:00:00.000Z`
      : /^\d{4}-\d{2}-\d{2}$/.test(iso)
        ? `${iso}T00:00:00.000Z`
        : iso,
  );
  if (Number.isNaN(d.getTime())) return iso.slice(0, 7);
  return new Intl.DateTimeFormat("de-DE", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(d);
}

function MonthlyTrend({
  data,
  loading,
}: {
  data: OneautoReportsResponse | null;
  loading: boolean;
}) {
  const rows = useMemo(() => {
    if (!data?.months?.length) return [];
    return [...data.months]
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((m) => ({
        key: m.month,
        label: monthShortUtc(m.month),
        views: safeNum(m.views),
        eur: m.eur != null && Number.isFinite(m.eur) ? m.eur : 0,
        gbp: safeNum(m.gbp),
      }));
  }, [data]);

  if (loading && !data) {
    return <div className="h-[300px] animate-pulse rounded-md bg-ink-100/50" />;
  }
  if (!rows.length) {
    return (
      <div className="rounded-md border border-dashed border-hair px-4 py-12 text-center text-[13px] text-ink-500">
        Keine Monatsdaten für die Statistik.
      </div>
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
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 11, fill: "var(--color-ink-500, #64748b)" }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            width={48}
            label={{
              value: "Views",
              angle: -90,
              position: "insideLeft",
              style: { fontSize: 10, fill: "#94a3b8" },
            }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 11, fill: "var(--color-ink-500, #64748b)" }}
            tickLine={false}
            axisLine={false}
            width={52}
            label={{
              value: "€",
              angle: 90,
              position: "insideRight",
              style: { fontSize: 10, fill: "#94a3b8" },
            }}
          />
          <Tooltip
            content={({ active, payload, label: lbl }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as {
                views: number;
                eur: number;
                gbp: number;
              };
              return (
                <div className="rounded-md border border-hair bg-white px-3 py-2.5 text-[12px] shadow-lg">
                  <p className="mb-1.5 font-medium text-ink-800">{String(lbl)}</p>
                  <p className="text-ink-600">
                    Bild-Views:{" "}
                    <span className="font-medium text-ink-900">
                      {fmtNumber(p.views)}
                    </span>
                  </p>
                  <p className="text-ink-600">
                    Brutto:{" "}
                    <span className="font-medium text-ink-900">
                      {fmtCurrency(p.gbp, "GBP")} / {fmtCurrency(
                        p.eur > 0 ? p.eur : null,
                        "EUR",
                      )}
                    </span>
                  </p>
                </div>
              );
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            formatter={(value) => String(value)}
          />
          <Bar
            yAxisId="left"
            dataKey="views"
            name="Bild-Views"
            fill="#5a3df0"
            radius={[4, 4, 0, 0]}
            maxBarSize={48}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="eur"
            name="Brutto (EUR)"
            stroke="#3ecf8e"
            strokeWidth={2}
            dot={{ r: 2.5, fill: "#3ecf8e" }}
            activeDot={{ r: 4 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------- Tabelle ----------

function ReportTable({
  data,
  loading,
}: {
  data: OneautoReportsResponse | null;
  loading: boolean;
}) {
  if (loading && !data) {
    return (
      <div className="border-y border-hair px-4 py-12 text-center text-[13px] text-ink-500">
        Lade Monatsabrechnungen …
      </div>
    );
  }
  if (!data || data.months.length === 0) {
    return (
      <div className="border-y border-hair px-4 py-12 text-center text-[13px] text-ink-500">
        Keine Daten.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border-y border-hair">
      <table className="min-w-full text-[13px]">
        <thead className="bg-paper text-ink-500">
          <tr>
            <Th>Monat</Th>
            <Th align="right">Anfragen</Th>
            <Th align="right">Bild-Views</Th>
            <Th align="right">Fehler</Th>
            <Th align="right">Brutto (GBP)</Th>
            <Th align="right">FX-Kurs</Th>
            <Th align="right">Brutto (EUR)</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hair">
          {data.months.map((m) => {
            const fxBadge = m.fx.source === "fallback" ? "warn" : "ok";
            return (
              <tr key={m.month} className="hover:bg-ink-50/40">
                <Td>
                  <div className="flex flex-col">
                    <span className="text-ink-900">
                      {fmtMonthLong(m.month)}
                    </span>
                    <span className="text-[11.5px] text-ink-400">
                      {m.month.slice(0, 7)}
                    </span>
                  </div>
                </Td>
                <Td align="right" className="text-ink-700">
                  {fmtNumber(m.requests)}
                </Td>
                <Td
                  align="right"
                  className="font-medium tabular-nums text-ink-900"
                >
                  {fmtNumber(m.views)}
                </Td>
                <Td
                  align="right"
                  className={
                    m.viewsErr > 0 ? "text-accent-rose" : "text-ink-400"
                  }
                >
                  {fmtNumber(m.viewsErr)}
                </Td>
                <Td align="right" className="tabular-nums text-ink-800">
                  {fmtCurrency(m.gbp, "GBP")}
                </Td>
                <Td align="right">
                  {m.fx.rate != null ? (
                    <div className="flex flex-col items-end">
                      <span className="tabular-nums text-ink-700">
                        {m.fx.rate.toFixed(4)}
                      </span>
                      <span
                        className={`text-[11px] ${
                          fxBadge === "warn"
                            ? "text-accent-amber"
                            : "text-ink-400"
                        }`}
                      >
                        {m.fx.source === "frankfurter"
                          ? `ECB · ${m.fx.date}`
                          : "Fallback"}
                      </span>
                    </div>
                  ) : (
                    <span className="text-ink-400">–</span>
                  )}
                </Td>
                <Td
                  align="right"
                  className="font-medium tabular-nums text-brand-700"
                >
                  {fmtCurrency(m.eur, "EUR")}
                </Td>
                <Td>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-medium ${
                      m.closed
                        ? "bg-ink-100 text-ink-600"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {m.closed ? "Abgeschlossen" : "Laufend"}
                  </span>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Th({
  children,
  align = "left",
}: {
  children?: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      scope="col"
      className={`whitespace-nowrap px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.12em] ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
  className = "",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <td
      className={`whitespace-nowrap px-4 py-3 ${
        align === "right" ? "text-right" : "text-left"
      } ${className}`}
    >
      {children}
    </td>
  );
}

function Footnote({ pricePerView }: { pricePerView: number }) {
  return (
    <p className="mt-2 max-w-3xl text-[11.5px] leading-relaxed text-ink-400">
      Berechnungsgrundlage: jede Bild-View (
      <span className="font-mono">blob5</span> ist ein View-Name, also kein{" "}
      <span className="font-mono">list_*</span> oder{" "}
      <span className="font-mono">check_views</span>) wird mit{" "}
      <span className="font-mono">£{pricePerView}</span> berechnet. Wechselkurs
      kommt vom Europäischen Zentralbank-Datensatz von{" "}
      <a
        href="https://frankfurter.app"
        target="_blank"
        rel="noreferrer"
        className="underline decoration-ink-300 underline-offset-2 hover:decoration-ink-700"
      >
        frankfurter.app
      </a>
      . Für laufende Monate wird der heutige Kurs verwendet, für
      abgeschlossene Monate der letzte Werktag des jeweiligen Monats.
    </p>
  );
}

// ---------- CSV-Export ----------

function exportCsv(data: OneautoReportsResponse) {
  const header = [
    "Monat",
    "Anfragen",
    "Bild-Views",
    "Bild-Views OK",
    "Bild-Views Fehler",
    "Brutto GBP",
    "FX GBP→EUR",
    "FX-Datum",
    "FX-Quelle",
    "Brutto EUR",
    "Status",
  ];
  const rows = data.months.map((m) => [
    m.month.slice(0, 7),
    m.requests,
    m.views,
    m.viewsOk,
    m.viewsErr,
    m.gbp.toFixed(2),
    m.fx.rate != null ? m.fx.rate.toFixed(4) : "",
    m.fx.date,
    m.fx.source,
    m.eur != null ? m.eur.toFixed(2) : "",
    m.closed ? "abgeschlossen" : "laufend",
  ]);

  const csv = [header, ...rows]
    .map((r) =>
      r
        .map((cell) => {
          const s = String(cell);
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(","),
    )
    .join("\n");

  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `oneauto-reports-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
