"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type TrendPoint = Record<string, number | string | null> & {
  label: string;
};

export function ScoreTrendChart(props: { data: TrendPoint[]; series: string[] }) {
  const { data, series } = props;

  const colors = [
    "#2563eb", // blue
    "#dc2626", // red
    "#16a34a", // green
    "#9333ea", // purple
    "#ea580c", // orange
    "#0891b2", // cyan
    "#ca8a04", // amber
    "#0f766e", // teal
  ];

  const colorFor = (key: string) => {
    if (key === "总分") return "#111827";
    const idx = Math.abs(hashCode(key)) % colors.length;
    return colors[idx];
  };

  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" tickMargin={8} />
          <YAxis width={36} />
          <Tooltip />
          <Legend />

          {series.map((k) => (
            <Line
              key={k}
              type="monotone"
              dataKey={k}
              stroke={colorFor(k)}
              strokeWidth={k === "总分" ? 3 : 2}
              dot={{ r: k === "总分" ? 3 : 2 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function hashCode(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}
