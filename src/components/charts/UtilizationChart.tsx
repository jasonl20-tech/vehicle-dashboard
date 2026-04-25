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
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 12, right: 8, left: -12, bottom: 0 }}
        >
          <defs>
            <linearGradient id="utilGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6d52ff" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#6d52ff" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="idleGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#b3a6ff" stopOpacity={0.18} />
              <stop offset="100%" stopColor="#b3a6ff" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#ececea" vertical={false} />
          <XAxis
            dataKey="year"
            axisLine={false}
            tickLine={false}
            tickMargin={12}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tickMargin={4}
            tickFormatter={(v) => `${v}%`}
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
          />
          <Tooltip
            cursor={{
              stroke: "#bfbfb9",
              strokeWidth: 1,
              strokeDasharray: "3 3",
            }}
            formatter={(v: number, name: string) => [
              `${v}%`,
              name === "utilization" ? "Auslastung" : "Leerlauf",
            ]}
          />
          <Area
            type="monotone"
            dataKey="idle"
            stroke="#b3a6ff"
            strokeWidth={1.75}
            fill="url(#idleGradient)"
            dot={false}
            activeDot={{ r: 3, strokeWidth: 0 }}
          />
          <Area
            type="monotone"
            dataKey="utilization"
            stroke="#5a3df0"
            strokeWidth={2.25}
            fill="url(#utilGradient)"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
