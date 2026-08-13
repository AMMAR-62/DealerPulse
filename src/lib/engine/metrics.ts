import type { Dataset, Delivery, Lead, Target } from "../data/types";
import { FUNNEL_ORDER, OPEN_STAGES } from "../data/types";
import { dateOf, daysBetween, monthKey } from "../data/load";
import type { Filters } from "../store/filters";
import type { DatasetIndex } from "../data/load";

export interface FilteredContext {
  leads: Lead[];
  deliveries: Delivery[];
  targets: Target[];
  filters: Filters;
}

const STAGE_PROBABILITY: Record<string, number> = {
  new: 0.2,
  contacted: 0.35,
  test_drive: 0.55,
  negotiation: 0.7,
  order_placed: 0.85,
};

function endOfDay(iso: string): Date {
  return new Date(`${iso}T23:59:59.999Z`);
}

export function buildContext(
  dataset: Dataset,
  index: DatasetIndex,
  filters: Filters
): FilteredContext {
  let { branches, reps } = filters;
  const role = filters.role;

  if (role === "manager" && branches.length === 0) {
    branches = [index.branchIds[0] ?? ""];
  }
  if (role === "rep") {
    if (reps.length === 0) {
      const firstWithLeads = index.repIds.find(
        (id) => (index.leadIdsByRep.get(id)?.length ?? 0) > 0
      );
      reps = firstWithLeads ? [firstWithLeads] : index.repIds.slice(0, 1);
    }
    if (reps.length) {
      const repBranchIds = new Set(
        reps.map((r) => index.repsById.get(r)?.branch_id).filter(Boolean) as string[]
      );
      branches = [...repBranchIds];
    }
  }

  const branchSet = new Set(branches);
  const repSet = new Set(reps);
  const sourceSet = new Set(filters.sources);
  const modelSet = new Set(filters.models);
  const from = dateOf(filters.from);
  const to = endOfDay(filters.to);
  const asOf = endOfDay(filters.asOf);

  const leads = dataset.leads.filter((lead) => {
    if (branchSet.size && !branchSet.has(lead.branch_id)) return false;
    if (repSet.size && !repSet.has(lead.assigned_to)) return false;
    if (sourceSet.size && !sourceSet.has(lead.source)) return false;
    if (modelSet.size && !modelSet.has(lead.model_interested)) return false;
    const created = dateOf(lead.created_at);
    if (created < from || created > to) return false;
    if (created > asOf) return false;
    return true;
  });

  const leadIds = new Set(leads.map((l) => l.id));
  const deliveries = dataset.deliveries.filter((d) => {
    const deliveryDate = dateOf(d.delivery_date);
    return leadIds.has(d.lead_id) && deliveryDate <= asOf;
  });

  const month = monthKey(asOf);
  const branchTargets = branches.length
    ? branches
        .map((b) => index.targetsByBranchMonth.get(b)?.get(month))
        .filter((t): t is Target => Boolean(t))
    : dataset.targets.filter((t) => t.month === month);

  return { leads, deliveries, targets: branchTargets, filters: { ...filters, branches, reps } };
}

export interface Kpis {
  totalLeads: number;
  openLeads: number;
  lostLeads: number;
  lostRate: number;
  deliveredUnits: number;
  deliveryRate: number;
  rawPipelineValue: number;
  weightedPipelineValue: number;
  avgDaysToDeliver: number;
  delayedDeliveries: number;
  delayRate: number;
  revenueToDate: number;
  targetUnits: number;
  targetRevenue: number;
  deliveredVsTarget: number;
  revenueVsTarget: number;
  activeReps: number;
}

