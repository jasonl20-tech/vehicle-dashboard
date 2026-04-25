import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Battery,
  Car,
  Fuel,
  Gauge,
  type LucideIcon,
} from "lucide-react";
import PageHeader from "../components/ui/PageHeader";

type Kpi = {
  label: string;
  value: string;
  unit?: string;
  delta: string;
  positive: boolean;
  icon: LucideIcon;
};

const KPIS: Kpi[] = [
  {
    label: "Aktive Fahrzeuge",
    value: "128",
    unit: "/ 142",
    delta: "+3 ggü. Vorwoche",
    positive: true,
    icon: Car,
  },
  {
    label: "Ø Auslastung",
    value: "76,2",
    unit: "%",
    delta: "+1,4 % MoM",
    positive: true,
    icon: Gauge,
  },
  {
    label: "Ø Verbrauch",
    value: "8,9",
    unit: "l/100 km",
    delta: "-0,3 l MoM",
    positive: true,
    icon: Fuel,
  },
  {
    label: "Vorfälle (30 T)",
    value: "4",
    unit: "offen",
    delta: "-1 ggü. Vormonat",
    positive: true,
    icon: AlertTriangle,
  },
  {
    label: "Ø Ladestand E-Flotte",
    value: "68",
    unit: "%",
    delta: "stabil",
    positive: true,
    icon: Battery,
  },
  {
    label: "Live-Aktivität",
    value: "42",
    unit: "Fahrten",
    delta: "12 in Bewegung",
    positive: true,
    icon: Activity,
  },
];

export default function OverviewPage() {
  return (
    <>
      <PageHeader
        eyebrow="Dashboard"
        title="Übersicht"
        description="Schnellüberblick über deine Flotte – Auslastung, Verbrauch und Ereignisse."
        primaryAction={{ label: "Tour planen" }}
      />

      <div className="grid grid-cols-1 divide-y divide-hair border-y border-hair sm:grid-cols-2 sm:divide-y-0 sm:divide-x lg:grid-cols-3">
        {KPIS.map((k, i) => (
          <KpiCell key={k.label} kpi={k} bordered={i >= 3} />
        ))}
      </div>
    </>
  );
}

function KpiCell({ kpi, bordered }: { kpi: Kpi; bordered: boolean }) {
  const Icon = kpi.icon;
  return (
    <div
      className={`px-5 py-7 sm:px-6 lg:px-8 ${
        bordered ? "lg:border-t lg:border-hair" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-400">
          {kpi.label}
        </p>
        <Icon className="h-4 w-4 text-ink-300" />
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-display text-[40px] leading-none tracking-tighter2 text-ink-900">
          {kpi.value}
        </span>
        {kpi.unit && (
          <span className="text-[13px] font-medium text-ink-400">
            {kpi.unit}
          </span>
        )}
      </div>
      <div className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-accent-mint">
        <ArrowUpRight className="h-3 w-3" />
        {kpi.delta}
      </div>
    </div>
  );
}
