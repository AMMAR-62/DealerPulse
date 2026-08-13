import { getDataset, buildIndex } from "@/lib/data/load";
import { parseSearchParams } from "@/lib/store/filters";
import { buildContext, computeKpis } from "@/lib/engine/metrics";
import { computeForecast } from "@/lib/engine/pipeline";
import { computeAlerts } from "@/lib/engine/alerts";
import AlertsList from "@/components/AlertsList";
import { formatCompactCurrency } from "@/lib/format";

export default async function AlertsPage({
  searchParams,
}: PageProps<"/alerts">) {
  const dataset = getDataset();
  const index = buildIndex(dataset);
  const filters = parseSearchParams(await searchParams);
  const ctx = buildContext(dataset, index, filters);
  const kpis = computeKpis(ctx);
  const forecast = computeForecast(dataset, index, ctx);
  const result = computeAlerts(dataset, index, ctx, forecast);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Alerts</h1>
        <p className="text-sm text-zinc-500">
          Rule-engine flags as of {filters.asOf} — each carries a plain-English
          reason and drills to the exact leads.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-3">
        <CountCard
          label="Critical"
          value={result.counts.critical}
          tone="text-red-600"
        />
        <CountCard
          label="Warnings"
          value={result.counts.warning}
          tone="text-amber-600"
        />
        <CountCard
          label="Info"
          value={result.counts.info}
          tone="text-sky-600"
        />
      </div>

      <div className="mb-6 grid gap-3 rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800 sm:grid-cols-3">
        <p className="text-zinc-500">
          Weighted pipeline value{" "}
          <span className="block text-base font-semibold text-zinc-900 dark:text-zinc-50">
            {formatCompactCurrency(kpis.weightedPipelineValue)}
          </span>
        </p>
        <p className="text-zinc-500">
          Projected units through {forecast.horizonMonth}
          <span className="block text-base font-semibold text-zinc-900 dark:text-zinc-50">
            {forecast.projectedEndUnits.toFixed(0)}
          </span>
        </p>
        <p className="text-zinc-500">
          Gap vs {forecast.horizonMonth} plan
          <span
            className={`block text-base font-semibold ${
              forecast.endGap >= 0
                ? "text-emerald-600"
                : "text-red-600"
            }`}
          >
            {forecast.endGap > 0 ? "+" : ""}
            {forecast.endGap.toFixed(0)}
          </span>
        </p>
      </div>

      <AlertsList alerts={result.alerts} />
    </div>
  );
}

function CountCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 p-3 text-center dark:border-zinc-800">
      <p className={`text-2xl font-semibold ${tone}`}>{value}</p>
      <p className="text-xs text-zinc-500">{label}</p>
    </div>
  );
}