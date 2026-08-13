import type { Dataset, Lead } from "../data/types";
import { OPEN_STAGES, type FunnelStage } from "../data/types";
import { monthKey } from "../data/load";
import type { FilteredContext } from "./metrics";
import type { DatasetIndex } from "../data/load";

export interface StageProbability {
  stage: string;
  prob: number;
}

const TRANSITION_ORDER: { from: FunnelStage; to: FunnelStage }[] = [
  { from: "new", to: "contacted" },
  { from: "contacted", to: "test_drive" },
  { from: "test_drive", to: "negotiation" },
  { from: "negotiation", to: "order_placed" },
  { from: "order_placed", to: "delivered" },
];

const FALLBACK_STAGE_PROB: Record<string, number> = {
  new: 0.31,
  contacted: 0.41,
  test_drive: 0.53,
  negotiation: 0.68,
  order_placed: 0.81,
};

export function deriveStageProbabilities(dataset: Dataset): Record<string, number> {
  const reached = new Map<string, number>();
  for (const lead of dataset.leads) {
    for (const event of lead.status_history) {
      reached.set(event.status, (reached.get(event.status) ?? 0) + 1);
    }
  }

  const perStage: Record<string, number> = {};
  for (const { from, to } of TRANSITION_ORDER) {
    const fromCount = reached.get(from) ?? 0;
    const toCount = reached.get(to) ?? 0;
    if (fromCount > 0 && toCount > 0) {
      perStage[from] = toCount / fromCount;
    }
  }

  const probabilities: Record<string, number> = {};
  let cumulative = 1;
  for (let i = TRANSITION_ORDER.length - 1; i >= 0; i--) {
    const stage = TRANSITION_ORDER[i].from;
    const step = perStage[stage] ?? FALLBACK_STAGE_PROB[stage] ?? 1;
    cumulative *= step;
    probabilities[stage] = cumulative;
  }

  for (const stage of Object.keys(FALLBACK_STAGE_PROB)) {
    if (probabilities[stage] === undefined) {
      probabilities[stage] = FALLBACK_STAGE_PROB[stage];
    }
  }

  return probabilities;
}

export interface PipelineBuckets {
  stage: string;
  leads: number;
  value: number;
  weightedValue: number;
  prob: number;
  expectedWins: number;
}

export function computePipelineBuckets(
  leads: Lead[],
  probabilities: Record<string, number>
): PipelineBuckets[] {
  return OPEN_STAGES.map((stage) => {
    const inStage = leads.filter((l) => l.status === stage);
    const value = inStage.reduce((sum, l) => sum + (l.deal_value || 0), 0);
    const prob = probabilities[stage] ?? 0;
    return {
      stage,
      leads: inStage.length,
      value,
      weightedValue: value * prob,
      prob,
      expectedWins: inStage.length * prob,
    };
  });
}

export interface ForecastPoint {
  month: string;
  targetUnits: number;
  actualDelivered: number;
  expectedWins: number;
  bestWins: number;
  projectedCumulative: number;
  targetCumulative: number;
  actualCumulative: number;
  bestCumulative: number;
  gapCumulative: number;
  isForecast: boolean;
}

export interface Forecast {
  points: ForecastPoint[];
  probabilities: Record<string, number>;
  horizonMonth: string;
  projectedEndUnits: number;
  targetEndUnits: number;
  endGap: number;
  expectedWinsAhead: number;
  remainingMonths: number;
  pacePerMonth: number;
  requiredPerMonth: number;
}