export function computeKpis(ctx: FilteredContext): Kpis {
  const { leads, deliveries, targets } = ctx;

  const delivered = leads.filter((l) => l.status === "delivered");
  const lost = leads.filter((l) => l.status === "lost");
  const open = leads.filter((l) => OPEN_STAGES.includes(l.status as (typeof OPEN_STAGES)[number]));

  const revenueToDate = delivered.reduce((sum, l) => sum + (l.deal_value || 0), 0);
  const rawPipelineValue = open.reduce((sum, l) => sum + (l.deal_value || 0), 0);
  const weightedPipelineValue = open.reduce(
    (sum, l) => sum + (l.deal_value || 0) * (STAGE_PROBABILITY[l.status] ?? 0),
    0
  );

  const days = deliveries.map((d) => d.days_to_deliver).filter((n) => Number.isFinite(n));
  const avgDaysToDeliver = days.length
    ? days.reduce((a, b) => a + b, 0) / days.length
    : 0;
  const delayed = deliveries.filter((d) => Boolean(d.delay_reason));

  const targetUnits = targets.reduce((sum, t) => sum + t.target_units, 0);
  const targetRevenue = targets.reduce((sum, t) => sum + t.target_revenue, 0);

  const repIds = new Set(leads.map((l) => l.assigned_to));

  return {
    totalLeads: leads.length,
    openLeads: open.length,
    lostLeads: lost.length,
    lostRate: leads.length ? lost.length / leads.length : 0,
    deliveredUnits: delivered.length,
    deliveryRate: leads.length ? delivered.length / leads.length : 0,
    rawPipelineValue,
    weightedPipelineValue,
    avgDaysToDeliver,
    delayedDeliveries: delayed.length,
    delayRate: deliveries.length ? delayed.length / deliveries.length : 0,
    revenueToDate,
    targetUnits,
    targetRevenue,
    deliveredVsTarget: delivered.length - targetUnits,
    revenueVsTarget: revenueToDate - targetRevenue,
    activeReps: repIds.size,
  };
}

export interface FunnelBucket {
  stage: string;
  current: number;
  reached: number;
  share: number;
}

export interface DelayReasonRow {
  reason: string;
  count: number;
  share: number;
}

export interface DeliveryDelayStats {
  totalDeliveries: number;
  delayed: number;
  onTime: number;
  delayedRate: number;
  avgDaysToDeliver: number;
  breakdown: DelayReasonRow[];
}

export function computeDeliveryDelays(ctx: FilteredContext): DeliveryDelayStats {
  const { deliveries } = ctx;
  const delayed = deliveries.filter((d) => Boolean(d.delay_reason));
  const days = deliveries.map((d) => d.days_to_deliver).filter((n) => Number.isFinite(n));
  const counts = new Map<string, number>();
  for (const d of delayed) {
    const reason = d.delay_reason?.trim() || "Unknown";
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }
  const breakdown = [...counts.entries()]
    .map(([reason, count]) => ({
      reason,
      count,
      share: delayed.length ? count / delayed.length : 0,
    }))
    .sort((a, b) => b.count - a.count);
  return {
    totalDeliveries: deliveries.length,
    delayed: delayed.length,
    onTime: deliveries.length - delayed.length,
    delayedRate: deliveries.length ? delayed.length / deliveries.length : 0,
    avgDaysToDeliver: days.length ? days.reduce((a, b) => a + b, 0) / days.length : 0,
    breakdown,
  };
}

export function computeFunnel(leads: Lead[]): FunnelBucket[] {
  const currentCounts = new Map<string, number>();
  const reachedCounts = new Map<string, number>();

  for (const lead of leads) {
    currentCounts.set(lead.status, (currentCounts.get(lead.status) ?? 0) + 1);
    for (const event of lead.status_history) {
      reachedCounts.set(event.status, (reachedCounts.get(event.status) ?? 0) + 1);
    }
  }

  const buckets: FunnelBucket[] = FUNNEL_ORDER.map((stage) => {
    const reached = reachedCounts.get(stage) ?? 0;
    return {
      stage,
      current: currentCounts.get(stage) ?? 0,
      reached,
      share: reached ? reached / reachedCounts.get(FUNNEL_ORDER[0])! : 0,
    };
  });

  buckets.push({
    stage: "lost",
    current: currentCounts.get("lost") ?? 0,
    reached: reachedCounts.get("lost") ?? 0,
    share: 0,
  });

  return buckets;
}

export interface ConversionStep {
  from: string;
  to: string;
  fromCount: number;
  toCount: number;
  rate: number;
}

export function computeConversion(leads: Lead[]): ConversionStep[] {
  const reached = new Map<string, number>();
  for (const lead of leads) {
    for (const event of lead.status_history) {
      reached.set(event.status, (reached.get(event.status) ?? 0) + 1);
    }
  }

  const steps: ConversionStep[] = [];
  for (let i = 0; i < FUNNEL_ORDER.length - 1; i++) {
    const from = FUNNEL_ORDER[i];
    const to = FUNNEL_ORDER[i + 1];
    const fromCount = reached.get(from) ?? 0;
    const toCount = reached.get(to) ?? 0;
    steps.push({
      from,
      to,
      fromCount,
      toCount,
      rate: fromCount ? toCount / fromCount : 0,
    });
  }
  return steps;
}

