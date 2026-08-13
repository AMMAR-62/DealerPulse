import type { Dataset, Lead } from "../data/types";
import type { DatasetIndex } from "../data/load";
import type { FilteredContext } from "../engine/metrics";
import {
  computeAging,
  computeBranchScorecard,
  computeConversion,
  computeFunnel,
  computeKpis,
  computeLeadAging,
  computeLostByReason,
  computeMonthlySeries,
  computeRepScorecard,
  computeSourceRoi,
  computeStageDwell,
  type BranchScorecard,
  type ConversionStep,
  type FunnelBucket,
  type Kpis,
  type RepScorecard,
  type SourceRoi,
  type StageDwell,
} from "../engine/metrics";
import type { Forecast } from "../engine/pipeline";
import { computeAnomalies, type AnomalyFlag } from "../engine/anomalies";
import { computeAlerts, type Alert } from "../engine/alerts";
import { OPEN_STAGES } from "../data/types";

export interface ModelSummary {
  model: string;
  leads: number;
  delivered: number;
  deliveryRate: number;
  revenue: number;
  avgDealValue: number;
  revenueShare: number;
  avgDaysToDeliver: number;
}

export interface LostByBranch {
  branchId: string;
  branchName: string;
  total: number;
  reasons: { reason: string; count: number }[];
}

export interface AIContext {
  generatedAt: string;
  asOf: string;
  scope: {
    role: string;
    branches: string[];
    reps: string[];
    branchNames: Record<string, string>;
    repNames: Record<string, string>;
  };
  kpis: Kpis;
  funnel: FunnelBucket[];
  conversion: ConversionStep[];
  dwell: StageDwell[];
  aging: ReturnType<typeof computeAging>;
  branches: BranchScorecard[];
  reps: RepScorecard[];
  sources: SourceRoi[];
  models: ModelSummary[];
  lostReasons: { reason: string; count: number }[];
  lostByBranch: LostByBranch[];
  delayReasons: { reason: string; count: number }[];
  forecast: Forecast;
  anomalies: AnomalyFlag[];
  alerts: Alert[];
  staleLeads: { leadId: string; repId: string; branchId: string; days: number }[];
  atRiskClose: { leadId: string; customer: string; expectedClose: string; daysSinceActivity: number }[];
  branchPipeline: { branchId: string; branchName: string; weightedValue: number; openLeads: number }[];
  monthly: ReturnType<typeof computeMonthlySeries>;
}

function modelSummaries(ctx: FilteredContext, deliveriesByLead: Map<string, { days_to_deliver: number }>): ModelSummary[] {
  const groups = new Map<string, Lead[]>();
  for (const lead of ctx.leads) {
    const list = groups.get(lead.model_interested) ?? [];
    list.push(lead);
    groups.set(lead.model_interested, list);
  }
  const totalRevenue = ctx.leads
    .filter((l) => l.status === "delivered")
    .reduce((s, l) => s + (l.deal_value || 0), 0);

  return [...groups.entries()]
    .map(([model, leads]) => {
      const delivered = leads.filter((l) => l.status === "delivered");
      const revenue = delivered.reduce((s, l) => s + (l.deal_value || 0), 0);
      const days = delivered
        .map((l) => deliveriesByLead.get(l.id)?.days_to_deliver)
        .filter((n): n is number => Number.isFinite(n));
      return {
        model,
        leads: leads.length,
        delivered: delivered.length,
        deliveryRate: leads.length ? delivered.length / leads.length : 0,
        revenue,
        avgDealValue: delivered.length ? revenue / delivered.length : 0,
        revenueShare: totalRevenue ? revenue / totalRevenue : 0,
        avgDaysToDeliver: days.length ? days.reduce((a, b) => a + b, 0) / days.length : 0,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);
}

function lostByBranch(ctx: FilteredContext, index: DatasetIndex): LostByBranch[] {
  const byBranch = new Map<string, Lead[]>();
  for (const lead of ctx.leads) {
    if (lead.status !== "lost") continue;
    const list = byBranch.get(lead.branch_id) ?? [];
    list.push(lead);
    byBranch.set(lead.branch_id, list);
  }
  return [...byBranch.entries()].map(([branchId, leads]) => {
    const counts = new Map<string, number>();
    for (const lead of leads) {
      const reason = lead.lost_reason?.trim() || "Unknown";
      counts.set(reason, (counts.get(reason) ?? 0) + 1);
    }
    return {
      branchId,
      branchName: index.branchesById.get(branchId)?.name ?? branchId,
      total: leads.length,
      reasons: [...counts.entries()]
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count),
    };
  });
}

function delayReasons(ctx: FilteredContext): { reason: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const d of ctx.deliveries) {
    if (!d.delay_reason) continue;
    const reason = d.delay_reason.trim() || "Unknown";
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);
}

