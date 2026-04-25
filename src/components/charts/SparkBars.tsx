import { Bar, BarChart, ResponsiveContainer } from "recharts";

type Props = {
  data: { v: number }[];
  color?: string;
  height?: number;
};

export default function SparkBars({
  data,
  color = "#d2caff",
  height = 56,
}: Props) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barCategoryGap={2}>
          <Bar dataKey="v" fill={color} radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