export interface AgingBucket {
  bucket: string;
  min: number;
  count: number;
  share: number;
}

export function computeAging(leads: Lead[], asOf: string): AgingBucket[] {
  const boundaries: { bucket: string; min: number; max: number }[] = [
    { bucket: "0-7d", min: 0, max: 7 },
    { bucket: "8-14d", min: 8, max: 14 },
    { bucket: "15-30d", min: 15, max: 30 },
    { bucket: "31-60d", min: 31, max: 60 },
    { bucket: "61-90d", min: 61, max: 90 },
    { bucket: "90d+", min: 91, max: Number.POSITIVE_INFINITY },
  ];

  const counts = new Array(boundaries.length).fill(0);
  for (const lead of leads) {
    const age = daysBetween(lead.created_at, asOf);
    for (let i = 0; i < boundaries.length; i++) {
      if (age >= boundaries[i].min && age <= boundaries[i].max) {
        counts[i] += 1;
        break;
      }
    }
  }

  const total = leads.length;
  return boundaries.map((b, i) => ({
    bucket: b.bucket,
    min: b.min,
    count: counts[i],
    share: total ? counts[i] / total : 0,
  }));
}

export interface StageDwell {
  stage: string;
  count: number;
  avgDays: number;
  medianDays: number;
  p90Days: number;
}

export function computeStageDwell(
  leads: Lead[],
  asOf: string,
  staleAfterDays = 14
): StageDwell[] {
  const dwellsByStage = new Map<string, number[]>();

  for (const lead of leads) {
    const history = [...lead.status_history].sort((a, b) =>
      a.timestamp.localeCompare(b.timestamp)
    );
    for (let i = 0; i < history.length; i++) {
      const current = history[i];
      const next = history[i + 1];
      const isOpen = OPEN_STAGES.includes(current.status as (typeof OPEN_STAGES)[number]);
      if (!isOpen) continue;
      const endTime = next
        ? next.timestamp
        : daysBetween(lead.last_activity_at, asOf) > staleAfterDays
          ? lead.last_activity_at
          : asOf;
      const dwell = daysBetween(current.timestamp, endTime);
      const list = dwellsByStage.get(current.status) ?? [];
      list.push(Math.max(0, dwell));
      dwellsByStage.set(current.status, list);
    }
  }

  return FUNNEL_ORDER.slice(0, -1).map((stage) => {
    const list = dwellsByStage.get(stage) ?? [];
    const sorted = [...list].sort((a, b) => a - b);
    return {
      stage,
      count: sorted.length,
      avgDays: sorted.length
        ? sorted.reduce((a, b) => a + b, 0) / sorted.length
        : 0,
      medianDays: percentile(sorted, 0.5),
      p90Days: percentile(sorted, 0.9),
    };
  });
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, (sorted.length - 1) * p));
  const lo = Math.floor(index);
  const hi = Math.ceil(index);
  return lo === hi ? sorted[lo] : (sorted[lo] + sorted[hi]) / 2;
}

export interface LeadAging {
  lead: Lead;
  daysSinceCreated: number;
  daysSinceActivity: number;
  stale: boolean;
}

export function computeLeadAging(leads: Lead[], asOf: string, staleAfterDays = 14): LeadAging[] {
  return leads
    .map((lead) => {
      const daysSinceCreated = daysBetween(lead.created_at, asOf);
      const daysSinceActivity = daysBetween(lead.last_activity_at, asOf);
      const isOpen = OPEN_STAGES.includes(lead.status as (typeof OPEN_STAGES)[number]);
      return {
        lead,
        daysSinceCreated,
        daysSinceActivity,
        stale: isOpen && daysSinceActivity > staleAfterDays,
      };
    })
    .sort((a, b) => b.daysSinceActivity - a.daysSinceActivity);
}

export interface SourceRoi {
  source: string;
  leads: number;
  progressed: number;
  progressedRate: number;
  delivered: number;
  deliveredRate: number;
  lost: number;
  lostRate: number;
  revenue: number;
  avgDaysToDeliver: number;
}

const PROGRESSED_STAGES = new Set(["negotiation", "order_placed", "delivered"]);

