import { Bar, BarChart, ResponsiveContainer } from "recharts";

type Props = {
  data: { v: number }[];
  color?: string;
};

export default function SparkBars({ data, color = "#c7cdff" }: Props) {
  return (
    <div className="h-20 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barCategoryGap={3}>
          <Bar dataKey="v" fill={color} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
