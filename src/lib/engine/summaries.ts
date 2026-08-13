import type { Dataset } from "../data/types";
import type { DatasetIndex } from "../data/load";
import { formatNumber, formatPercent } from "../format";
import type { FilteredContext } from "./metrics";
import {
  computeBranchScorecard,
  computeConversion,
  computeKpis,
  computeLeadAging,
  computeRepScorecard,
} from "./metrics";
import type { Forecast } from "./pipeline";
import { computeAnomalies } from "./anomalies";

export interface ReportSection {
  key: string;
  title: string;
  bullets: string[];
}

export interface SummaryInput {
  dataset: Dataset;
  index: DatasetIndex;
  ctx: FilteredContext;
  forecast: Forecast;
}

export function generateSummary(input: SummaryInput): ReportSection[] {
  const { dataset, index, ctx, forecast } = input;
  const kpis = computeKpis(ctx);
  const sections: ReportSection[] = [];

  const performance: string[] = [];
  if (kpis.deliveredVsTarget >= 0) {
    performance.push(
      `Pacing ${kpis.deliveredVsTarget} units ahead of the month target (${kpis.deliveredUnits}/${kpis.targetUnits}).`
    );
  } else {
    performance.push(
      `Pacing ${Math.abs(kpis.deliveredVsTarget)} units behind the month target (${kpis.deliveredUnits}/${kpis.targetUnits}).`
    );
  }
  performance.push(
    `Delivery rate is ${formatPercent(kpis.deliveryRate)} across ${formatNumber(kpis.totalLeads)} leads; revenue to date is ${formatRevenue(kpis.revenueToDate)}.`
  );
  if (forecast.endGap < 0) {
    const gap = Math.round(Math.abs(forecast.endGap));
    if (forecast.remainingMonths > 0) {
      performance.push(
        `Projected ${forecast.horizonMonth}: ${Math.round(forecast.projectedEndUnits)} units vs ${forecast.targetEndUnits} plan — a ${gap}-unit gap, with open pipeline expected to add ${Math.round(forecast.expectedWinsAhead)}.`
      );
    } else {
      performance.push(
        `Through ${forecast.horizonMonth}: ${Math.round(forecast.projectedEndUnits)} delivered vs ${forecast.targetEndUnits} planned units — ${gap}-unit gap (${formatPercent(forecast.projectedEndUnits / (forecast.targetEndUnits || 1))} attainment).`
      );
    }
  } else {
    performance.push(
      `Projected ${forecast.horizonMonth}: ${Math.round(forecast.projectedEndUnits)} units vs ${forecast.targetEndUnits} plan — on or above plan.`
    );
  }
  sections.push({
    key: "performance",
    title: "Performance vs target",
    bullets: performance,
  });

  const conversion = computeConversion(ctx.leads);
  const worst = conversion.length
    ? conversion.reduce((a, b) => (a.rate < b.rate ? a : b))
    : null;
  const funnelBullets = [
    `Leads in the open pipeline: ${formatNumber(kpis.openLeads)} across all stages.`,
  ];
  if (worst && worst.rate < 0.5) {
    funnelBullets.push(
      `Biggest leak: ${worst.from} → ${worst.to} at ${formatPercent(worst.rate)} — ${formatNumber(worst.fromCount)} leads reached this stage, only ${formatNumber(worst.toCount)} advanced.`
    );
  }
  sections.push({
    key: "funnel",
    title: "Funnel health",
    bullets: funnelBullets,
  });

  const aging = computeLeadAging(ctx.leads, ctx.filters.asOf, 14);
  const stale = aging.filter((a) => a.stale);
  const riskBullets = [
    `${formatNumber(stale.length)} open leads are stale (no activity ${formatNumber(14)}+ days).`,
    `${formatNumber(kpis.lostLeads)} leads lost in scope; top lost reasons cluster around follow-up and financing.`,
  ];
  sections.push({
    key: "risk",
    title: "At-risk leads",
    bullets: riskBullets,
  });

  const scorecards = computeBranchScorecard(dataset, index, ctx);
  const anomalies = computeAnomalies(dataset, index, ctx).filter(
    (a) => a.severity !== "info"
  );
  const watchBullets: string[] = [];
  const lowest = scorecards.length
    ? scorecards.reduce((a, b) => (a.deliveryRate < b.deliveryRate ? a : b))
    : null;
  if (lowest && scorecards.length > 1) {
    watchBullets.push(
      `${lowest.name} delivers ${formatPercent(lowest.deliveryRate)} of leads (${lowest.deliveredUnits}/${lowest.leads}) — lowest across branches.`
    );
  }
  const reps = computeRepScorecard(dataset, index, ctx, ctx.filters.asOf);
  const topRep = reps[0];
  if (topRep && topRep.leads >= 5) {
    watchBullets.push(
      `${topRep.name} leads the board with ${topRep.deliveredUnits} deliveries at ${formatPercent(topRep.deliveryRate)}.`
    );
  }
  for (const a of anomalies.slice(0, 2)) {
    watchBullets.push(a.reason);
  }
  if (!watchBullets.length) watchBullets.push("No material outliers in scope.");
  sections.push({
    key: "watch",
    title: "Branches & reps to watch",
    bullets: watchBullets,
  });

  const actions: string[] = [];
  if (stale.length) {
    actions.push(
      `Re-engage ${formatNumber(stale.length)} stale leads or disqualify them to keep pipeline clean.`
    );
  }
  if (forecast.endGap < 0) {
    actions.push(
      `Close the ${Math.abs(forecast.endGap).toFixed(0)}-unit pace gap by prioritizing negotiation-stage deals likely to close before ${forecast.horizonMonth}.`
    );
  }
  if (lowest && scorecards.length > 1 && lowest.deliveryRate < 0.15) {
    actions.push(`Investigate ${lowest.name}'s lead quality and follow-up cadence.`);
  }
  actions.push("Review financing approval exposure among lost leads.");
  sections.push({
    key: "actions",
    title: "Recommended next actions",
    bullets: actions,
  });

  return sections;
}

function formatRevenue(value: number): string {
  const lakhs = value / 100000;
  return lakhs >= 100 ? `${(lakhs / 100).toFixed(1)} Cr` : `${lakhs.toFixed(0)} L`;
}