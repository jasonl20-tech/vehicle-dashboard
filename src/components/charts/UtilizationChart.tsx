import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const data = [
  { year: "2017", utilization: 38, idle: 22 },
  { year: "2018", utilization: 56, idle: 34 },
  { year: "2019", utilization: 42, idle: 28 },
  { year: "2020", utilization: 70, idle: 45 },
  { year: "2021", utilization: 58, idle: 38 },
  { year: "2022", utilization: 48, idle: 30 },
  { year: "2023", utilization: 64, idle: 42 },
  { year: "2024", utilization: 52, idle: 36 },
  { year: "2025", utilization: 75, idle: 50 },
  { year: "2026", utilization: 62, idle: 41 },
];

export default function UtilizationChart() {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="utilGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="idleGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a5adff" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#a5adff" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#eef0ff" vertical={false} />
          <XAxis
            dataKey="year"
            axisLine={false}
            tickLine={false}
            tickMargin={10}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tickMargin={8}
            tickFormatter={(v) => `${v}%`}
            domain={[0, 100]}
            ticks={[0, 20, 40, 60, 80, 100]}
          />
          <Tooltip
            cursor={{ stroke: "#c7cdff", strokeDasharray: 4 }}
            formatter={(v: number, name: string) => [
              `${v}%`,
              name === "utilization" ? "Auslastung" : "Leerlauf",
            ]}
          />
          <Area
            type="monotone"
            dataKey="idle"
            stroke="#a5adff"
            strokeWidth={2}
            fill="url(#idleGradient)"
          />
          <Area
            type="monotone"
            dataKey="utilization"
            stroke="#4f46e5"
            strokeWidth={2.5}
            fill="url(#utilGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
