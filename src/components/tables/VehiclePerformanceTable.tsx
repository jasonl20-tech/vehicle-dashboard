import {
  ChevronDown,
  ChevronUp,
  Columns3,
  Download,
  Info,
  Search,
} from "lucide-react";
import { useMemo, useState } from "react";
import Tag from "../ui/Tag";

type Row = {
  id: string;
  name: string;
  plate: string;
  added: string;
  trips: number;
  utilization: number;
  uptime: number;
  fuelEfficiency: number;
  incidents: number;
  type: "PKW" | "Transporter" | "LKW" | "E-Fahrzeug";
};

const ROWS: Row[] = [
  {
    id: "v-001",
    name: "BMW 3er Touring",
    plate: "B-VH 1024",
    added: "01.08.2024",
    trips: 142,
    utilization: 86.4,
    uptime: 99.1,
    fuelEfficiency: 5.8,
    incidents: 0,
    type: "PKW",
  },
  {
    id: "v-002",
    name: "Mercedes Sprinter",
    plate: "M-VH 0317",
    added: "17.08.2024",
    trips: 218,
    utilization: 91.2,
    uptime: 96.3,
    fuelEfficiency: 9.4,
    incidents: 1,
    type: "Transporter",
  },
  {
    id: "v-003",
    name: "VW Crafter",
    plate: "HH-VH 4421",
    added: "12.09.2024",
    trips: 196,
    utilization: 78.0,
    uptime: 94.7,
    fuelEfficiency: 10.1,
    incidents: 2,
    type: "Transporter",
  },
  {
    id: "v-004",
    name: "Tesla Model Y",
    plate: "S-VH 8800",
    added: "03.10.2024",
    trips: 130,
    utilization: 82.5,
    uptime: 99.6,
    fuelEfficiency: 17.2,
    incidents: 0,
    type: "E-Fahrzeug",
  },
  {
    id: "v-005",
    name: "MAN TGL 12.250",
    plate: "K-VH 2210",
    added: "22.10.2024",
    trips: 84,
    utilization: 67.8,
    uptime: 92.4,
    fuelEfficiency: 22.6,
    incidents: 1,
    type: "LKW",
  },
  {
    id: "v-006",
    name: "Audi A6 Avant",
    plate: "F-VH 7711",
    added: "11.11.2024",
    trips: 158,
    utilization: 73.9,
    uptime: 98.2,
    fuelEfficiency: 6.7,
    incidents: 0,
    type: "PKW",
  },
];

type Tab = "all" | "tours";
type SortKey = keyof Row;