function atRiskCloseLeads(ctx: FilteredContext, asOf: string): AIContext["atRiskClose"] {
  const asOfDate = new Date(`${asOf}T00:00:00.000Z`);
  const horizon = new Date(asOfDate);
  horizon.setUTCDate(horizon.getUTCDate() + 30);

  return ctx.leads
    .filter((l) => OPEN_STAGES.includes(l.status as (typeof OPEN_STAGES)[number]))
    .filter((l) => {
      const close = new Date(`${l.expected_close_date}T00:00:00.000Z`);
      return close <= horizon;
    })
    .map((l) => ({
      leadId: l.id,
      customer: l.customer_name,
      expectedClose: l.expected_close_date,
      daysSinceActivity: Math.round(
        (asOfDate.getTime() - new Date(`${l.last_activity_at}T00:00:00.000Z`).getTime()) / 86_400_000
      ),
    }))
    .sort((a, b) => a.daysSinceActivity - b.daysSinceActivity)
    .slice(0, 15);
}

export function buildAIContext(
  dataset: Dataset,
  index: DatasetIndex,
  ctx: FilteredContext,
  forecast: Forecast
): AIContext {
  const asOf = ctx.filters.asOf;
  const deliveriesByLead = new Map(ctx.deliveries.map((d) => [d.lead_id, d]));
  const staleLeads = computeLeadAging(ctx.leads, asOf, 14)
    .filter((a) => a.stale)
    .slice(0, 25)
    .map((a) => ({
      leadId: a.lead.id,
      repId: a.lead.assigned_to,
      branchId: a.lead.branch_id,
      days: a.daysSinceActivity,
    }));

  const branchPipeline = computeBranchPipeline(ctx, index, forecast.probabilities);

  const branchNames: Record<string, string> = {};
  for (const b of dataset.branches) branchNames[b.id] = b.name;
  const repNames: Record<string, string> = {};
  for (const r of dataset.sales_reps) repNames[r.id] = r.name;

  return {
    generatedAt: new Date().toISOString(),
    asOf,
    scope: {
      role: ctx.filters.role,
      branches: ctx.filters.branches,
      reps: ctx.filters.reps,
      branchNames,
      repNames,
    },
    kpis: computeKpis(ctx),
    funnel: computeFunnel(ctx.leads),
    conversion: computeConversion(ctx.leads),
    dwell: computeStageDwell(ctx.leads, asOf),
    aging: computeAging(ctx.leads, asOf),
    branches: computeBranchScorecard(dataset, index, ctx),
    reps: computeRepScorecard(dataset, index, ctx, asOf),
    sources: computeSourceRoi(ctx),
    models: modelSummaries(ctx, deliveriesByLead),
    lostReasons: computeLostByReason(ctx.leads),
    lostByBranch: lostByBranch(ctx, index),
    delayReasons: delayReasons(ctx),
    forecast,
    anomalies: computeAnomalies(dataset, index, ctx),
    alerts: computeAlerts(dataset, index, ctx, forecast).alerts,
    staleLeads,
    atRiskClose: atRiskCloseLeads(ctx, asOf),
    branchPipeline,
    monthly: computeMonthlySeries(dataset, index, ctx),
  };
}

function computeBranchPipeline(
  ctx: FilteredContext,
  index: DatasetIndex,
  probabilities: Record<string, number>
): AIContext["branchPipeline"] {
  const byBranch = new Map<string, Lead[]>();
  for (const lead of ctx.leads) {
    if (!OPEN_STAGES.includes(lead.status as (typeof OPEN_STAGES)[number])) continue;
    const list = byBranch.get(lead.branch_id) ?? [];
    list.push(lead);
    byBranch.set(lead.branch_id, list);
  }
  return [...byBranch.entries()].map(([branchId, leads]) => {
    const weightedValue = leads.reduce(
      (sum, l) => sum + (l.deal_value || 0) * (probabilities[l.status] ?? 0),
      0
    );
    return {
      branchId,
      branchName: index.branchesById.get(branchId)?.name ?? branchId,
      weightedValue,
      openLeads: leads.length,
    };
  });
}
