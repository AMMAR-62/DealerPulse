import {
  buildContext,
  computeBranchScorecard,
  computeFunnel,
  computeKpis,
  computeLostByReason,
} from "@/lib/engine/metrics";
import { computeTopAnomalies } from "@/lib/engine/anomalies";
import { getDataset, buildIndex } from "@/lib/data/load";
import { parseSearchParams } from "@/lib/store/filters";
import { formatCurrency, formatPercent, formatCompactCurrency } from "@/lib/format";
import { computeForecast } from "@/lib/engine/pipeline";
import { generateSummary } from "@/lib/engine/summaries";
import ForecastChart from "@/components/ForecastChart";
import AnomalyStrip from "@/components/AnomalyStrip";

export default async function OverviewPage({
  searchParams,
}: PageProps<"/">) {
  const dataset = getDataset();
  const index = buildIndex(dataset);
  const filters = parseSearchParams(await searchParams);
  const ctx = buildContext(dataset, index, filters);
  const kpis = computeKpis(ctx);
  const funnel = computeFunnel(ctx.leads);
  const scorecards = computeBranchScorecard(dataset, index, ctx);
  const lostByReason = computeLostByReason(ctx.leads);
  const forecast = computeForecast(dataset, index, ctx);
  const topAnomalies = computeTopAnomalies(dataset, index, ctx, 3);
  const summary = generateSummary({ dataset, index, ctx, forecast });

  const topReasons = lostByReason.slice(0, 5);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="text-sm text-zinc-500">
          Network performance as of {filters.asOf}
          {filters.role !== "ceo" && ` · scoped as ${filters.role}`}
        </p>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="Total leads" value={kpis.totalLeads} />
        <KpiCard
          label="Delivery rate"
          value={formatPercent(kpis.deliveryRate)}
        />
        <KpiCard label="Units delivered" value={kpis.deliveredUnits} />
        <KpiCard
          label="Pipeline (weighted)"
          value={formatCompactCurrency(kpis.weightedPipelineValue)}
        />
        <KpiCard
          label="Avg days to deliver"
          value={kpis.avgDaysToDeliver.toFixed(1)}
        />
        <KpiCard label="Revenue to date" value={formatCompactCurrency(kpis.revenueToDate)} />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Forecast & pace-to-target</h2>
            <p className="text-xs text-zinc-400">bars: target vs delivered · lines: cumulative</p>
          </div>
          <ForecastChart points={forecast.points} asOf={filters.asOf} />
        </div>

        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="mb-3 text-sm font-semibold">Funnel (current)</h2>
          <FunnelMini funnel={funnel} />
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Executive summary</h2>
          <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800">
            deterministic rule engine · LLM-ready
          </span>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {summary.map((section) => (
            <section key={section.key}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {section.title}
              </h3>
              <ul className="mt-2 space-y-1.5">
                {section.bullets.map((bullet, i) => (
                  <li key={i} className="text-sm text-zinc-700 dark:text-zinc-300">
                    {bullet}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </section>

      {topAnomalies.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-semibold">Top anomalies</h2>
          <AnomalyStrip flags={topAnomalies} />
        </section>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="mb-3 text-sm font-semibold">Lost — top reasons</h2>
          {topReasons.length ? (
            <ul className="space-y-1.5">
              {topReasons.map((r) => (
                <li
                  key={r.reason}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="truncate pr-2 text-zinc-600 dark:text-zinc-300">
                    {r.reason}
                  </span>
                  <span className="font-medium">{r.count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-400">No lost leads in scope.</p>
          )}
        </section>

        <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="mb-3 text-sm font-semibold">Pace vs target</h2>
          <div className="space-y-2 text-sm">
            <Row label="Target units" value={kpis.targetUnits} />
            <Row label="Delivered" value={kpis.deliveredUnits} />
            <Row
              label="Gap to target"
              value={`${kpis.deliveredVsTarget > 0 ? "+" : ""}${kpis.deliveredVsTarget}`}
              tone={kpis.deliveredVsTarget >= 0 ? "good" : "bad"}
            />
            <Row label="Revenue vs target" value={formatCurrency(kpis.revenueVsTarget)} />
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-3 text-sm font-semibold">Branch scorecard</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                <th className="py-2 pr-3">Branch</th>
                <th className="py-2 pr-3">Leads</th>
                <th className="py-2 pr-3">Delivered</th>
                <th className="py-2 pr-3">Delivery %</th>
                <th className="py-2 pr-3">Revenue</th>
                <th className="py-2 pr-3">Target</th>
                <th className="py-2 pr-3">Δ vs target</th>
              </tr>
            </thead>
            <tbody>
              {scorecards.map((s) => (
                <tr
                  key={s.branchId}
                  className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60"
                >
                  <td className="py-2 pr-3 font-medium">{s.name}</td>
                  <td className="py-2 pr-3">{s.leads}</td>
                  <td className="py-2 pr-3">{s.deliveredUnits}</td>
                  <td className="py-2 pr-3">{formatPercent(s.deliveryRate)}</td>
                  <td className="py-2 pr-3">{formatCurrency(s.revenue)}</td>
                  <td className="py-2 pr-3">{s.targetUnits}</td>
                  <td
                    className={`py-2 pr-3 ${s.deliveredVsTarget >= 0 ? "text-emerald-600" : "text-red-600"}`}
                  >
                    {s.deliveredVsTarget > 0 ? "+" : ""}
                    {s.deliveredVsTarget}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function FunnelMini({
  funnel,
}: {
  funnel: {
    stage: string;
    current: number;
    reached: number;
    share: number;
  }[];
}) {
  const max = funnel[0]?.reached || 1;
  return (
    <ul className="space-y-1.5">
      {funnel.map((f) => (
        <li key={f.stage} className="text-sm">
          <div className="flex items-center justify-between">
            <span className="capitalize text-zinc-600 dark:text-zinc-300">
              {f.stage.replace("_", " ")}
            </span>
            <span className="font-medium">{f.current}</span>
          </div>
          <div className="mt-0.5 h-1.5 overflow-hidden rounded bg-zinc-100 dark:bg-zinc-800">
            <div
              className="h-full rounded bg-indigo-500"
              style={{ width: `${Math.max(3, (f.current / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Row({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  tone?: "neutral" | "good" | "bad";
}) {
  const toneClass =
    tone === "good"
      ? "text-emerald-600"
      : tone === "bad"
        ? "text-red-600"
        : "";
  return (
    <div className="flex items-center justify-between">
      <span className="text-zinc-500">{label}</span>
      <span className={`font-medium ${toneClass}`}>{value}</span>
    </div>
  );
}