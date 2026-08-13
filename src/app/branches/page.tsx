import Link from "next/link";
import { getDataset, buildIndex } from "@/lib/data/load";
import { parseSearchParams, buildQueryString, updateParam } from "@/lib/store/filters";
import { buildContext, computeBranchScorecard } from "@/lib/engine/metrics";
import { formatCurrency, formatPercent } from "@/lib/format";
import BranchDetail from "./BranchDetail";

export default async function BranchesPage({
  searchParams,
}: PageProps<"/branches">) {
  const dataset = getDataset();
  const index = buildIndex(dataset);
  const current = await searchParams;
  const filters = parseSearchParams(current);
  const ctx = buildContext(dataset, index, filters);

  if (filters.branches.length === 1) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6">
        <BranchDetail
          dataset={dataset}
          index={index}
          ctx={ctx}
          branchId={filters.branches[0]}
          currentParams={current}
        />
      </div>
    );
  }

  const scorecards = computeBranchScorecard(dataset, index, ctx);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Branches</h1>
        <p className="text-sm text-zinc-500">
          Select a branch to drill into detail. As of {filters.asOf}.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {scorecards.map((s) => {
          const href = `/branches${buildQueryString(updateParam(flatten(current), "branch", [s.branchId]))}`;
          const tone = s.deliveredVsTarget >= 0 ? "text-emerald-600" : "text-red-600";
          return (
            <Link
              key={s.branchId}
              href={href}
              className="rounded-lg border border-zinc-200 bg-white p-4 transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold">{s.name}</h2>
                  <p className="text-xs text-zinc-400">{s.city}</p>
                </div>
                <span className={`text-sm font-medium ${tone}`}>
                  {s.deliveredVsTarget > 0 ? "+" : ""}
                  {s.deliveredVsTarget}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <Stat label="Leads" value={s.leads} />
                <Stat
                  label="Delivery %"
                  value={formatPercent(s.deliveryRate)}
                />
                <Stat label="Delivered" value={s.deliveredUnits} />
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-zinc-400">
                <span>Revenue {formatCurrency(s.revenue)}</span>
                <span>
                  {s.activeReps} reps · {s.lostLeads} lost
                </span>
              </div>

              <div className="mt-2 flex h-2 items-end gap-0.5">
                {s.trend.map((t) => (
                  <div
                    key={t.month}
                    className="flex-1 rounded-sm bg-indigo-200 dark:bg-indigo-900"
                    style={{ height: `${Math.max(8, (t.units / Math.max(...s.trend.map((x) => x.units), 1)) * 24)}px` }}
                    title={`${t.month}: ${t.units}`}
                  />
                ))}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function flatten(
  params: Record<string, string | string[] | undefined>
): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) out[k] = v.join(",");
    else if (v !== undefined) out[k] = v;
  }
  return out;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded bg-zinc-50 py-1.5 dark:bg-zinc-800/50">
      <p className="text-sm font-semibold">{value}</p>
      <p className="text-[11px] text-zinc-400">{label}</p>
    </div>
  );
}