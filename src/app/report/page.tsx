import { getDataset, buildIndex } from "@/lib/data/load";
import { parseSearchParams } from "@/lib/store/filters";
import { buildContext, computeKpis, computeFunnel } from "@/lib/engine/metrics";
import { computeForecast } from "@/lib/engine/pipeline";
import { computeAnomalies } from "@/lib/engine/anomalies";
import { generateSummary } from "@/lib/engine/summaries";
import { computeAlerts } from "@/lib/engine/alerts";
import { formatCurrency, formatPercent, formatNumber } from "@/lib/format";
import PrintButton from "@/components/PrintButton";

export default async function ReportPage({
  searchParams,
}: PageProps<"/report">) {
  const dataset = getDataset();
  const index = buildIndex(dataset);
  const filters = parseSearchParams(await searchParams);
  const ctx = buildContext(dataset, index, filters);
  const asOf = filters.asOf;

  const kpis = computeKpis(ctx);
  const funnel = computeFunnel(ctx.leads);
  const forecast = computeForecast(dataset, index, ctx);
  const anomalies = computeAnomalies(dataset, index, ctx);
  const sections = generateSummary({ dataset, index, ctx, forecast });
  const alerts = computeAlerts(dataset, index, ctx, forecast);

  const anomaliesInScope = anomalies.filter(
    (a) =>
      ctx.filters.branches.length === 0 ||
      a.entityType === "network" ||
      (a.entityType === "branch" && ctx.filters.branches.includes(a.entityId)) ||
      (a.entityType === "rep" && ctx.filters.reps.includes(a.entityId))
  );

  const scopeLabel =
    ctx.filters.role === "rep" && ctx.filters.reps.length
      ? index.repsById.get(ctx.filters.reps[0])?.name ?? "Sales rep"
      : ctx.filters.role === "manager" && ctx.filters.branches.length
        ? index.branchesById.get(ctx.filters.branches[0])?.name ?? "Branch"
        : "Network";

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Executive Report
          </h1>
          <p className="text-sm text-zinc-500">
            Point-in-time snapshot for {scopeLabel} · as of {asOf} · generated{" "}
            {new Date().toISOString().slice(0, 10)}
          </p>
        </div>
        <PrintButton />
      </div>

      <div className="report-sheet space-y-6 rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
        <header>
          <h1 className="text-xl font-semibold tracking-tight">DealerPulse</h1>
          <p className="text-sm text-zinc-500">
            Executive report · {scopeLabel} · as of {asOf}
          </p>
        </header>

        <section>
          <h2 className="mb-2 text-sm font-semibold">Headline KPIs</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label="Delivered" value={formatNumber(kpis.deliveredUnits)} note={`${formatPercent(kpis.deliveryRate)} rate`} />
            <Kpi label="Revenue to date" value={formatCurrency(kpis.revenueToDate)} note="delivered deals" />
            <Kpi label="Open pipeline" value={formatNumber(kpis.openLeads)} note={`${formatCurrency(kpis.weightedPipelineValue)} weighted`} />
            <Kpi label="Plan attainment" value={formatPercent(kpis.deliveredUnits / (kpis.targetUnits || 1))} note={`${kpis.deliveredVsTarget >= 0 ? "+" : ""}${kpis.deliveredVsTarget} vs target`} />
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold">Executive summary</h2>
          <ul className="space-y-1.5 text-sm">
            {sections.map((s) => (
              <li key={s.key}>
                <span className="font-medium capitalize">{s.title.replace(/-/g, " ")}:</span>{" "}
                {s.bullets[0]}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold">Funnel snapshot</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                <th className="py-1.5 pr-3">Stage</th>
                <th className="py-1.5 pr-3">Current</th>
                <th className="py-1.5">Reached</th>
              </tr>
            </thead>
            <tbody>
              {funnel.map((f) => (
                <tr key={f.stage} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
                  <td className="py-1.5 pr-3 capitalize">{f.stage.replace("_", " ")}</td>
                  <td className="py-1.5 pr-3">{f.current}</td>
                  <td className="py-1.5">{f.reached}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold">Top risks and alerts</h2>
          {alerts.alerts.length ? (
            <ul className="space-y-1.5 text-sm">
              {alerts.alerts.slice(0, 8).map((a) => (
                <li key={a.id}>
                  <span className="mr-1.5 rounded bg-zinc-100 px-1.5 text-xs font-medium uppercase text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    {a.category}
                  </span>
                  {a.reason}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">No alerts in scope.</p>
          )}
        </section>

        {anomaliesInScope.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-semibold">Anomalies</h2>
            <ul className="space-y-1.5 text-sm">
              {anomaliesInScope.slice(0, 8).map((a) => (
                <li key={a.id}>
                  <span className="mr-1.5 rounded bg-amber-100 px-1.5 text-xs font-medium uppercase text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                    {a.entityType}
                  </span>
                  {a.reason}
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="pt-4 text-xs text-zinc-400">
          Generated by DealerPulse from a synthetic dealership dataset · Jun–Dec
          2025. Point-in-time analytics as of {asOf}.
        </footer>
      </div>
    </div>
  );
}

function Kpi({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
      {note && <div className="text-xs text-zinc-400">{note}</div>}
    </div>
  );
}