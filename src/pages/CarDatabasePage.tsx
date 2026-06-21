import { ArrowRight, Database, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import PageHeader from "../components/ui/PageHeader";
import { fmtNumber, useApi } from "../lib/customerApi";
import {
  carDatabaseOverviewUrl,
  type CarDatabaseOverview,
} from "../lib/carDatabaseApi";
import { C, CARD, pct } from "../lib/carDatabaseUi";

const LIST_PATH = "/car-database/eintraege";

export default function CarDatabasePage() {
  const overviewApi = useApi<CarDatabaseOverview>(carDatabaseOverviewUrl());
  const ov = overviewApi.data;
  const dbEmpty = ov?.empty === true;
  const cars = ov?.kpis.cars ?? 0;

  const stageData = useMemo(() => {
    const s = ov?.stages;
    if (!s) return [];
    return [
      { name: "Kontrolliert", value: s.kontrolliert, color: C.brand },
      { name: "Ausgeschnitten", value: s.ausgeschnitten, color: C.brand },
      { name: "Skaliert", value: s.skaliert, color: C.brand },
      { name: "Fertig", value: s.aktiv, color: C.done },
    ];
  }, [ov]);

  return (
    <div>
      <PageHeader
        eyebrow="Car Database"
        title="Übersicht"
        description="Kennzahlen und Vollständigkeit des Fahrzeug-Bestands. Zur Datenbank mit allen Autos und Bildern geht es über den Button unten."
      />

      <div className="mb-4 flex items-center justify-between">
        <p className="text-[11px] text-ink-500">
          Quelle: <span className="font-mono">fahrzeugliste</span> (neues System)
        </p>
        <button
          type="button"
          onClick={() => overviewApi.reload()}
          className="inline-flex items-center gap-1.5 rounded-md border border-hair bg-paper px-2.5 py-1.5 text-[12px] text-ink-600 hover:bg-ink-50"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Aktualisieren
        </button>
      </div>

      {dbEmpty && (
        <div className="mb-5 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-[12.5px] text-amber-700">
          <Database className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Die neue Fahrzeug-Datenbank ist aktuell <strong>noch leer</strong>.
            Sobald Autos vorhanden sind, füllen sich Kennzahlen und Grafiken hier
            automatisch.
          </span>
        </div>
      )}

      {/* KPI-Karten */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Fahrzeuge" value={ov?.kpis.cars} />
        <Kpi label="Marken" value={ov?.kpis.marken} />
        <Kpi label="Farb-Varianten" value={ov?.kpis.variants} />
        <Kpi label="Bilder gesamt" value={ov?.kpis.images} />
      </div>

      {/* Vollständigkeit */}
      <h3 className="mb-2 text-[12px] font-medium uppercase tracking-[0.1em] text-ink-400">
        Vollständigkeit
      </h3>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CompletenessCard
          title="Außen-Ansichten"
          total={cars}
          items={[
            {
              label: "8/8 komplett",
              value: ov?.completeness.aussen_komplett,
              tone: "done",
            },
            {
              label: "unvollständig (<8)",
              value: ov?.completeness.aussen_unvollstaendig,
              tone: "warn",
              to: `${LIST_PATH}?status=incomplete_ext`,
            },
          ]}
        />
        <CompletenessCard
          title="Innen-Ansichten"
          total={cars}
          items={[
            {
              label: "2/2 komplett",
              value: ov?.completeness.innen_komplett,
              tone: "done",
            },
            {
              label: "teilweise (1/2)",
              value: ov?.completeness.innen_teilweise,
              tone: "warn",
              to: `${LIST_PATH}?status=incomplete_int`,
            },
            {
              label: "ohne Innen",
              value: ov?.completeness.innen_keine,
              tone: "muted",
            },
          ]}
        />
        <CompletenessCard
          title="Transparenz"
          total={cars}
          items={[
            {
              label: "mit Transparenz",
              value: ov?.completeness.mit_transparenz,
              tone: "done",
            },
            {
              label: "ohne Transparenz",
              value: ov?.completeness.ohne_transparenz,
              tone: "warn",
              to: `${LIST_PATH}?status=no_transparent`,
            },
          ]}
        />
        <CompletenessCard
          title="Schatten"
          total={cars}
          items={[
            {
              label: "mit Schatten",
              value: ov?.completeness.mit_schatten,
              tone: "done",
            },
            {
              label: "ohne Schatten",
              value: ov?.completeness.ohne_schatten,
              tone: "muted",
              to: `${LIST_PATH}?status=no_shadow`,
            },
          ]}
        />
      </div>

      {/* Grafiken */}
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <div className={CARD}>
          <h3 className="mb-1 text-[12px] font-medium uppercase tracking-[0.1em] text-ink-400">
            Workflow-Fortschritt
          </h3>
          <p className="mb-2 text-[11px] text-ink-500">
            Bilder je Stufe (von {fmtNumber(ov?.stages.gesamt ?? 0)} gesamt)
          </p>
          <div className="h-44">
            {stageData.some((d) => d.value > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stageData}
                  margin={{ top: 4, right: 8, bottom: 4, left: -16 }}
                >
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    formatter={(v: number) => [fmtNumber(v), "Bilder"]}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {stageData.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart />
            )}
          </div>
        </div>

        <div className={CARD}>
          <h3 className="mb-1 text-[12px] font-medium uppercase tracking-[0.1em] text-ink-400">
            Autos ohne diese Außen-Ansicht
          </h3>
          <p className="mb-2 text-[11px] text-ink-500">
            Wie vielen Autos die jeweilige Außen-Ansicht fehlt
          </p>
          <div className="h-44">
            {ov && ov.missingByView.some((d) => d.fehlt > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={ov.missingByView}
                  margin={{ top: 4, right: 8, bottom: 4, left: -16 }}
                >
                  <XAxis
                    dataKey="view"
                    tick={{ fontSize: 9, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    angle={-30}
                    textAnchor="end"
                    height={48}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    formatter={(v: number) => [fmtNumber(v), "Autos ohne"]}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Bar dataKey="fehlt" fill={C.hold} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart />
            )}
          </div>
        </div>
      </div>

      {/* Top-Marken */}
      {ov && ov.topBrands.length > 0 && (
        <div className={`${CARD} mb-6`}>
          <h3 className="mb-2 text-[12px] font-medium uppercase tracking-[0.1em] text-ink-400">
            Bestand nach Marke (Top 10)
          </h3>
          <div className="flex flex-wrap gap-2">
            {ov.topBrands.map((b) => (
              <Link
                key={b.marke}
                to={`${LIST_PATH}?marke=${encodeURIComponent(b.marke)}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-hair bg-white px-2.5 py-1 text-[12px] text-ink-700 transition-colors hover:border-ink-300 hover:bg-ink-50"
                title={`${b.marke} in der Datenbank öffnen`}
              >
                <span className="font-medium">{b.marke}</span>
                <span className="text-ink-400">
                  {fmtNumber(b.vehicles)} Fz · {fmtNumber(b.images)} Bilder
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* CTA zur Datenbank */}
      <Link
        to={LIST_PATH}
        className="flex items-center justify-between gap-3 rounded-xl border border-brand-500/30 bg-brand-500/5 px-5 py-4 transition-colors hover:bg-brand-500/10"
      >
        <div>
          <div className="text-[14px] font-semibold text-ink-900">
            Zur Fahrzeug-Datenbank
          </div>
          <div className="text-[12px] text-ink-500">
            Alle {fmtNumber(cars)} Fahrzeuge durchsuchen, filtern und Bilder
            ansehen
          </div>
        </div>
        <ArrowRight className="h-5 w-5 shrink-0 text-brand-600" />
      </Link>

      {overviewApi.error && (
        <p className="mt-3 text-[12px] text-accent-rose">{overviewApi.error}</p>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | undefined;
  tone?: "done" | "warn";
}) {
  const toneClass =
    tone === "done"
      ? "text-emerald-600"
      : tone === "warn"
        ? "text-amber-600"
        : "text-ink-900";
  return (
    <div className={CARD}>
      <div className="text-[10.5px] font-medium uppercase tracking-wider text-ink-400">
        {label}
      </div>
      <div className={`mt-1 text-[22px] font-semibold tabular-nums ${toneClass}`}>
        {value === undefined ? "—" : fmtNumber(value)}
      </div>
    </div>
  );
}

type CompItem = {
  label: string;
  value: number | undefined;
  tone: "done" | "warn" | "muted";
  to?: string;
};

function CompletenessCard({
  title,
  total,
  items,
}: {
  title: string;
  total: number;
  items: CompItem[];
}) {
  return (
    <div className={CARD}>
      <h3 className="mb-2 text-[12px] font-medium text-ink-700">{title}</h3>
      <div className="space-y-2">
        {items.map((it) => (
          <CompRow key={it.label} item={it} total={total} />
        ))}
      </div>
    </div>
  );
}

function CompRow({ item, total }: { item: CompItem; total: number }) {
  const v = item.value ?? 0;
  const barCls =
    item.tone === "done"
      ? "bg-emerald-500"
      : item.tone === "warn"
        ? "bg-amber-500"
        : "bg-ink-300";
  const valCls =
    item.tone === "done"
      ? "text-emerald-700"
      : item.tone === "warn"
        ? "text-amber-700"
        : "text-ink-500";
  const inner = (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[12px] text-ink-600">{item.label}</span>
        <span className={`text-[12.5px] font-semibold tabular-nums ${valCls}`}>
          {fmtNumber(v)}
          <span className="ml-1 text-[10px] font-normal text-ink-400">
            {pct(v, total)}%
          </span>
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-100">
        <div
          className={`h-full rounded-full ${barCls}`}
          style={{ width: `${Math.min(100, pct(v, total))}%` }}
        />
      </div>
    </>
  );
  if (item.to) {
    return (
      <Link
        to={item.to}
        className="block rounded-md p-1 transition-colors hover:bg-ink-50"
        title="In der Datenbank anzeigen"
      >
        {inner}
      </Link>
    );
  }
  return <div className="p-1">{inner}</div>;
}

function EmptyChart() {
  return (
    <div className="grid h-full place-items-center text-[11px] text-ink-300">
      keine Daten
    </div>
  );
}
