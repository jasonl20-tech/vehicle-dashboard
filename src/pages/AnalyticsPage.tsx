import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import SparkBars from "../components/charts/SparkBars";
import UtilizationChart from "../components/charts/UtilizationChart";
import VehicleTypeChart from "../components/charts/VehicleTypeChart";
import VehiclePerformanceTable from "../components/tables/VehiclePerformanceTable";
import PageHeader from "../components/ui/PageHeader";

const sparkA = [
  20, 35, 28, 60, 45, 32, 80, 55, 70, 48, 62, 28, 90, 60, 38, 72, 84, 50, 30,
  64, 26, 48, 70,
].map((v) => ({ v }));

const sparkB = [
  18, 42, 30, 24, 55, 70, 36, 88, 50, 32, 64, 92, 28, 70, 44, 30, 80, 56, 38,
  60, 48, 72, 24,
].map((v) => ({ v }));

const sparkC = [
  60, 55, 65, 58, 70, 62, 68, 72, 75, 70, 78, 80, 76, 82, 79, 85, 88, 84, 90,
  86, 82, 88, 92,
].map((v) => ({ v }));

const sparkD = [
  92, 88, 90, 84, 80, 82, 78, 75, 70, 72, 68, 64, 60, 58, 62, 55, 52, 48, 46,
  42, 44, 40, 38,
].map((v) => ({ v }));

export default function AnalyticsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Analytics"
        title="Fahrzeug-Analytics"
        description="Auslastung, Verfügbarkeit und Performance deiner gesamten Flotte – live, gefiltert und vergleichbar."
        primaryAction={{ label: "Fahrzeug hinzufügen" }}
      />

      <KpiRow />

      <Section
        title="Auslastung & Leerlauf"
        meta="Letzte 12 Monate · Aggregiert"
        legend={[
          { color: "#5a3df0", label: "Auslastung" },
          { color: "#b3a6ff", label: "Leerlauf" },
        ]}
      >
        <UtilizationChart />
      </Section>

      <Section
        title="Performance nach Fahrzeugtyp"
        meta="Aktive vs. verfügbare Einheiten"
        legend={[
          { color: "#5a3df0", label: "Aktiv" },
          { color: "#d2caff", label: "Verfügbar" },
        ]}
      >
        <VehicleTypeChart />
      </Section>

      <Section
        title="Alle Fahrzeug-Performance"
        meta="Sortier-, such- und exportierbar"
      >
        <VehiclePerformanceTable />
      </Section>
    </>
  );
}

function KpiRow() {
  return (
    <div className="mb-12 grid grid-cols-1 divide-y divide-hair border-y border-hair sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
      <Kpi
        label="Aktive Fahrzeuge"
        value="128"
        unit="/ 142"
        delta="+4,2 %"
        positive
        spark={<SparkBars data={sparkA} color="#d2caff" />}
      />
      <Kpi
        label="Geplante Touren"
        value="96"
        unit="diese Woche"
        delta="-1,1 %"
        spark={<SparkBars data={sparkB} color="#d2caff" />}
      />
      <Kpi
        label="Ø Verfügbarkeit"
        value="97,4"
        unit="%"
        delta="+0,8 pp"
        positive
        spark={<SparkBars data={sparkC} color="#cdeede" />}
      />
      <Kpi
        label="Vorfälle (30 T)"
        value="4"
        unit="offen"
        delta="-1 ggü. Vormonat"
        positive
        spark={<SparkBars data={sparkD} color="#ffd1de" />}
      />
    </div>
  );
}

function Kpi({
  label,
  value,
  unit,
  delta,
  positive = false,
  spark,
}: {
  label: string;
  value: string;
  unit?: string;
  delta: string;
  positive?: boolean;
  spark: React.ReactNode;
}) {
  return (
    <div className="px-5 py-6 first:pl-0 sm:px-6 lg:px-8 lg:first:pl-0">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-400">
        {label}
      </p>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-display text-[40px] leading-none tracking-tighter2 text-ink-900">
          {value}
        </span>
        {unit && (
          <span className="text-[13px] font-medium text-ink-400">{unit}</span>
        )}
      </div>
      <div className="mt-3 flex items-end justify-between gap-4">
        <span
          className={`inline-flex items-center gap-1 text-[12px] font-medium ${
            positive ? "text-accent-mint" : "text-accent-rose"
          }`}
        >
          {positive ? (
            <ArrowUpRight className="h-3 w-3" />
          ) : (
            <ArrowDownRight className="h-3 w-3" />
          )}
          {delta}
        </span>
        <div className="w-1/2 max-w-[160px] opacity-90">{spark}</div>
      </div>
    </div>
  );
}

function Section({
  title,
  meta,
  legend,
  children,
}: {
  title: string;
  meta?: string;
  legend?: { color: string; label: string }[];
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-hair pt-10 pb-12 first-of-type:border-t-0 first-of-type:pt-0">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-[20px] tracking-tightish text-ink-900">
            {title}
          </h2>
          {meta && (
            <p className="mt-1 text-[12px] text-ink-400">{meta}</p>
          )}
        </div>
        {legend && (
          <div className="flex flex-wrap items-center gap-4 text-[11.5px] text-ink-500">
            {legend.map((it) => (
              <span key={it.label} className="inline-flex items-center gap-1.5">
                <span
                  className="h-1.5 w-3 rounded-full"
                  style={{ background: it.color }}
                />
                {it.label}
              </span>
            ))}
          </div>
        )}
      </div>
      {children}
    </section>
  );
}
