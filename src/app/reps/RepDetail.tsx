import Link from "next/link";
import { Suspense } from "react";
import type { DatasetIndex } from "@/lib/data/load";
import type { FilteredContext } from "@/lib/engine/metrics";
import {
  computeFunnel,
  computeLeadAging,
  computeLostByReason,
} from "@/lib/engine/metrics";
import { OPEN_STAGES } from "@/lib/data/types";
import type { Lead } from "@/lib/data/types";
import { buildQueryString, updateParam } from "@/lib/store/filters";
import { daysBetween } from "@/lib/data/load";
import { formatLakhCr, formatPercent } from "@/lib/format";
import KpiCard from "@/components/KpiCard";
import FunnelBars from "@/components/FunnelBars";
import Breadcrumb from "@/components/Breadcrumb";
import RepLeadsTable from "@/components/RepLeadsTable";
import { LEAD_SORT_KEYS } from "@/lib/leadsSortKeys";

export default async function RepDetail({
  index,
  ctx,
  repId,
  currentParams,
}: {
  index: DatasetIndex;
  ctx: FilteredContext;
  repId: string;
  currentParams: Record<string, string | string[] | undefined>;
}) {
  const rep = index.repsById.get(repId);
  const leads = ctx.leads.filter((l) => l.assigned_to === repId);
  const leadIds = new Set(leads.map((l) => l.id));
  const deliveries = ctx.deliveries.filter((d) => leadIds.has(d.lead_id));

  const delivered = leads.filter((l) => l.status === "delivered");
  const open = leads.filter((l) => OPEN_STAGES.includes(l.status as (typeof OPEN_STAGES)[number]));
  const lost = leads.filter((l) => l.status === "lost");
  const revenue = delivered.reduce((s, l) => s + (l.deal_value || 0), 0);
  const pipelineValue = open.reduce((s, l) => s + (l.deal_value || 0), 0);
  const days = deliveries.map((d) => d.days_to_deliver);
  const avgDays = days.length ? days.reduce((a, b) => a + b, 0) / days.length : 0;

  const funnel = computeFunnel(leads);
  const lostReasons = computeLostByReason(leads);
  const agingFull = computeLeadAging(leads, ctx.filters.asOf, 14);
  const aging = agingFull.slice(0, 8);
  const agingMap = new Map(
    agingFull.map((a) => [a.lead.id, { daysSinceActivity: a.daysSinceActivity, stale: a.stale }])
  );
  const branchNames: Record<string, string> = {};
  for (const [id, b] of index.branchesById) branchNames[id] = b.name;
  const deliveryById: Record<string, { daysToDeliver: number; delayReason?: string | null }> = {};
  for (const d of deliveries) {
    deliveryById[d.lead_id] = { daysToDeliver: d.days_to_deliver, delayReason: d.delay_reason };
  }
  const lastActivity = leads.length
    ? leads.reduce((max, l) => (l.last_activity_at > max ? l.last_activity_at : max), "")
    : null;

  const backHref = `/reps${buildQueryString(updateParam(currentParams, "rep", []))}`;

  const sortKey = (LEAD_SORT_KEYS as readonly string[]).includes(
    String(currentParams?.sort ?? "")
  )
    ? String(currentParams?.sort)
    : "created_at";
  const sortDir = currentParams?.dir === "asc" ? "asc" : "desc";
  const sortedLeads = [...leads].sort((a, b) => {
    const av = a[sortKey as keyof Lead];
    const bv = b[sortKey as keyof Lead];
    const cmp =
      typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv));
    return sortDir === "asc" ? cmp : -cmp;
  });

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Reps", href: "/reps" },
          { label: rep?.name ?? repId },
        ]}
      />
      <div className="mb-4 flex items-center gap-3">
        <Link
          href={backHref}
          className="rounded-md border border-zinc-300 px-2.5 py-1 text-sm text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          ← All reps
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{rep?.name ?? repId}</h1>
          <p className="text-sm text-zinc-500">
            {index.branchesById.get(rep?.branch_id ?? "")?.name ?? rep?.branch_id} ·{" "}
            {rep?.role === "branch_manager" ? "Branch manager" : "Sales officer"}
          </p>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="Assigned leads" value={leads.length} />
        <KpiCard
          label="Delivery rate"
          value={formatPercent(leads.length ? delivered.length / leads.length : 0)}
        />
        <KpiCard label="Delivered" value={delivered.length} />
        <KpiCard label="Lost" value={lost.length} />
        <KpiCard label="Avg days to deliver" value={avgDays.toFixed(1)} />
        <KpiCard label="Pipeline value" value={formatLakhCr(pipelineValue)} />
      </section>

      <div className="mt-6 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">
          Pipeline:
        </span>
        {(["order_placed", "delivered", "lost"] as const).map((stage) => {
          const count = leads.filter((l) => l.status === stage).length;
          if (count === 0) return null;
          const tone =
            stage === "delivered"
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
              : stage === "lost"
                ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300"
                : "bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300";
          return (
            <span
              key={stage}
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${tone}`}
            >
              {stage.replace("_", " ")} ({count})
            </span>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap gap-3 text-sm">
        <span className="rounded-md border border-zinc-200 px-3 py-1.5 dark:border-zinc-800">
          Delivered revenue <strong>{formatLakhCr(revenue)}</strong>
        </span>
        <span className="rounded-md border border-zinc-200 px-3 py-1.5 dark:border-zinc-800">
          Last activity{" "}
          <strong>
            {lastActivity
              ? lastActivity.slice(0, 10)
              : "—"}
            {lastActivity && daysBetween(lastActivity, ctx.filters.asOf) > 7
              ? ` (${daysBetween(lastActivity, ctx.filters.asOf)}d ago)`
              : ""}
          </strong>
        </span>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="mb-3 text-sm font-semibold">Rep funnel</h2>
          <FunnelBars rows={funnel} />
        </section>

        <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="mb-3 text-sm font-semibold">Top lost reasons</h2>
          {lostReasons.length ? (
            <ul className="space-y-1.5">
              {lostReasons.slice(0, 5).map((r) => (
                <li key={r.reason} className="flex items-center justify-between text-sm">
                  <span className="truncate pr-2 text-zinc-600 dark:text-zinc-300">
                    {r.reason}
                  </span>
                  <span className="font-medium">{r.count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-400">No lost leads.</p>
          )}
        </section>
      </div>

      <section className="mt-6 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <Suspense fallback={null}>
          <RepLeadsTable
            leads={sortedLeads}
            branchNames={branchNames}
            repName={rep?.name ?? repId}
            aging={agingMap}
            deliveries={deliveryById}
            repId={repId}
            sortKey={sortKey}
            sortDir={sortDir}
          />
        </Suspense>
      </section>

      {aging.filter((a) => a.stale).length > 0 && (
        <section className="mt-6 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="mb-3 text-sm font-semibold">Stale leads need attention</h2>
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {aging
              .filter((a) => a.stale)
              .map((a) => (
                <li key={a.lead.id} className="flex items-center justify-between py-1.5 text-sm">
                  <span className="truncate pr-2 text-zinc-600 dark:text-zinc-300">
                    {a.lead.customer_name} · {a.lead.model_interested}
                  </span>
                  <span className="text-xs text-red-600">
                    {a.daysSinceActivity}d inactive
                    {a.daysSinceCreated >= 60 ? " · aged" : ""}
                  </span>
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
}