export function computeForecast(
  dataset: Dataset,
  index: DatasetIndex,
  ctx: FilteredContext,
  horizonMonths = 6
): Forecast {
  const probabilities = deriveStageProbabilities(dataset);

  const branchSet = new Set(
    ctx.filters.branches.length ? ctx.filters.branches : index.branchIds
  );

  const targetByMonth = new Map<string, number>();
  for (const target of dataset.targets) {
    if (!branchSet.has(target.branch_id)) continue;
    targetByMonth.set(target.month, (targetByMonth.get(target.month) ?? 0) + target.target_units);
  }

  const deliveredByMonth = new Map<string, number>();
  for (const delivery of ctx.deliveries) {
    const m = monthKey(delivery.delivery_date);
    deliveredByMonth.set(m, (deliveredByMonth.get(m) ?? 0) + 1);
  }

  const expectedByMonth = new Map<string, number>();
  const bestByMonth = new Map<string, number>();
  for (const lead of ctx.leads) {
    if (!OPEN_STAGES.includes(lead.status as (typeof OPEN_STAGES)[number])) continue;
    const closeMonth = monthKey(lead.expected_close_date);
    const prob = probabilities[lead.status] ?? 0;
    expectedByMonth.set(closeMonth, (expectedByMonth.get(closeMonth) ?? 0) + prob);
    bestByMonth.set(closeMonth, (bestByMonth.get(closeMonth) ?? 0) + 1);
  }

  const months = [...new Set([...targetByMonth.keys(), ...deliveredByMonth.keys()])].sort();
  const startIndex = months.indexOf(ctx.filters.asOf.slice(0, 7));
  const horizonStart = startIndex >= 0 ? startIndex : months.length - 1;
  const horizonMonthsList = months.slice(0, Math.min(months.length, horizonStart + horizonMonths + 1));

  let actualCumulative = 0;
  let projectedCumulative = 0;
  let targetCumulative = 0;
  let bestCumulative = 0;
  const points: ForecastPoint[] = [];
  const asOf = ctx.filters.asOf;

  for (const month of horizonMonthsList) {
    const actual = deliveredByMonth.get(month) ?? 0;
    const expected = expectedByMonth.get(month) ?? 0;
    const best = bestByMonth.get(month) ?? 0;
    const target = targetByMonth.get(month) ?? 0;
    const isForecast = month > asOf.slice(0, 7);
    const monthProjected = isForecast ? expected : actual;

    actualCumulative += actual;
    projectedCumulative += monthProjected;
    targetCumulative += target;
    bestCumulative += isForecast ? best : 0;

    points.push({
      month,
      targetUnits: target,
      actualDelivered: actual,
      expectedWins: expected,
      bestWins: best,
      projectedCumulative,
      targetCumulative,
      actualCumulative,
      bestCumulative: actualCumulative + bestCumulative,
      gapCumulative: projectedCumulative - targetCumulative,
      isForecast,
    });
  }

  const last = points[points.length - 1];
  const endGap = last ? last.gapCumulative : 0;
  const projectedEndUnits = last ? last.projectedCumulative : 0;
  const targetEndUnits = last ? last.targetCumulative : 0;

  const forecastPoints = points.filter((p) => p.isForecast);
  const expectedWinsAhead = forecastPoints.reduce(
    (sum, p) => sum + p.expectedWins,
    0
  );
  const pacePerMonth = forecastPoints.length
    ? expectedWinsAhead / forecastPoints.length
    : 0;
  const requiredPerMonth = forecastPoints.length
    ? Math.max(0, targetEndUnits - projectedEndUnits) / forecastPoints.length
    : 0;

  return {
    points,
    probabilities,
    horizonMonth: last?.month ?? "",
    projectedEndUnits,
    targetEndUnits,
    endGap,
    expectedWinsAhead,
    remainingMonths: forecastPoints.length,
    pacePerMonth,
    requiredPerMonth,
  };
}

export function computeMonthEndProjection(forecast: Forecast): {
  month: string;
  projected: number;
  target: number;
  gap: number;
} {
  const last = forecast.points[forecast.points.length - 1];
  return {
    month: last?.month ?? "",
    projected: last?.projectedCumulative ?? 0,
    target: last?.targetCumulative ?? 0,
    gap: last?.gapCumulative ?? 0,
  };
}