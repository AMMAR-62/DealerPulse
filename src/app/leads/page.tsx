import Link from "next/link";
import { Suspense } from "react";
import { getDataset, buildIndex } from "@/lib/data/load";
import { parseSearchParams, buildQueryString, updateParam } from "@/lib/store/filters";
import { buildContext, computeLeadAging } from "@/lib/engine/metrics";
import { formatLakhCr } from "@/lib/format";
import LeadsTable from "@/components/LeadsTable";

export default async function LeadsPage({
  searchParams,
}: PageProps<"/leads">) {
  const dataset = getDataset();
  const index = buildIndex(dataset);
  const current = await searchParams;
  const filters = parseSearchParams(current);
  const ctx = buildContext(dataset, index, filters);

  const staleAfter = Math.max(1, Number.parseInt(String(current["aging_gt"] ?? "7"), 10) || 7);
  const aging = computeLeadAging(ctx.leads, filters.asOf, staleAfter);
  const agingMap = new Map(
    aging.map((a) => [a.lead.id, { daysSinceActivity: a.daysSinceActivity, stale: a.stale }])
  );
  const staleLeads = aging.filter((a) => a.stale);
  const atRiskValue = staleLeads.reduce((sum, a) => sum + (a.lead.deal_value || 0), 0);

  const branches: Record<string, string> = {};
  for (const b of dataset.branches) branches[b.id] = b.name;
  const reps: Record<string, string> = {};
  for (const r of dataset.sales_reps) reps[r.id] = r.name;

  const deliveries: Record<string, { daysToDeliver: number; delayReason?: string | null }> = {};
  for (const d of ctx.deliveries) {
    deliveries[d.lead_id] = {
      daysToDeliver: d.days_to_deliver,
      delayReason: d.delay_reason,
    };
  }

  const flat: Record<string, string | string[]> = {};
  for (const [k, v] of Object.entries(current)) {
    if (Array.isArray(v)) flat[k] = v.join(",");
    else if (v !== undefined) flat[k] = v;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
          <p className="text-sm text-zinc-500">
            {ctx.leads.length} leads in scope · {staleLeads.length} stale ({staleAfter}d+ no activity) ·{" "}
            <span className="font-medium text-red-600">
              {formatLakhCr(atRiskValue)} at risk
            </span>
          </p>
        </div>
        <Link
          href="/leads"
          className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Clear aging focus
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        <Pill href={`/leads${buildQueryString(updateParam(flat, "branch", []))}`} active={ctx.filters.branches.length === 0}>
          All branches
        </Pill>
        {dataset.branches.map((b) => {
          const active = ctx.filters.branches.length === 1 && ctx.filters.branches[0] === b.id;
          const href = `/leads${buildQueryString(updateParam(flat, "branch", [b.id]))}`;
          return (
            <Pill key={b.id} href={href} active={active}>
              {b.name}
            </Pill>
          );
        })}
      </div>

      <Suspense fallback={<TableFallback />}>
        <LeadsTable
          leads={ctx.leads}
          branches={branches}
          reps={reps}
          aging={agingMap}
          staleAfter={staleAfter}
          deliveries={deliveries}
        />
      </Suspense>
    </div>
  );
}

function TableFallback() {
  return (
    <div className="rounded-lg border border-zinc-200 p-6 text-center text-sm text-zinc-400 dark:border-zinc-800">
      Loading leads…
    </div>
  );
}

function Pill({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? "bg-indigo-600 text-white"
          : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800/70 dark:text-zinc-300 dark:hover:bg-zinc-700"
      }`}
    >
      {children}
    </Link>
  );
}