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
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 12, right: 8, left: -12, bottom: 0 }}
          barCategoryGap="22%"
        >
          <CartesianGrid stroke="#ececea" vertical={false} />
          <XAxis
            dataKey="type"
            axisLine={false}
            tickLine={false}
            tickMargin={12}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tickMargin={4}
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
          />
          <Tooltip
            cursor={{ fill: "rgba(109, 82, 255, 0.06)" }}
            formatter={(v: number, name: string) => [
              v,
              name === "active" ? "Aktiv" : "Verfügbar",
            ]}
          />
          <Bar
            dataKey="active"
            fill="#5a3df0"
            radius={[4, 4, 0, 0]}
            barSize={14}
          />
          <Bar
            dataKey="idle"
            fill="#d2caff"
            radius={[4, 4, 0, 0]}
            barSize={14}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