export default function VehiclePerformanceTable() {
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("trips");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const rows = useMemo(() => {
    const filtered = ROWS.filter((r) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.plate.toLowerCase().includes(q) ||
        r.type.toLowerCase().includes(q)
      );
    });
    return [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av;
      }
      return sortDir === "asc"
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
  }, [query, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  return (
    <section className="rounded-2xl border border-ink-200 bg-white shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
        <div className="flex items-center gap-2">
          <h3 className="text-[15px] font-semibold text-ink-900">
            Alle Fahrzeug-Performance
          </h3>
          <Info className="h-3.5 w-3.5 text-ink-400" />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-5 pb-3">
        <div className="inline-flex rounded-lg border border-ink-200 bg-ink-50 p-1">
          {(
            [
              { id: "all", label: "Fahrzeuge" },
              { id: "tours", label: "Touren" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === t.id
                  ? "bg-white text-ink-900 shadow-card"
                  : "text-ink-500 hover:text-ink-800"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Suche nach Fahrzeug, Kennzeichen…"
              className="w-64 rounded-lg border border-ink-200 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </label>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-brand-100 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-100"
          >
            <Columns3 className="h-3.5 w-3.5" />
            Spalten verwalten
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white shadow-soft hover:bg-brand-700"
          >
            <Download className="h-3.5 w-3.5" />
            Exportieren
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-ink-400">
              <Th
                label="Fahrzeug"
                sortKey="name"
                activeKey={sortKey}
                dir={sortDir}
                onClick={toggleSort}
              />
              <Th
                label="Hinzugefügt"
                sortKey="added"
                activeKey={sortKey}
                dir={sortDir}
                onClick={toggleSort}
              />
              <Th
                label="Fahrten"
                sortKey="trips"
                activeKey={sortKey}
                dir={sortDir}
                onClick={toggleSort}
                className="text-right"
              />
              <Th
                label="Auslastung"
                sortKey="utilization"
                activeKey={sortKey}
                dir={sortDir}
                onClick={toggleSort}
                className="text-right"
              />
              <Th
                label="Verfügbarkeit"
                sortKey="uptime"
                activeKey={sortKey}
                dir={sortDir}
                onClick={toggleSort}
                className="text-right"
              />
              <Th
                label="Verbrauch"
                sortKey="fuelEfficiency"
                activeKey={sortKey}
                dir={sortDir}
                onClick={toggleSort}
                className="text-right"
              />
              <Th
                label="Vorfälle"
                sortKey="incidents"
                activeKey={sortKey}
                dir={sortDir}
                onClick={toggleSort}
                className="text-right"
              />
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100 text-ink-700">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-ink-50/60">
                <td className="whitespace-nowrap px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-[11px] font-semibold text-brand-700">
                      {row.name
                        .split(" ")
                        .map((s) => s[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </span>
                    <div className="leading-tight">
                      <p className="text-[13px] font-medium text-ink-900">
                        {row.name}
                      </p>
                      <p className="text-[11px] text-ink-400">
                        {row.plate} · {row.type}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-5 py-3.5 text-[13px] text-ink-500">
                  {row.added}
                </td>
                <td className="whitespace-nowrap px-5 py-3.5 text-right text-[13px] tabular-nums">
                  {row.trips}
                </td>
                <td className="whitespace-nowrap px-5 py-3.5 text-right text-[13px] tabular-nums">
                  {row.utilization.toFixed(1)}%
                </td>
                <td className="whitespace-nowrap px-5 py-3.5 text-right text-[13px] tabular-nums">
                  {row.uptime.toFixed(1)}%
                </td>
                <td className="whitespace-nowrap px-5 py-3.5 text-right text-[13px] tabular-nums">
                  {row.fuelEfficiency.toFixed(1)}{" "}
                  <span className="text-[11px] text-ink-400">
                    {row.type === "E-Fahrzeug" ? "kWh/100km" : "l/100km"}
                  </span>
                </td>
                <td className="whitespace-nowrap px-5 py-3.5 text-right">
                  {row.incidents === 0 ? (
                    <Tag variant="success">0</Tag>
                  ) : row.incidents === 1 ? (
                    <Tag variant="warning">{row.incidents}</Tag>
                  ) : (
                    <Tag variant="danger">{row.incidents}</Tag>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-ink-100 px-5 py-3 text-xs text-ink-500">
        <span>
          Zeige <span className="font-medium text-ink-700">{rows.length}</span>{" "}
          von {ROWS.length} Fahrzeugen
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-md border border-ink-200 bg-white px-2.5 py-1 hover:bg-ink-50"
          >
            Zurück
          </button>
          <button
            type="button"
            className="rounded-md bg-brand-600 px-2.5 py-1 font-medium text-white hover:bg-brand-700"
          >
            Weiter
          </button>
        </div>
      </div>
    </section>
  );
}

function Th({
  label,
  sortKey,
  activeKey,
  dir,
  onClick,
  className = "",
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  dir: "asc" | "desc";
  onClick: (k: SortKey) => void;
  className?: string;
}) {
  const isActive = activeKey === sortKey;
  return (
    <th className={`whitespace-nowrap px-5 py-3 font-medium ${className}`}>
      <button
        type="button"
        onClick={() => onClick(sortKey)}
        className={`inline-flex items-center gap-1 ${
          isActive ? "text-ink-700" : ""
        }`}
      >
        {label}
        {isActive ? (
          dir === "asc" ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )
        ) : null}
      </button>
    </th>
  );
}
