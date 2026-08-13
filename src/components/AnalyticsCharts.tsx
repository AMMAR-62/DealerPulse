"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const PIE_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#06b6d4",
  "#f43f5e",
  "#84cc16",
  "#64748b",
];

export function LostReasonPie({
  data,
}: {
  data: { reason: string; count: number }[];
}) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="reason"
            innerRadius={55}
            outerRadius={90}
            paddingAngle={2}
            strokeWidth={1}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: "var(--background)",
              border: "1px solid var(--foreground)",
              borderRadius: 8,
              color: "var(--foreground)",
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SourceBarChart({
  data,
}: {
  data: { source: string; leads: number; delivered: number }[];
}) {
  const rows = data.map((d) => ({
    source: d.source,
    Delivered: d.delivered,
    Leads: d.leads,
  }));
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={rows}
          margin={{ top: 8, right: 8, bottom: 0, left: -12 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.15} />
          <XAxis dataKey="source" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              background: "var(--background)",
              border: "1px solid var(--foreground)",
              borderRadius: 8,
              color: "var(--foreground)",
            }}
          />
          <Bar dataKey="Leads" fill="#a1a1aa" radius={[3, 3, 0, 0]} />
          <Bar dataKey="Delivered" fill="#6366f1" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}