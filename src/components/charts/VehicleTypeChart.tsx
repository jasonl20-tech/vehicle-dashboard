import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const data = [
  { type: "PKW", active: 62, idle: 50 },
  { type: "Transporter", active: 88, idle: 95 },
  { type: "LKW", active: 32, idle: 22 },
  { type: "E-Fahrzeug", active: 64, idle: 72 },
  { type: "Andere", active: 42, idle: 30 },
];

export default function VehicleTypeChart() {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
          barCategoryGap="20%"
        >
          <CartesianGrid stroke="#eef0ff" vertical={false} />
          <XAxis
            dataKey="type"
            axisLine={false}
            tickLine={false}
            tickMargin={10}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tickMargin={8}
            domain={[0, 100]}
            ticks={[0, 20, 40, 60, 80, 100]}
          />
          <Tooltip
            cursor={{ fill: "rgba(99,102,241,0.06)" }}
            formatter={(v: number, name: string) => [
              v,
              name === "active" ? "Aktiv" : "Verfügbar",
            ]}
          />
          <Bar
            dataKey="active"
            fill="#4f46e5"
            radius={[6, 6, 0, 0]}
            barSize={18}
          />
          <Bar
            dataKey="idle"
            fill="#c7cdff"
            radius={[6, 6, 0, 0]}
            barSize={18}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
