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
import { formatCurrency, formatPercent } from "@/lib/format";
import KpiCard from "@/components/KpiCard";
import FunnelBars from "@/components/FunnelBars";
import PacingChart from "@/components/PacingChart";
import AnomalyStrip from "@/components/AnomalyStrip";
import { monthKey } from "@/lib/data/load";

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

  const trendByMonth = new Map<string, number>();
  for (const d of branchDeliveries) {
    const m = monthKey(d.delivery_date);
    trendByMonth.set(m, (trendByMonth.get(m) ?? 0) + 1);
  }
  const pacingData = [...targetByMonth.keys()]
    .sort()
    .map((m) => ({
      month: m,
      actual: trendByMonth.get(m) ?? 0,
      target: targetByMonth.get(m)?.target_units ?? 0,
    }));

  const backHref = `/branches${buildQueryString(updateParam(currentParams, "branch", []))}`;

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <Link
          href={backHref}
          className="rounded-md border border-zinc-300 px-2.5 py-1 text-sm text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          ← All branches
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {branch?.name ?? branchId}
          </h1>
          <p className="text-sm text-zinc-500">
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
        <KpiCard label="Avg days to deliver" value={avgDays.toFixed(1)} />
        <KpiCard
          label="Revenue"
          value={formatCurrency(revenue)}
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
        <h2 className="mb-3 text-sm font-semibold">Rep leaderboard</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                <th className="py-2 pr-3">Rep</th>
                <th className="py-2 pr-3">Leads</th>
                <th className="py-2 pr-3">Delivered</th>
                <th className="py-2 pr-3">Delivery %</th>
                <th className="py-2 pr-3">Revenue</th>
                <th className="py-2 pr-3">Avg days</th>
              </tr>
            </thead>
            <tbody>
              {reps.map((r) => (
                <tr
                  key={r.repId}
                  className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60"
                >
                  <td className="py-2 pr-3 font-medium">{r.name}</td>
                  <td className="py-2 pr-3">{r.leads}</td>
                  <td className="py-2 pr-3">{r.deliveredUnits}</td>
                  <td className="py-2 pr-3">{formatPercent(r.deliveryRate)}</td>
                  <td className="py-2 pr-3">{formatCurrency(r.revenue)}</td>
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