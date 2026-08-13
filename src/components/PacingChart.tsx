"use client";

import { useRef } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toPng } from "html-to-image";

export interface PacingDatum {
  month: string;
  actual: number;
  target: number;
  revenue?: number;
}

export default function PacingChart({
  data,
  filename = "pacing.png",
}: {
  data: PacingDatum[];
  filename?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  const exportPng = async () => {
    const node = containerRef.current;
    if (!node) return;
    try {
      const dataUrl = await toPng(node, { backgroundColor: "#ffffff", pixelRatio: 2 });
      const link = document.createElement("a");
      link.download = filename;
      link.href = dataUrl;
      link.click();
    } catch {
      // ignore export failures silently
    }
  };

  const hasRevenue = data.some((d) => (d.revenue ?? 0) > 0);
  const chartData = data.map((d) => ({
    month: d.month.slice(5).replace("-", "/"),
    actual: d.actual,
    target: d.target,
    revenue: hasRevenue ? (d.revenue ?? 0) / 100000 : undefined,
  }));

  return (
    <div>
      <div className="mb-2 flex justify-end">
        <button
          type="button"
          onClick={exportPng}
          className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Export PNG
        </button>
      </div>
      <div ref={containerRef} className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 8, right: 8, bottom: 0, left: -12 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.15} />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis yAxisId="units" tick={{ fontSize: 12 }} allowDecimals={false} />
            {hasRevenue && (
              <YAxis
                yAxisId="revenue"
                orientation="right"
                tick={{ fontSize: 12 }}
                unit=" L"
                width={40}
              />
            )}
            <Tooltip
              contentStyle={{
                background: "var(--background)",
                border: "1px solid var(--foreground)",
                borderRadius: 8,
                color: "var(--foreground)",
              }}
              formatter={(value, name) =>
                name === "Revenue"
                  ? [`₹${Number(value ?? 0).toFixed(1)} L`, String(name)]
                  : [value ?? "", String(name)]
              }
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar
              dataKey="target"
              name="Target"
              fill="#a1a1aa"
              radius={[3, 3, 0, 0]}
              yAxisId="units"
            />
            <Bar
              dataKey="actual"
              name="Delivered"
              fill="#6366f1"
              radius={[3, 3, 0, 0]}
              yAxisId="units"
            />
            {hasRevenue && (
              <Line
                yAxisId="revenue"
                type="monotone"
                dataKey="revenue"
                name="Revenue"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {hasRevenue && (
        <p className="mt-1 text-xs text-zinc-400">
          Bars = units; emerald line = delivered revenue (₹ Lakh).
        </p>
      )}
    </div>
  );
}