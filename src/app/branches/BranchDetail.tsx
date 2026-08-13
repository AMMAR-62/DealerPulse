import Link from "next/link";
import type { Dataset } from "@/lib/data/types";
import type { DatasetIndex } from "@/lib/data/load";
import type { FilteredContext } from "@/lib/engine/metrics";
import {
  computeAnomalies,
} from "@/lib/engine/anomalies";
import {
  computeFunnel,
  computeLeadAging,
  computeRepScorecard,
} from "@/lib/engine/metrics";
import { buildQueryString, updateParam } from "@/lib/store/filters";
import { formatLakhCr, formatPercent } from "@/lib/format";
import KpiCard from "@/components/KpiCard";
import FunnelBars from "@/components/FunnelBars";
import PacingChart from "@/components/PacingChart";
import AnomalyStrip from "@/components/AnomalyStrip";
import Breadcrumb from "@/components/Breadcrumb";
import CsvExportButton from "@/components/CsvExportButton";
import { monthKey } from "@/lib/data/load";

const validSortKeys = [
  "name",
  "leads",
  "deliveredUnits",
  "deliveryRate",
  "revenue",
  "avgDaysToDeliver",
] as const;

export default async function BranchDetail({
  dataset,
  index,
  ctx,
  branchId,
  currentParams,
}: {
  dataset: Dataset;
  index: DatasetIndex;
  ctx: FilteredContext;
  branchId: string;
  currentParams: Record<string, string | string[] | undefined>;
}) {
  const branch = index.branchesById.get(branchId);
  const branchLeads = ctx.leads.filter((l) => l.branch_id === branchId);
  const branchLeadIds = new Set(branchLeads.map((l) => l.id));
  const branchDeliveries = ctx.deliveries.filter((d) => branchLeadIds.has(d.lead_id));
  const funnel = computeFunnel(branchLeads);
  const aging = computeLeadAging(branchLeads, ctx.filters.asOf, 14).slice(0, 8);
  const reps = computeRepScorecard(dataset, index, ctx, ctx.filters.asOf).filter(
    (r) => r.branchId === branchId
  );
  const anomalies = computeAnomalies(dataset, index, ctx).filter(
    (a) => a.entityId === branchId || a.entityType === "network"
  );

  const delivered = branchLeads.filter((l) => l.status === "delivered");
  const open = branchLeads.filter((l) => l.status !== "lost" && l.status !== "delivered");
  const lost = branchLeads.filter((l) => l.status === "lost");
  const revenue = delivered.reduce((s, l) => s + (l.deal_value || 0), 0);
  const days = branchDeliveries.map((d) => d.days_to_deliver);
  const avgDays = days.length ? days.reduce((a, b) => a + b, 0) / days.length : 0;
  const targetByMonth = index.targetsByBranchMonth.get(branchId) ?? new Map();
  const targetUnits = targetByMonth.get(ctx.filters.asOf.slice(0, 7))?.target_units ?? 0;
  const activeReps = new Set(branchLeads.map((l) => l.assigned_to)).size;
  const aging7 = computeLeadAging(branchLeads, ctx.filters.asOf, 7);
  const staleLeads7 = aging7.filter((a) => a.stale);
  const staleAtRisk = staleLeads7.reduce((s, a) => s + (a.lead.deal_value || 0), 0);
  const attainment = targetUnits ? delivered.length / targetUnits : 0;

  const leadById = new Map(branchLeads.map((l) => [l.id, l]));
  const trendByMonth = new Map<string, number>();
  const revenueByMonth = new Map<string, number>();
  for (const d of branchDeliveries) {
    const m = monthKey(d.delivery_date);
    trendByMonth.set(m, (trendByMonth.get(m) ?? 0) + 1);
    revenueByMonth.set(m, (revenueByMonth.get(m) ?? 0) + (leadById.get(d.lead_id)?.deal_value ?? 0));
  }
  const pacingData = [...targetByMonth.keys()]
    .sort()
    .map((m) => ({
      month: m,
      actual: trendByMonth.get(m) ?? 0,
      target: targetByMonth.get(m)?.target_units ?? 0,
      revenue: revenueByMonth.get(m) ?? 0,
    }));

  const sortKey = (validSortKeys as readonly string[]).includes(
    String(currentParams?.sort ?? "")
  )
    ? String(currentParams?.sort)
    : "revenue";
  const sortDir = currentParams?.dir === "asc" ? "asc" : "desc";
  const sortedReps = [...reps].sort((a, b) => {
    const av = a[sortKey as keyof (typeof reps)[number]];
    const bv = b[sortKey as keyof (typeof reps)[number]];
    const cmp =
      typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv));
    return sortDir === "asc" ? cmp : -cmp;
  });
  const sortHref = (key: string) => {
    const nextDir = sortKey === key ? (sortDir === "desc" ? "asc" : "desc") : "desc";
    const cleaned: Record<string, string | string[]> = {
      ...Object.fromEntries(
        Object.entries(currentParams).filter(([k]) => k === "branch" || k === "asOf")
      ),
      sort: key,
      dir: nextDir,
    };
    return `/branches${buildQueryString(cleaned)}`;
  };

  const backHref = `/branches${buildQueryString(updateParam(currentParams, "branch", []))}`;

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Branches", href: "/branches" },
          { label: branch?.name ?? branchId },
        ]}
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link
          href={backHref}
          className="rounded-md border border-zinc-300 px-2.5 py-1 text-sm text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          ← All branches
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">
            {branch?.name ?? branchId}
          </h1>
          <p className="truncate text-sm text-zinc-500">
            {branch?.city} · as of {ctx.filters.asOf}
          </p>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="Total leads" value={branchLeads.length} />
        <KpiCard
          label="Delivery rate"
          value={formatPercent(branchLeads.length ? delivered.length / branchLeads.length : 0)}
        />
        <KpiCard label="Delivered" value={delivered.length} />
        <KpiCard
          label="Open pipeline"
          value={open.length}
          sub={`${lost.length} lost`}
        />
        <KpiCard
          label="Units vs target"
          value={`${delivered.length} / ${targetUnits}`}
          sub={
            attainment > 0
              ? `${formatPercent(attainment)} acquired this month`
              : "no target scheduled"
          }
          tone={attainment >= 1 ? "good" : "bad"}
        />
        <KpiCard
          label="Active reps"
          value={activeReps}
          sub={`${index.repsByBranch.get(branchId)?.length ?? 0} on roster`}
        />
        <KpiCard
          label="⚠ Aging leads (7d+)"
          value={staleLeads7.length}
          sub={staleLeads7.length ? `${formatLakhCr(staleAtRisk)} at risk` : "none"}
          tone={staleLeads7.length ? "bad" : "good"}
        />
        <KpiCard label="Avg days to deliver" value={avgDays.toFixed(1)} />
        <KpiCard
          label="Revenue"
          value={formatLakhCr(revenue)}
          sub={`target ${targetUnits} units`}
        />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="mb-3 text-sm font-semibold">Monthly pacing vs target</h2>
          <PacingChart data={pacingData} filename={`pacing-${branchId}.png`} />
        </section>

        <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="mb-3 text-sm font-semibold">Funnel</h2>
          <FunnelBars rows={funnel} />
        </section>
      </div>

      <section className="mt-6 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Rep leaderboard</h2>
          <CsvExportButton
            filename={`dealerpulse-${branchId}-reps.csv`}
            headers={[
              { key: "name", label: "Rep" },
              { key: "leads", label: "Leads" },
              { key: "deliveredUnits", label: "Delivered" },
              { key: "deliveryRate", label: "Delivery %" },
              { key: "revenue", label: "Revenue" },
              { key: "avgDaysToDeliver", label: "Avg days" },
            ]}
            rows={sortedReps}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                {[
                  { key: "name", label: "Rep" },
                  { key: "leads", label: "Leads" },
                  { key: "deliveredUnits", label: "Delivered" },
                  { key: "deliveryRate", label: "Delivery %" },
                  { key: "revenue", label: "Revenue" },
                  { key: "avgDaysToDeliver", label: "Avg days" },
                ].map((col) => (
                  <th key={col.key} className="py-2 pr-3">
                    <Link
                      href={sortHref(col.key)}
                      className={`uppercase tracking-wide hover:text-zinc-900 dark:hover:text-zinc-50 ${
                        sortKey === col.key
                          ? "text-indigo-600 dark:text-indigo-400"
                          : ""
                      }`}
                    >
                      {col.label}
                      {sortKey === col.key && (
                        <span className="ml-0.5 text-[10px]">
                          {sortDir === "asc" ? "▲" : "▼"}
                        </span>
                      )}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedReps.map((r) => (
                <tr
                  key={r.repId}
                  className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-900/50"
                >
                  <td className="py-2 pr-3 font-medium">{r.name}</td>
                  <td className="py-2 pr-3">{r.leads}</td>
                  <td className="py-2 pr-3">{r.deliveredUnits}</td>
                  <td className="py-2 pr-3">{formatPercent(r.deliveryRate)}</td>
                  <td className="py-2 pr-3">{formatLakhCr(r.revenue)}</td>
                  <td className="py-2 pr-3">{r.avgDaysToDeliver.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="mb-3 text-sm font-semibold">Stale / aged leads</h2>
          {aging.length ? (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
              {aging
                .filter((a) => a.stale)
                .map((a) => (
                  <li key={a.lead.id} className="flex items-center justify-between py-1.5 text-sm">
                    <span className="truncate pr-2 text-zinc-600 dark:text-zinc-300">
                      {a.lead.customer_name}
                    </span>
                    <span className="text-xs text-red-600">
                      {a.daysSinceActivity}d inactive
                    </span>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-400">No stale leads.</p>
          )}
        </section>

        <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="mb-3 text-sm font-semibold">Anomalies for this branch</h2>
          {anomalies.length ? (
            <AnomalyStrip flags={anomalies} />
          ) : (
            <p className="text-sm text-zinc-400">No anomalies flagged.</p>
          )}
        </section>
      </div>
    </div>
  );
}