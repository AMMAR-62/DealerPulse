import { getDataset, buildIndex } from "@/lib/data/load";
import { parseSearchParams } from "@/lib/store/filters";
import {
  buildContext,
  computeConversion,
  computeDeliveryDelays,
  computeFunnel,
  computeLostByReason,
  computeSourceRoi,
} from "@/lib/engine/metrics";
import { formatPercent } from "@/lib/format";
import FunnelBars from "@/components/FunnelBars";
import Breadcrumb from "@/components/Breadcrumb";
import { LostReasonPie, SourceBarChart } from "@/components/AnalyticsCharts";

export default async function AnalyticsPage({
  searchParams,
}: PageProps<"/analytics">) {
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

  const lost = computeLostByReason(ctx.leads);
  const lostTotal = lost.reduce((s, r) => s + r.count, 0);

  const delays = computeDeliveryDelays(ctx);
  const sources = computeSourceRoi(ctx);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <Breadcrumb items={[{ label: "Analytics" }]} />

      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Analytics &amp; insights
        </h1>
        <p className="text-sm text-zinc-500">
          Company-wide funnel, lost reasons, delivery delays, and source
          performance · as of {filters.asOf}
        </p>
      </div>

      <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-3 text-sm font-semibold">Sales funnel summary</h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <FunnelBars
            rows={funnelRows}
            asOfNote={`${ctx.leads.length} leads in scope`}
          />
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                <th className="py-2 pr-3">Stage</th>
                <th className="py-2 pr-3 text-right">Reached</th>
                <th className="py-2 pr-3 text-right">% of funnel</th>
                <th className="py-2 pr-3 text-right">Drop-off</th>
              </tr>
            </thead>
            <tbody>
              {funnelRows.map((f) => {
                const drop = f.conversion !== undefined ? 1 - f.conversion : 0;
                return (
                  <tr
                    key={f.stage}
                    className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60"
                  >
                    <td className="py-2 pr-3 capitalize">{f.stage.replace("_", " ")}</td>
                    <td className="py-2 pr-3 text-right font-medium">{f.reached}</td>
                    <td className="py-2 pr-3 text-right">{formatPercent(f.share)}</td>
                    <td className="py-2 pr-3 text-right">
                      {f.conversion === undefined ? (
                        <span className="text-zinc-300 dark:text-zinc-600">—</span>
                      ) : (
                        <span
                          className={
                            drop > 0.3
                              ? "text-red-600"
                              : drop > 0.15
                                ? "text-amber-600"
                                : "text-emerald-600"
                          }
                        >
                          ↓ {formatPercent(drop)} drop
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-3 text-sm font-semibold">Lost reason breakdown</h2>
        <p className="mb-4 text-xs text-zinc-400">
          {lostTotal} lost leads with reasons recorded
        </p>
        <div className="grid gap-6 lg:grid-cols-2">
          <LostReasonPie data={lost} />
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                <th className="py-2 pr-3">Reason</th>
                <th className="py-2 pr-3 text-right">Count</th>
                <th className="py-2 pr-3 text-right">% of lost</th>
              </tr>
            </thead>
            <tbody>
              {lost.map((r) => (
                <tr
                  key={r.reason}
                  className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60"
                >
                  <td className="py-2 pr-3">{r.reason}</td>
                  <td className="py-2 pr-3 text-right font-medium">{r.count}</td>
                  <td className="py-2 pr-3 text-right text-zinc-500">
                    {formatPercent(lostTotal ? r.count / lostTotal : 0)}
                  </td>
                </tr>
              ))}
              {lost.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-4 text-center text-sm text-zinc-400">
                    No lost leads in scope.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-3 text-sm font-semibold">Delivery delay analysis</h2>
        <p className="mb-4 text-xs text-zinc-400">
          Breakdown of delayed deliveries and average time to deliver
        </p>
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Total deliveries" value={delays.totalDeliveries} />
          <StatCard
            label="Delayed"
            value={delays.delayed}
            sub={`${formatPercent(delays.delayedRate)} of total`}
            tone="bad"
          />
          <StatCard
            label="On time"
            value={delays.onTime}
            sub={`${formatPercent(1 - delays.delayedRate)} of total`}
            tone="good"
          />
          <StatCard
            label="Avg days"
            value={delays.avgDaysToDeliver.toFixed(1)}
            sub="Lead to delivery"
          />
        </div>

        <div className="mb-6 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="mb-3 flex items-center justify-between gap-4">
            <span className="text-sm font-semibold">Delivery timeliness</span>
            <span className="shrink-0 text-xs text-zinc-500">
              {delays.onTime} on time · {delays.delayed} delayed
            </span>
          </div>
          <div className="flex h-3 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
            <div
              className="h-full bg-emerald-500"
              style={{ width: `${(1 - delays.delayedRate) * 100}%` }}
            />
            <div
              className="h-full bg-rose-500"
              style={{ width: `${delays.delayedRate * 100}%` }}
            />
          </div>
          <div className="mt-3 grid grid-cols-2 text-[11px] font-medium">
            <span className="text-emerald-600 dark:text-emerald-400">
              ● On time {formatPercent(1 - delays.delayedRate)}
            </span>
            <span className="text-right text-rose-600 dark:text-rose-400">
              ● Delayed {formatPercent(delays.delayedRate)}
            </span>
          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
              <th className="py-2 pr-3">Delay reason</th>
              <th className="py-2 pr-3 text-right">Count</th>
              <th className="py-2 pr-3 text-right">Share</th>
              <th className="w-1/3 py-2 pr-3">Distribution</th>
            </tr>
          </thead>
          <tbody>
            {delays.breakdown.map((row) => (
              <tr
                key={row.reason}
                className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60"
              >
                <td className="py-2 pr-3">{row.reason}</td>
                <td className="py-2 pr-3 text-right font-medium">{row.count}</td>
                <td className="py-2 pr-3 text-right">
                  <span className="inline-block rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-bold text-rose-700 ring-1 ring-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-800">
                    {formatPercent(row.share)}
                  </span>
                </td>
                <td className="py-2 pr-3">
                  <div className="h-2.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                    <div
                      className="h-full rounded-full bg-indigo-500"
                      style={{ width: `${row.share * 100}%` }}
                    />
                  </div>
                </td>
              </tr>
            ))}
            {delays.breakdown.length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-center text-sm text-zinc-400">
                  No delayed deliveries in scope.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="mt-6 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-3 text-sm font-semibold">Lead source performance</h2>
        <p className="mb-4 text-xs text-zinc-400">
          Conversion rates by lead acquisition channel
        </p>
        <div className="grid gap-6 lg:grid-cols-2">
          <SourceBarChart data={sources} />
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                <th className="py-2 pr-3">Source</th>
                <th className="py-2 pr-3 text-right">Total</th>
                <th className="py-2 pr-3 text-right">Delivered</th>
                <th className="py-2 pr-3 text-right">Conversion</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr
                  key={s.source}
                  className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60"
                >
                  <td className="py-2 pr-3 font-medium">{s.source}</td>
                  <td className="py-2 pr-3 text-right">{s.leads}</td>
                  <td className="py-2 pr-3 text-right">{s.delivered}</td>
                  <td className="py-2 pr-3 text-right">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                        s.deliveredRate >= 0.4
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                          : s.deliveredRate >= 0.2
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                            : "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
                      }`}
                    >
                      {formatPercent(s.deliveredRate)}
                    </span>
                  </td>
                </tr>
              ))}
              {sources.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-sm text-zinc-400">
                    No leads in scope.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "neutral" | "good" | "bad";
}) {
  const toneClass =
    tone === "good"
      ? "text-emerald-600"
      : tone === "bad"
        ? "text-rose-600"
        : "text-zinc-900 dark:text-zinc-50";
  return (
    <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-semibold ${toneClass}`}>{value}</p>
      {sub && <p className="text-xs text-zinc-400">{sub}</p>}
    </div>
  );
}