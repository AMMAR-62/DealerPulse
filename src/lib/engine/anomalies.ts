import type { Dataset, Lead } from "../data/types";
import type { DatasetIndex } from "../data/load";
import type { FilteredContext } from "./metrics";
import { computeLeadAging } from "./metrics";

export type AnomalySeverity = "critical" | "warning" | "info";

export interface AnomalyFlag {
  id: string;
  severity: AnomalySeverity;
  category: "conversion" | "activity" | "aging" | "source";
  entityType: "branch" | "rep" | "source" | "network";
  entityId: string;
  entityLabel: string;
  metric: string;
  value: number;
  baseline: number;
  delta: number;
  direction: "high" | "low";
  zScore: number;
  sampleSize: number;
  reason: string;
}

function mean(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance =
    values.reduce((sum, v) => sum + (v - m) * (v - m), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function zScoreOf(value: number, m: number, sd: number): number {
  if (sd === 0) return 0;
  return (value - m) / sd;
}

const MIN_SAMPLE = 10;
const Z_THRESHOLD = 2;

export interface AnomalyConfig {
  minSample?: number;
  zThreshold?: number;
  staleDays?: number;
}

export function computeAnomalies(
  dataset: Dataset,
  index: DatasetIndex,
  ctx: FilteredContext,
  config: AnomalyConfig = {}
): AnomalyFlag[] {
  const minSample = config.minSample ?? MIN_SAMPLE;
  const zThreshold = config.zThreshold ?? Z_THRESHOLD;
  const flags: AnomalyFlag[] = [];

  const leadsByBranch = new Map<string, Lead[]>();
  for (const lead of ctx.leads) {
    const list = leadsByBranch.get(lead.branch_id) ?? [];
    list.push(lead);
    leadsByBranch.set(lead.branch_id, list);
  }

  const branchDeliveryRates: { branchId: string; rate: number; n: number }[] = [];
  for (const [branchId, leads] of leadsByBranch) {
    const n = leads.length;
    if (n < minSample) continue;
    const delivered = leads.filter((l) => l.status === "delivered").length;
    branchDeliveryRates.push({ branchId, rate: delivered / n, n });
  }

  const rates = branchDeliveryRates.map((b) => b.rate);
  const rateMean = mean(rates);
  const rateSd = stdDev(rates);

  for (const b of branchDeliveryRates) {
    if (rates.length < 3) break;
    const z = zScoreOf(b.rate, rateMean, rateSd);
    const isUnder = rateMean > 0 && b.rate <= rateMean * 0.5;
    const isOver = rateMean > 0 && b.rate >= rateMean * 1.5;
    if (Math.abs(z) < zThreshold && !isUnder && !isOver) continue;
    const branch = index.branchesById.get(b.branchId);
    const label = branch?.name ?? b.branchId;
    const direction = b.rate > rateMean ? "high" : "low";
    const severity: AnomalySeverity =
      direction === "low" ? "critical" : "warning";
    const relative =
      direction === "high"
        ? `1.5x the network average`
        : `less than half the network average`;
    flags.push({
      id: `anom-branch-${b.branchId}`,
      severity,
      category: "conversion",
      entityType: "branch",
      entityId: b.branchId,
      entityLabel: label,
      metric: "delivery_rate",
      value: b.rate,
      baseline: rateMean,
      delta: b.rate - rateMean,
      direction,
      zScore: z,
      sampleSize: b.n,
      reason: `${label} converts ${(b.rate * 100).toFixed(1)}% of leads to delivery vs ${(rateMean * 100).toFixed(1)}% network average — ${relative} (${direction === "low" ? "under" : "over"}-performing, z=${z.toFixed(2)}).`,
    });
  }

  const leadsByRep = new Map<string, Lead[]>();
  for (const lead of ctx.leads) {
    const list = leadsByRep.get(lead.assigned_to) ?? [];
    list.push(lead);
    leadsByRep.set(lead.assigned_to, list);
  }

  const repsByBranch = new Map<string, { repId: string; rate: number; n: number }[]>();
  for (const [repId, leads] of leadsByRep) {
    const rep = index.repsById.get(repId);
    if (!rep) continue;
    const n = leads.length;
    if (n < minSample) continue;
    const delivered = leads.filter((l) => l.status === "delivered").length;
    const peerList = repsByBranch.get(rep.branch_id) ?? [];
    peerList.push({ repId, rate: delivered / n, n });
    repsByBranch.set(rep.branch_id, peerList);
  }

  for (const peerList of repsByBranch.values()) {
    if (peerList.length < 3) continue;
    const peerRates = peerList.map((p) => p.rate);
    const pMean = mean(peerRates);
    const pSd = stdDev(peerRates);
    for (const p of peerList) {
      const z = zScoreOf(p.rate, pMean, pSd);
      const isUnder = pMean > 0 && p.rate <= pMean * 0.5;
      const isOver = pMean > 0 && p.rate >= pMean * 1.5;
      if (Math.abs(z) < zThreshold && !isUnder && !isOver) continue;
      const rep = index.repsById.get(p.repId);
      const label = rep?.name ?? p.repId;
      const direction = p.rate > pMean ? "high" : "low";
      const severity: AnomalySeverity =
        direction === "high" ? "warning" : "critical";
      const relative =
        direction === "high"
          ? "1.5x the peer average"
          : "less than half the peer average";
      flags.push({
        id: `anom-rep-${p.repId}`,
        severity,
        category: "conversion",
        entityType: "rep",
        entityId: p.repId,
        entityLabel: label,
        metric: "delivery_rate",
        value: p.rate,
        baseline: pMean,
        delta: p.rate - pMean,
        direction,
        zScore: z,
        sampleSize: p.n,
        reason: `${label} converts ${(p.rate * 100).toFixed(1)}% vs ${(pMean * 100).toFixed(1)}% branch peer average — ${relative} (z=${z.toFixed(2)}).`,
      });
    }
  }

  const staleDays = config.staleDays ?? 14;
  const aging = computeLeadAging(ctx.leads, ctx.filters.asOf, staleDays);
  const staleByBranch = new Map<string, number>();
  for (const row of aging) {
    if (!row.stale) continue;
    staleByBranch.set(
      row.lead.branch_id,
      (staleByBranch.get(row.lead.branch_id) ?? 0) + 1
    );
  }

  for (const [branchId, count] of staleByBranch) {
    if (count < 5) continue;
    const branch = index.branchesById.get(branchId);
    const label = branch?.name ?? branchId;
    const total = leadsByBranch.get(branchId)?.length ?? 0;
    const share = total ? count / total : 0;
    const severity: AnomalySeverity =
      count >= 12 || share >= 0.15 ? "critical" : count >= 8 ? "warning" : "info";
    flags.push({
      id: `anom-stale-${branchId}`,
      severity,
      category: "aging",
      entityType: "branch",
      entityId: branchId,
      entityLabel: label,
      metric: "stale_leads",
      value: count,
      baseline: 0,
      delta: count,
      direction: "high",
      zScore: 0,
      sampleSize: total,
      reason: `${count} open lead${count === 1 ? "" : "s"} at ${label} have had no activity for ${staleDays}+ days (${share >= 0.15 ? Math.round(share * 100) + "% of " : ""}${total} total leads).`,
    });
  }

  const sourceGroups = new Map<string, Lead[]>();
  for (const lead of ctx.leads) {
    const list = sourceGroups.get(lead.source) ?? [];
    list.push(lead);
    sourceGroups.set(lead.source, list);
  }

  const sourceStats = [...sourceGroups.entries()]
    .filter(([, leads]) => leads.length >= minSample)
    .map(([source, leads]) => {
      const delivered = leads.filter((l) => l.status === "delivered").length;
      return { source, rate: delivered / leads.length, n: leads.length };
    });

  if (sourceStats.length >= 3) {
    const srcRates = sourceStats.map((s) => s.rate);
    const sMean = mean(srcRates);
    const sSd = stdDev(srcRates);
    for (const s of sourceStats) {
      const z = zScoreOf(s.rate, sMean, sSd);
      const isUnder = sMean > 0 && s.rate <= sMean * 0.5;
      const isOver = sMean > 0 && s.rate >= sMean * 1.5;
      if (Math.abs(z) < zThreshold && !isUnder && !isOver) continue;
      const direction = s.rate > sMean ? "high" : "low";
      const relative =
        direction === "high"
          ? "1.5x the all-source average"
          : "less than half the all-source average";
      flags.push({
        id: `anom-source-${s.source}`,
        severity: direction === "low" ? "warning" : "info",
        category: "source",
        entityType: "source",
        entityId: s.source,
        entityLabel: s.source,
        metric: "delivery_rate",
        value: s.rate,
        baseline: sMean,
        delta: s.rate - sMean,
        direction,
        zScore: z,
        sampleSize: s.n,
        reason: `${s.source} leads deliver at ${(s.rate * 100).toFixed(1)}% vs ${(sMean * 100).toFixed(1)}% across sources — ${relative} (z=${z.toFixed(2)}).`,
      });
    }
  }

  return flags.sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || b.sampleSize - a.sampleSize);
}

export function severityRank(severity: AnomalySeverity): number {
  return severity === "critical" ? 0 : severity === "warning" ? 1 : 2;
}

export function computeTopAnomalies(
  dataset: Dataset,
  index: DatasetIndex,
  ctx: FilteredContext,
  count = 3
): AnomalyFlag[] {
  return computeAnomalies(dataset, index, ctx).slice(0, count);
}