export function computeSourceRoi(ctx: FilteredContext): SourceRoi[] {
  const groups = new Map<string, Lead[]>();
  for (const lead of ctx.leads) {
    const list = groups.get(lead.source) ?? [];
    list.push(lead);
    groups.set(lead.source, list);
  }

  const deliveriesByLead = new Map(ctx.deliveries.map((d) => [d.lead_id, d]));

  return [...groups.entries()]
    .map(([source, leads]) => {
      const delivered = leads.filter((l) => l.status === "delivered");
      const lost = leads.filter((l) => l.status === "lost");
      const progressed = leads.filter((l) => PROGRESSED_STAGES.has(l.status));
      const days = delivered
        .map((l) => deliveriesByLead.get(l.id)?.days_to_deliver)
        .filter((n): n is number => Number.isFinite(n));
      const revenue = delivered.reduce((sum, l) => sum + (l.deal_value || 0), 0);
      return {
        source,
        leads: leads.length,
        progressed: progressed.length,
        progressedRate: leads.length ? progressed.length / leads.length : 0,
        delivered: delivered.length,
        deliveredRate: leads.length ? delivered.length / leads.length : 0,
        lost: lost.length,
        lostRate: leads.length ? lost.length / leads.length : 0,
        revenue,
        avgDaysToDeliver: days.length ? days.reduce((a, b) => a + b, 0) / days.length : 0,
      };
    })
    .sort((a, b) => b.leads - a.leads);
}

export function computeLostByReason(leads: Lead[]): { reason: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const lead of leads) {
    if (lead.status !== "lost") continue;
    const reason = lead.lost_reason?.trim() || "Unknown";
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);
}

export interface BranchScorecard {
  branchId: string;
  name: string;
  city: string;
  leads: number;
  openLeads: number;
  lostLeads: number;
  deliveredUnits: number;
  deliveryRate: number;
  revenue: number;
  targetUnits: number;
  targetRevenue: number;
  deliveredVsTarget: number;
  avgDaysToDeliver: number;
  activeReps: number;
  trend: { month: string; units: number }[];
}

export function computeBranchScorecard(
  dataset: Dataset,
  index: DatasetIndex,
  ctx: FilteredContext
): BranchScorecard[] {
  const deliveriesByLead = new Map(ctx.deliveries.map((d) => [d.lead_id, d]));
  const asOfMonth = monthKey(ctx.filters.asOf);

  return ctx.filters.branches.length
    ? ctx.filters.branches.map((branchId) => scorecardForBranch(dataset, index, ctx, branchId, asOfMonth, deliveriesByLead))
    : dataset.branches.map((b) =>
        scorecardForBranch(dataset, index, ctx, b.id, asOfMonth, deliveriesByLead)
      );
}

