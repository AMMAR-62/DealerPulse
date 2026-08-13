import { getDataset, buildIndex } from "@/lib/data/load";
import { parseSearchParams } from "@/lib/store/filters";
import { monthKey } from "@/lib/data/load";
import { buildContext } from "@/lib/engine/metrics";
import {
  computeConversion,
  computeFunnel,
  computeSourceRoi,
  computeStageDwell,
} from "@/lib/engine/metrics";
import { FUNNEL_ORDER } from "@/lib/data/types";
import { formatPercent } from "@/lib/format";
import FunnelBars from "@/components/FunnelBars";

export default async function FunnelPage({
  searchParams,
}: PageProps<"/funnel">) {
  const dataset = getDataset();
  const index = buildIndex(dataset);
  const filters = parseSearchParams(await searchParams);
  const ctx = buildContext(dataset, index, filters);

  const funnel = computeFunnel(ctx.leads);
  const conversion = computeConversion(ctx.leads);
  const conversionMap = new Map(conversion.map((c) => [`${c.from}→${c.to}`, c.rate]));
  const funnelRows = funnel.map((f, i) => ({
    ...f,
    conversion:
      i > 0 && i < funnel.length - 1
        ? conversionMap.get(`${funnel[i - 1].stage}→${f.stage}`)
        : undefined,
  }));

  const dwell = computeStageDwell(ctx.leads, filters.asOf);
  const sources = computeSourceRoi(ctx);

  const models = [...new Set(ctx.leads.map((l) => l.model_interested))].sort();
  const modelRows = models.map((model) => {
    const leads = ctx.leads.filter((l) => l.model_interested === model);
    const funnel = computeFunnel(leads);
    const byStage = new Map(funnel.map((f) => [f.stage, f.current]));
    return {
      model,
      leads: leads.length,
      new: byStage.get("new") ?? 0,
      contacted: byStage.get("contacted") ?? 0,
      testDrive: byStage.get("test_drive") ?? 0,
      negotiation: byStage.get("negotiation") ?? 0,
      orderPlaced: byStage.get("order_placed") ?? 0,
      delivered: byStage.get("delivered") ?? 0,
      lost: byStage.get("lost") ?? 0,
    };
  });

  const monthRows = buildMonthMatrix(ctx.leads);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Funnel</h1>
        <p className="text-sm text-zinc-500">
          Stage progression, dwell time, and layer views · as of {filters.asOf}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="mb-3 text-sm font-semibold">Stage conversion funnel</h2>
          <FunnelBars rows={funnelRows} asOfNote={`${ctx.leads.length} leads in scope`} />
        </section>

        <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="mb-3 text-sm font-semibold">Dwell time per stage</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                <th className="py-2 pr-3">Stage</th>
                <th className="py-2 pr-3">Leads</th>
                <th className="py-2 pr-3">Avg days</th>
                <th className="py-2 pr-3">Median</th>
                <th className="py-2 pr-3">P90</th>
              </tr>
            </thead>
            <tbody>
              {dwell.map((d) => (
                <tr key={d.stage} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
                  <td className="py-2 pr-3 capitalize">{d.stage.replace("_", " ")}</td>
                  <td className="py-2 pr-3">{d.count}</td>
                  <td className="py-2 pr-3">{d.avgDays.toFixed(1)}</td>
                  <td className="py-2 pr-3">{d.medianDays.toFixed(1)}</td>
                  <td className="py-2 pr-3">{d.p90Days.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-zinc-400">
            Dwell = days from entering a stage to leaving it (capped at as-of).
          </p>
        </section>
      </div>

      <section className="mt-6 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-3 text-sm font-semibold">Month-over-month (created-by-month, current status)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                <th className="py-2 pr-3">Month</th>
                {FUNNEL_ORDER.map((s) => (
                  <th key={s} className="py-2 pr-3 capitalize">
                    {s.replace("_", " ")}
                  </th>
                ))}
                <th className="py-2 pr-3">Lost</th>
              </tr>
            </thead>
            <tbody>
              {monthRows.map((m) => (
                <tr key={m.month} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
                  <td className="py-2 pr-3 font-medium">{m.month}</td>
                  {FUNNEL_ORDER.map((s) => (
                    <td key={s} className="py-2 pr-3">
                      {m.stages[s]}
                    </td>
                  ))}
                  <td className="py-2 pr-3 text-red-600">{m.lost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="mb-3 text-sm font-semibold">Source-channel conversion</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                <th className="py-2 pr-3">Source</th>
                <th className="py-2 pr-3">Leads</th>
                <th className="py-2 pr-3">Delivered %</th>
                <th className="py-2 pr-3">Lost %</th>
                <th className="py-2 pr-3">Avg days</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.source} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
                  <td className="py-2 pr-3 font-medium">{s.source}</td>
                  <td className="py-2 pr-3">{s.leads}</td>
                  <td className="py-2 pr-3">{formatPercent(s.deliveredRate)}</td>
                  <td className="py-2 pr-3">{formatPercent(s.lostRate)}</td>
                  <td className="py-2 pr-3">{s.avgDaysToDeliver.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="mb-3 text-sm font-semibold">Model-level funnel</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                  <th className="py-2 pr-3">Model</th>
                  <th className="py-2 pr-3">Leads</th>
                  <th className="py-2 pr-3">Delivered</th>
                  <th className="py-2 pr-3">Lost</th>
                </tr>
              </thead>
              <tbody>
                {modelRows.map((m) => (
                  <tr key={m.model} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
                    <td className="py-2 pr-3 font-medium">{m.model}</td>
                    <td className="py-2 pr-3">{m.leads}</td>
                    <td className="py-2 pr-3">{m.delivered}</td>
                    <td className="py-2 pr-3 text-red-600">{m.lost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-zinc-400">
            Models with meaningful volume drive the delivery split.
          </p>
        </section>
      </div>
    </div>
  );
}

function buildMonthMatrix(
  leads: { created_at: string; status: string }[]
): { month: string; stages: Record<string, number>; lost: number }[] {
  const byMonth = new Map<string, Record<string, number>>();
  for (const lead of leads) {
    const m = monthKey(lead.created_at);
    const row = byMonth.get(m) ?? {};
    row[lead.status] = (row[lead.status] ?? 0) + 1;
    byMonth.set(m, row);
  }
  return [...byMonth.entries()]
    .map(([month, stages]) => ({
      month,
      stages,
      lost: stages["lost"] ?? 0,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}