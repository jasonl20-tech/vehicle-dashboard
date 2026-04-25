import {
  Activity,
  AlertTriangle,
  Battery,
  Car,
  Fuel,
  Gauge,
} from "lucide-react";
import PageHeader from "../components/ui/PageHeader";

const KPIS = [
  {
    label: "Aktive Fahrzeuge",
    value: "128 / 142",
    delta: "+3 ggü. Vorwoche",
    icon: Car,
    color: "text-brand-700 bg-brand-50",
  },
  {
    label: "Ø Auslastung",
    value: "76,2 %",
    delta: "+1,4 % MoM",
    icon: Gauge,
    color: "text-emerald-700 bg-emerald-50",
  },
  {
    label: "Ø Verbrauch",
    value: "8,9 l/100 km",
    delta: "-0,3 l MoM",
    icon: Fuel,
    color: "text-amber-700 bg-amber-50",
  },
  {
    label: "Vorfälle (30 T)",
    value: "4",
    delta: "-1 ggü. Vormonat",
    icon: AlertTriangle,
    color: "text-rose-700 bg-rose-50",
  },
  {
    label: "Ø Ladestand E-Flotte",
    value: "68 %",
    delta: "stabil",
    icon: Battery,
    color: "text-sky-700 bg-sky-50",
  },
  {
    label: "Live-Aktivität",
    value: "42 Fahrten",
    delta: "12 in Bewegung",
    icon: Activity,
    color: "text-violet-700 bg-violet-50",
  },
];

export default function OverviewPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Schnellüberblick über deine Flotte – Auslastung, Verbrauch und Ereignisse."
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {KPIS.map((k) => {
          const Icon = k.icon;
          return (
            <div
              key={k.label}
              className="rounded-2xl border border-ink-200 bg-white p-5 shadow-card"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                    {k.label}
                  </p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-ink-900">
                    {k.value}
                  </p>
                  <p className="mt-1 text-xs text-ink-500">{k.delta}</p>
                </div>
                <span
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${k.color}`}
                >
                  <Icon className="h-5 w-5" />
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
