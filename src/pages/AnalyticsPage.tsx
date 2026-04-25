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

export default function AnalyticsPage() {
  return (
    <>
      <PageHeader
        title="Fahrzeug-Analytics"
        description="Auslastung, Verfügbarkeit und Performance deiner Flotte im Überblick."
      />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <KpiTile
          label="Aktive Fahrzeuge"
          value="128"
          delta="+4,2 %"
          deltaPositive
        >
          <SparkBars data={sparkA} color="#c7cdff" />
        </KpiTile>
        <KpiTile
          label="Geplante Touren"
          value="96"
          delta="-1,1 %"
          deltaPositive={false}
        >
          <SparkBars data={sparkB} color="#c7cdff" />
        </KpiTile>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ChartCard
          title="Auslastung & Leerlauf"
          legend={
            <Legend
              items={[
                { color: "#4f46e5", label: "Auslastung" },
                { color: "#a5adff", label: "Leerlauf" },
              ]}
            />
          }
        >
          <UtilizationChart />
        </ChartCard>
        <ChartCard
          title="Performance nach Fahrzeugtyp"
          legend={
            <Legend
              items={[
                { color: "#4f46e5", label: "Aktiv" },
                { color: "#c7cdff", label: "Verfügbar" },
              ]}
            />
          }
        >
          <VehicleTypeChart />
        </ChartCard>
      </div>

      <div className="mt-6">
        <VehiclePerformanceTable />
      </div>
    </>
  );
}

function KpiTile({
  label,
  value,
  delta,
  deltaPositive,
  children,
}: {
  label: string;
  value: string;
  delta: string;
  deltaPositive: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-5 shadow-card">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
            {label}
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-semibold tracking-tight text-ink-900">
              {value}
            </span>
            <span
              className={`text-xs font-medium ${
                deltaPositive ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              {delta}
            </span>
          </div>
        </div>
        <div className="w-1/2 max-w-[260px]">{children}</div>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  legend,
  children,
}: {
  title: string;
  legend?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-5 shadow-card">
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 className="text-[15px] font-semibold text-ink-900">{title}</h3>
        {legend}
      </div>
      {children}
    </div>
  );
}

function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-[11px] text-ink-500">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: it.color }}
          />
          {it.label}
        </span>
      ))}
    </div>
  );
}
