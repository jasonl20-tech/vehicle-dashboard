import {
  ChevronDown,
  ChevronUp,
  Columns3,
  Download,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { useMemo, useState } from "react";

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
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-5 border-b border-hair">
          {(
            [
              { id: "all", label: "Fahrzeuge" },
              { id: "tours", label: "Touren" },
            ] as const
          ).map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`relative -mb-px pb-2 text-[13px] transition-colors ${
                  active
                    ? "text-ink-900 font-medium"
                    : "text-ink-500 hover:text-ink-800"
                }`}
              >
                {t.label}
                {active && (
                  <span className="absolute inset-x-0 -bottom-px h-[2px] bg-ink-900" />
                )}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Suche…"
              className="w-56 rounded-md border border-hair bg-white py-1.5 pl-8 pr-3 text-[13px] placeholder:text-ink-400 focus:border-ink-300 focus:outline-none focus:ring-2 focus:ring-ink-100"
            />
          </label>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-hair bg-white px-2.5 py-1.5 text-[12.5px] text-ink-700 hover:border-ink-300"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filter
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-hair bg-white px-2.5 py-1.5 text-[12.5px] text-ink-700 hover:border-ink-300"
          >
            <Columns3 className="h-3.5 w-3.5" />
            Spalten
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md bg-ink-900 px-2.5 py-1.5 text-[12.5px] font-medium text-white hover:bg-ink-800"
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </button>
        </div>
      </div>

      <div className="overflow-x-auto -mx-2">
        <table className="min-w-full text-[13.5px]">
          <thead>
            <tr className="border-y border-hair text-left text-[10.5px] uppercase tracking-[0.14em] text-ink-400">
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
                align="right"
              />
              <Th
                label="Auslastung"
                sortKey="utilization"
                activeKey={sortKey}
                dir={sortDir}
                onClick={toggleSort}
                align="right"
              />
              <Th
                label="Verfügbarkeit"
                sortKey="uptime"
                activeKey={sortKey}
                dir={sortDir}
                onClick={toggleSort}
                align="right"
              />
              <Th
                label="Verbrauch"
                sortKey="fuelEfficiency"
                activeKey={sortKey}
                dir={sortDir}
                onClick={toggleSort}
                align="right"
              />
              <Th
                label="Vorfälle"
                sortKey="incidents"
                activeKey={sortKey}
                dir={sortDir}
                onClick={toggleSort}
                align="right"
              />
            </tr>
          </thead>
          <tbody className="divide-y divide-hair">
            {rows.map((row) => (
              <tr
                key={row.id}
                className="group transition-colors hover:bg-ink-50/60"
              >
                <td className="whitespace-nowrap px-3 py-3.5">
                  <div className="flex items-center gap-3">
                    <span
                      className="grid h-7 w-7 place-items-center rounded-md text-[10.5px] font-semibold text-ink-700 ring-1 ring-inset ring-hair"
                      style={{
                        background: avatarBg(row.id),
                      }}
                    >
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
                <td className="whitespace-nowrap px-3 py-3.5 text-[12.5px] text-ink-500">
                  {row.added}
                </td>
                <td className="whitespace-nowrap px-3 py-3.5 text-right font-mono text-[12.5px] tabular-nums text-ink-800">
                  {row.trips}
                </td>
                <td className="whitespace-nowrap px-3 py-3.5 text-right">
                  <UtilizationCell value={row.utilization} />
                </td>
                <td className="whitespace-nowrap px-3 py-3.5 text-right font-mono text-[12.5px] tabular-nums text-ink-800">
                  {row.uptime.toFixed(1)}%
                </td>
                <td className="whitespace-nowrap px-3 py-3.5 text-right font-mono text-[12.5px] tabular-nums text-ink-800">
                  {row.fuelEfficiency.toFixed(1)}{" "}
                  <span className="text-[10.5px] font-sans text-ink-400">
                    {row.type === "E-Fahrzeug" ? "kWh" : "l"}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-3.5 text-right">
                  <IncidentDot count={row.incidents} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-[12px] text-ink-500">
        <span>
          <span className="font-medium text-ink-700">{rows.length}</span> von{" "}
          {ROWS.length} Fahrzeugen
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-md border border-hair bg-white px-2 py-1 hover:border-ink-300"
          >
            Zurück
          </button>
          <button
            type="button"
            className="rounded-md bg-ink-900 px-2 py-1 font-medium text-white hover:bg-ink-800"
          >
            Weiter
          </button>
        </div>
      </div>
    </div>
  );
}

function Th({
  label,
  sortKey,
  activeKey,
  dir,
  onClick,
  align = "left",
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  dir: "asc" | "desc";
  onClick: (k: SortKey) => void;
  align?: "left" | "right";
}) {
  const isActive = activeKey === sortKey;
  return (
    <th
      className={`whitespace-nowrap px-3 py-2.5 font-medium ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      <button
        type="button"
        onClick={() => onClick(sortKey)}
        className={`inline-flex items-center gap-1 ${
          isActive ? "text-ink-700" : ""
        } ${align === "right" ? "flex-row-reverse" : ""}`}
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

function UtilizationCell({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  const color =
    pct >= 85 ? "#5a3df0" : pct >= 70 ? "#8a76ff" : pct >= 50 ? "#b3a6ff" : "#d2caff";
  return (
    <div className="ml-auto flex max-w-[180px] items-center justify-end gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-ink-100">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="font-mono text-[12.5px] tabular-nums text-ink-800">
        {pct.toFixed(1)}%
      </span>
    </div>
  );
}

function IncidentDot({ count }: { count: number }) {
  if (count === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[12px] text-ink-400">
        <span className="h-1.5 w-1.5 rounded-full bg-accent-mint" />
        Keine
      </span>
    );
  }
  const color = count >= 2 ? "bg-accent-rose" : "bg-accent-amber";
  return (
    <span className="inline-flex items-center gap-1 text-[12px] text-ink-700">
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
      {count}
    </span>
  );
}

function avatarBg(seed: string) {
  const palette = [
    "linear-gradient(135deg,#eef0ff,#fff)",
    "linear-gradient(135deg,#f5f0ff,#fff)",
    "linear-gradient(135deg,#fff0f4,#fff)",
    "linear-gradient(135deg,#f0fff7,#fff)",
    "linear-gradient(135deg,#fff7e6,#fff)",
    "linear-gradient(135deg,#eaf5ff,#fff)",
  ];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}