function scorecardForBranch(
  dataset: Dataset,
  index: DatasetIndex,
  ctx: FilteredContext,
  branchId: string,
  asOfMonth: string,
  deliveriesByLead: Map<string, Delivery>
): BranchScorecard {
  const branch = index.branchesById.get(branchId);
  const repIds = new Set(
    (index.repsByBranch.get(branchId) ?? []).map((r) => r.id)
  );
  const leads = ctx.leads.filter(
    (l) => l.branch_id === branchId && repIds.has(l.assigned_to)
  );
  const deliveries = leads
    .map((l) => deliveriesByLead.get(l.id))
    .filter((d): d is Delivery => Boolean(d));

  const delivered = leads.filter((l) => l.status === "delivered");
  const lost = leads.filter((l) => l.status === "lost");
  const open = leads.filter((l) => OPEN_STAGES.includes(l.status as (typeof OPEN_STAGES)[number]));
  const revenue = delivered.reduce((sum, l) => sum + (l.deal_value || 0), 0);

  const target = index.targetsByBranchMonth.get(branchId)?.get(asOfMonth);
  const targetUnits = target?.target_units ?? 0;
  const targetRevenue = target?.target_revenue ?? 0;

  const days = deliveries.map((d) => d.days_to_deliver);
  const avgDaysToDeliver = days.length ? days.reduce((a, b) => a + b, 0) / days.length : 0;

  const trendMap = new Map<string, number>();
  for (const delivery of deliveries) {
    const month = monthKey(delivery.delivery_date);
    trendMap.set(month, (trendMap.get(month) ?? 0) + 1);
  }
  const trend = [...trendMap.entries()]
    .map(([month, units]) => ({ month, units }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const activeReps = new Set(leads.map((l) => l.assigned_to)).size;

  return {
    branchId,
    name: branch?.name ?? branchId,
    city: branch?.city ?? "",
    leads: leads.length,
    openLeads: open.length,
    lostLeads: lost.length,
    deliveredUnits: delivered.length,
    deliveryRate: leads.length ? delivered.length / leads.length : 0,
    revenue,
    targetUnits,
    targetRevenue,
    deliveredVsTarget: delivered.length - targetUnits,
    avgDaysToDeliver,
    activeReps,
    trend,
  };
}

export interface RepScorecard {
  repId: string;
  name: string;
  role: string;
  branchId: string;
  branchName: string;
  leads: number;
  openLeads: number;
  deliveredUnits: number;
  deliveryRate: number;
  revenue: number;
  lostLeads: number;
  lostRate: number;
  avgDaysToDeliver: number;
  daysSinceLastActivity: number;
}

export function computeRepScorecard(dataset: Dataset, index: DatasetIndex, ctx: FilteredContext, asOf: string): RepScorecard[] {
  const deliveriesByLead = new Map(ctx.deliveries.map((d) => [d.lead_id, d]));
  const byRep = new Map<string, Lead[]>();
  for (const lead of ctx.leads) {
    const list = byRep.get(lead.assigned_to) ?? [];
    list.push(lead);
    byRep.set(lead.assigned_to, list);
  }

  const cards: RepScorecard[] = [];
  for (const rep of dataset.sales_reps) {
    const leads = byRep.get(rep.id) ?? [];
    const deliveries = leads
      .map((l) => deliveriesByLead.get(l.id))
      .filter((d): d is Delivery => Boolean(d));
    const delivered = leads.filter((l) => l.status === "delivered");
    const lost = leads.filter((l) => l.status === "lost");
    const open = leads.filter((l) => OPEN_STAGES.includes(l.status as (typeof OPEN_STAGES)[number]));
    const revenue = delivered.reduce((sum, l) => sum + (l.deal_value || 0), 0);
    const days = deliveries.map((d) => d.days_to_deliver);

    const lastActivity = leads.reduce(
      (latest, l) => (l.last_activity_at > latest ? l.last_activity_at : latest),
      ""
    );
    cards.push({
      repId: rep.id,
      name: rep.name,
      role: rep.role,
      branchId: rep.branch_id,
      branchName: index.branchesById.get(rep.branch_id)?.name ?? rep.branch_id,
      leads: leads.length,
      openLeads: open.length,
      deliveredUnits: delivered.length,
      deliveryRate: leads.length ? delivered.length / leads.length : 0,
      revenue,
      lostLeads: lost.length,
      lostRate: leads.length ? lost.length / leads.length : 0,
      avgDaysToDeliver: days.length ? days.reduce((a, b) => a + b, 0) / days.length : 0,
      daysSinceLastActivity: lastActivity ? daysBetween(lastActivity, asOf) : -1,
    });
  }
  return cards.sort((a, b) => b.deliveredUnits - a.deliveredUnits);
}

export interface MonthlySeriesPoint {
  month: string;
  deliveredUnits: number;
  openPipelineUnits: number;
  lostUnits: number;
  targetUnits: number;
  revenue: number;
}

export function computeMonthlySeries(dataset: Dataset, index: DatasetIndex, ctx: FilteredContext): MonthlySeriesPoint[] {
  const targetMap = new Map<string, Target>();
  const targetBranches =
    ctx.filters.branches.length ? ctx.filters.branches : index.branchIds;
  for (const branchId of targetBranches) {
    const byMonth = index.targetsByBranchMonth.get(branchId);
    if (!byMonth) continue;
    for (const target of byMonth.values()) {
      targetMap.set(target.month, target);
    }
  }

  const months = [...targetMap.keys()].sort();

  return months.map((month) => {
    const inMonth = ctx.leads.filter((l) => monthKey(l.created_at) === month);
    const delivered = inMonth.filter((l) => l.status === "delivered");
    const lost = inMonth.filter((l) => l.status === "lost");
    const open = inMonth.filter((l) => OPEN_STAGES.includes(l.status as (typeof OPEN_STAGES)[number]));
    const revenue = delivered.reduce((sum, l) => sum + (l.deal_value || 0), 0);
    const target = targetMap.get(month);
    return {
      month,
      deliveredUnits: delivered.length,
      openPipelineUnits: open.length,
      lostUnits: lost.length,
      targetUnits: target?.target_units ?? 0,
      revenue,
    };
  });
}

export { STAGE_PROBABILITY };