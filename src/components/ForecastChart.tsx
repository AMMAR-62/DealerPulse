"use client";

import { useRef } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toPng } from "html-to-image";
import type { ForecastPoint } from "@/lib/engine/pipeline";

export default function ForecastChart({
  points,
  asOf,
}: {
  points: ForecastPoint[];
  asOf: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  const exportPng = async () => {
    const node = containerRef.current;
    if (!node) return;
    try {
      const dataUrl = await toPng(node, { backgroundColor: "#ffffff", pixelRatio: 2 });
      const link = document.createElement("a");
      link.download = "forecast.png";
      link.href = dataUrl;
      link.click();
    } catch {
      // ignore export failures silently
    }
  };

  const data = points.map((p) => ({
    month: p.month.slice(5).replace("-", "/"),
    target: p.targetUnits,
    actual: p.isForecast ? null : p.actualDelivered,
    actualCumulative: p.actualCumulative,
    projectedCumulative: p.projectedCumulative,
    bestCumulative: p.bestCumulative,
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
      <div ref={containerRef} className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.15} />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                background: "var(--background)",
                border: "1px solid var(--foreground)",
                borderRadius: 8,
                color: "var(--foreground)",
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="target" name="Target" fill="#a1a1aa" radius={[3, 3, 0, 0]} />
            <Bar dataKey="actual" name="Delivered" fill="#6366f1" radius={[3, 3, 0, 0]} />
            <Line
              dataKey="actualCumulative"
              name="Actual (cumulative)"
              type="monotone"
              stroke="#10b981"
              strokeWidth={2}
              dot
            />
            <Line
              dataKey="projectedCumulative"
              name="Projected (cumulative)"
              type="monotone"
              stroke="#f59e0b"
              strokeWidth={2}
              strokeDasharray="6 4"
              dot
            />
            <Line
              dataKey="bestCumulative"
              name="Best case (cumulative)"
              type="monotone"
              stroke="#a5b4fc"
              strokeWidth={1.5}
              strokeDasharray="2 4"
              dot={false}
            />
            <ReferenceLine
              x={asOf.slice(5).replace("-", "/")}
              stroke="currentColor"
              strokeDasharray="4 4"
              label={{ value: "as of", position: "top", fontSize: 11, fill: "currentColor" }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}