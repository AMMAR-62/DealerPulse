import Link from "next/link";
import { getDataset, buildIndex } from "@/lib/data/load";
import { parseSearchParams, buildQueryString, updateParam } from "@/lib/store/filters";
import { buildContext, computeRepScorecard } from "@/lib/engine/metrics";
import { computeAnomalies } from "@/lib/engine/anomalies";
import { formatCurrency, formatPercent } from "@/lib/format";
import RepDetail from "./RepDetail";

export default async function RepsPage({
  searchParams,
}: PageProps<"/reps">) {
  const dataset = getDataset();
  const index = buildIndex(dataset);
  const current = await searchParams;
  const filters = parseSearchParams(current);
  const ctx = buildContext(dataset, index, filters);

  if (filters.reps.length === 1) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6">
        <RepDetail
          index={index}
          ctx={ctx}
          repId={filters.reps[0]}
          currentParams={current}
        />
      </div>
    );
  }

  const reps = computeRepScorecard(dataset, index, ctx, filters.asOf);
  const anomalyRepIds = new Set(
    computeAnomalies(dataset, index, ctx)
      .filter((a) => a.entityType === "rep")
      .map((a) => a.entityId)
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reps</h1>
          <p className="text-sm text-zinc-500">
            Leaderboard by delivered units · as of {filters.asOf}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
              <th className="py-2 pl-4 pr-3">#</th>
              <th className="py-2 pr-3">Rep</th>
              <th className="py-2 pr-3">Branch</th>
              <th className="py-2 pr-3">Leads</th>
              <th className="py-2 pr-3">Delivered</th>
              <th className="py-2 pr-3">Delivery %</th>
              <th className="py-2 pr-3">Revenue</th>
              <th className="py-2 pr-3">Lost</th>
              <th className="py-2 pr-3">Avg days</th>
              <th className="py-2 pr-3">Inactive</th>
            </tr>
          </thead>
          <tbody>
            {reps.map((r, i) => {
              const href = `/reps${buildQueryString(updateParam(flatten(current), "rep", [r.repId]))}`;
              const flagged = anomalyRepIds.has(r.repId);
              return (
                <tr
                  key={r.repId}
                  className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-900/50"
                >
                  <td className="py-2 pl-4 pr-3 text-zinc-400">{i + 1}</td>
                  <td className="py-2 pr-3">
                    <LinkRow
                      href={href}
                      name={r.name}
                      role={r.role}
                      flagged={flagged}
                    />
                  </td>
                  <td className="py-2 pr-3">{r.branchName}</td>
                  <td className="py-2 pr-3">{r.leads}</td>
                  <td className="py-2 pr-3 font-medium">{r.deliveredUnits}</td>
                  <td className="py-2 pr-3">{formatPercent(r.deliveryRate)}</td>
                  <td className="py-2 pr-3">{formatCurrency(r.revenue)}</td>
                  <td className="py-2 pr-3 text-zinc-500">{r.lostLeads}</td>
                  <td className="py-2 pr-3">{r.avgDaysToDeliver.toFixed(1)}</td>
                  <td
                    className={`py-2 pr-4 ${r.daysSinceLastActivity > 7 ? "text-red-600" : "text-zinc-400"}`}
                  >
                    {r.daysSinceLastActivity >= 0
                      ? `${r.daysSinceLastActivity}d`
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {reps.length === 0 && (
        <p className="mt-6 rounded-lg border border-zinc-200 p-6 text-center text-sm text-zinc-500 dark:border-zinc-800">
          No reps in scope for the current filters.
        </p>
      )}
      <p className="mt-2 text-xs text-zinc-400">{index.branchIds.length} branches across the network.</p>
    </div>
  );
}

function LinkRow({
  href,
  name,
  role,
  flagged,
}: {
  href: string;
  name: string;
  role: string;
  flagged: boolean;
}) {
  return (
    <LinkCell href={href}>
      <LinkBody name={name} role={role} flagged={flagged} />
    </LinkCell>
  );
}

function LinkCell({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="group flex items-center gap-2">
      {children}
    </Link>
  );
}

function LinkBody({
  name,
  role,
  flagged,
}: {
  name: string;
  role: string;
  flagged: boolean;
}) {
  return (
    <>
      <span className="font-medium underline-offset-2 group-hover:underline">
        {name}
      </span>
      {role === "branch_manager" && (
        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          Mgr
        </span>
      )}
      {flagged && (
        <span
          className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-950 dark:text-red-300"
          title="Has an anomaly flag"
        >
          !
        </span>
      )}
    </>
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