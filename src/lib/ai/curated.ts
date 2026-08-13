import type { AIContext } from "./context";
import { formatCurrency, formatPercent, formatNumber } from "../format";

export type IntentKey =
  | "branch_target_pacing"
  | "month_end_projection"
  | "branch_delivery_trend"
  | "top_reps"
  | "coaching_opportunity"
  | "stale_leads_by_rep"
  | "rep_peer_anomalies"
  | "biggest_dropoff"
  | "stage_dwell"
  | "source_roi"
  | "model_performance"
  | "lost_reasons_by_branch"
  | "lost_reason_correlation"
  | "at_risk_close"
  | "aged_no_followup"
  | "days_to_deliver_by_branch"
  | "delay_causes"
  | "slowest_models"
  | "weighted_pipeline_by_branch"
  | "monthly_conversion_strength";

export const INTENT_GROUPS = [
  { theme: "Performance vs target", key: "performance" },
  { theme: "Reps & effectiveness", key: "reps" },
  { theme: "Funnel & conversion", key: "funnel" },
  { theme: "Loss & risk", key: "loss" },
  { theme: "Delivery & fulfillment", key: "delivery" },
  { theme: "Forecasting & patterns", key: "forecast" },
] as const;

export interface CuratedQuestion {
  id: number;
  theme: string;
  prompt: string;
  intent: IntentKey;
}

export const CURATED_QUESTIONS: CuratedQuestion[] = [
  // Performance vs target
  {
    id: 1,
    theme: "Performance vs target",
    prompt: "Which branches are on/behind/ahead of their monthly unit & revenue targets?",
    intent: "branch_target_pacing",
  },
  {
    id: 2,
    theme: "Performance vs target",
    prompt: "What is the projected month-end performance (best/expected/worst) vs target given the open pipeline?",
    intent: "month_end_projection",
  },
  {
    id: 3,
    theme: "Performance vs target",
    prompt: "How does each branch's delivery rate trend Jun→Dec — improving, flat, or deteriorating?",
    intent: "branch_delivery_trend",
  },
  // Reps & effectiveness
  {
    id: 4,
    theme: "Reps & effectiveness",
    prompt: "Which rep closes the most units and which has the best conversion rate (vs lead volume)?",
    intent: "top_reps",
  },
  {
    id: 5,
    theme: "Reps & effectiveness",
    prompt: "Which reps are high-volume but low-converting — where is the coaching opportunity?",
    intent: "coaching_opportunity",
  },
  {
    id: 6,
    theme: "Reps & effectiveness",
    prompt: "Which reps have the most stale/unfollowed leads, and for how many days?",
    intent: "stale_leads_by_rep",
  },
  {
    id: 7,
    theme: "Reps & effectiveness",
    prompt: "Which reps significantly over- or under-perform their branch peers (statistical anomaly)?",
    intent: "rep_peer_anomalies",
  },
  // Funnel & conversion
  {
    id: 8,
    theme: "Funnel & conversion",
    prompt: "Which funnel stage has the biggest drop-off (new→contacted→test_drive→negotiation→order→delivered)?",
    intent: "biggest_dropoff",
  },
  {
    id: 9,
    theme: "Funnel & conversion",
    prompt: "How long do leads spend in each stage vs the benchmark — which stages drag?",
    intent: "stage_dwell",
  },
  {
    id: 10,
    theme: "Funnel & conversion",
    prompt: "Which lead sources (walk_in, website, referral…) produce the highest conversion and revenue per lead?",
    intent: "source_roi",
  },
  {
    id: 11,
    theme: "Funnel & conversion",
    prompt: "Which models sell best and which yield the highest deal value / revenue share?",
    intent: "model_performance",
  },
  // Loss & risk
  {
    id: 12,
    theme: "Loss & risk",
    prompt: "What are the top reasons leads are lost, and how do they differ by branch?",
    intent: "lost_reasons_by_branch",
  },
  {
    id: 13,
    theme: "Loss & risk",
    prompt: "How do lost reasons correlate with source and model (e.g., test-drive dissatisfaction on Fortuner)?",
    intent: "lost_reason_correlation",
  },
  {
    id: 14,
    theme: "Loss & risk",
    prompt: "Which open leads are at risk of missing their expected_close_date given recent activity?",
    intent: "at_risk_close",
  },
  {
    id: 15,
    theme: "Loss & risk",
    prompt: "Which leads have aged without any follow-up since their last activity?",
    intent: "aged_no_followup",
  },
  // Delivery & fulfillment
  {
    id: 16,
    theme: "Delivery & fulfillment",
    prompt: "What is the average days-to-deliver per branch, and which branches are slowest?",
    intent: "days_to_deliver_by_branch",
  },
  {
    id: 17,
    theme: "Delivery & fulfillment",
    prompt: "What are the most common delivery-delay causes, and where do they cluster?",
    intent: "delay_causes",
  },
  {
    id: 18,
    theme: "Delivery & fulfillment",
    prompt: "Which models take longest to deliver — and does that drive lost deals?",
    intent: "slowest_models",
  },
  // Forecasting & patterns
  {
    id: 19,
    theme: "Forecasting & patterns",
    prompt: "What is the total open pipeline value (weighted by stage) per branch?",
    intent: "weighted_pipeline_by_branch",
  },
  {
    id: 20,
    theme: "Forecasting & patterns",
    prompt: "Which month had the strongest/weakest conversion, and which model/source drove it?",
    intent: "monthly_conversion_strength",
  },
];

export interface AnswerTable {
  title: string;
  columns: string[];
  rows: (string | number)[][];
}

export interface IntentAnswer {
  text: string;
  table?: AnswerTable;
}

export function resolveIntent(intent: IntentKey, ctx: AIContext): IntentAnswer {
  switch (intent) {
    case "branch_target_pacing":
      return branchTargetPacing(ctx);
    case "month_end_projection":
      return monthEndProjection(ctx);
    case "branch_delivery_trend":
      return branchDeliveryTrend(ctx);
    case "top_reps":
      return topReps(ctx);
    case "coaching_opportunity":
      return coachingOpportunity(ctx);
    case "stale_leads_by_rep":
      return staleLeadsByRep(ctx);
    case "rep_peer_anomalies":
      return repPeerAnomalies(ctx);
    case "biggest_dropoff":
      return biggestDropoff(ctx);
    case "stage_dwell":
      return stageDwell(ctx);
    case "source_roi":
      return sourceRoi(ctx);
    case "model_performance":
      return modelPerformance(ctx);
    case "lost_reasons_by_branch":
      return lostReasonsByBranch(ctx);
    case "lost_reason_correlation":
      return lostReasonCorrelation(ctx);
    case "at_risk_close":
      return atRiskClose(ctx);
    case "aged_no_followup":
      return agedNoFollowup(ctx);
    case "days_to_deliver_by_branch":
      return daysToDeliverByBranch(ctx);
    case "delay_causes":
      return delayCauses(ctx);
    case "slowest_models":
      return slowestModels(ctx);
    case "weighted_pipeline_by_branch":
      return weightedPipelineByBranch(ctx);
    case "monthly_conversion_strength":
      return monthlyConversionStrength(ctx);
  }
}

function branchTargetPacing(ctx: AIContext): IntentAnswer {
  const rows = ctx.branches.map((b) => [
    b.name,
    b.targetUnits,
    b.deliveredUnits,
    b.deliveredUnits - b.targetUnits,
    b.deliveredUnits >= b.targetUnits ? "on/ahead" : "behind",
  ]);
  const behind = ctx.branches.filter((b) => b.deliveredUnits < b.targetUnits);
  const text = behind.length
    ? `${behind.map((b) => `${b.name} (${b.deliveredUnits}/${b.targetUnits})`).join(", ")} ${behind.length === 1 ? "is" : "are"} behind the as-of month target.`
    : "All branches are meeting or ahead of their as-of month unit target.";
  return { text, table: { title: "Branch pacing vs as-of month target", columns: ["Branch", "Target", "Delivered", "Δ", "Status"], rows } };
}

function monthEndProjection(ctx: AIContext): IntentAnswer {
  const f = ctx.forecast;
  const last = f.points[f.points.length - 1];
  const best = last ? last.bestCumulative : 0;
  const text =
    f.endGap < 0
      ? `Projected ${Math.round(f.projectedEndUnits)} units vs ${Math.round(f.targetEndUnits)} plan by ${f.horizonMonth} — a ${Math.round(Math.abs(f.endGap))}-unit gap. Open pipeline adds ${Math.round(f.expectedWinsAhead)} expected wins (best case ${Math.round(best - f.projectedEndUnits)} more).`
      : `Projected ${Math.round(f.projectedEndUnits)} units vs ${Math.round(f.targetEndUnits)} plan by ${f.horizonMonth} — on or above plan.`;
  const rows = f.points.map((p) => [
    p.month,
    p.targetCumulative,
    p.actualCumulative,
    p.projectedCumulative,
    p.isForecast ? "forecast" : "actual",
  ]);
  return { text, table: { title: "Cumulative forecast vs plan", columns: ["Month", "Plan", "Actual", "Projected", "Type"], rows } };
}

function branchDeliveryTrend(ctx: AIContext): IntentAnswer {
  const rows = ctx.branches.map((b) => {
    const firstHalf = b.trend.slice(0, Math.ceil(b.trend.length / 2));
    const secondHalf = b.trend.slice(Math.ceil(b.trend.length / 2));
    const avg = (pts: typeof b.trend) =>
      pts.length ? pts.reduce((s, p) => s + p.units, 0) / pts.length : 0;
    const diff = avg(secondHalf) - avg(firstHalf);
    const label = b.trend.length < 2 ? "n/a" : diff > 0.5 ? "improving" : diff < -0.5 ? "deteriorating" : "flat";
    return [b.name, b.deliveryRate ? formatPercent(b.deliveryRate) : "—", label];
  });
  return { text: "Branch delivery-rate trend across the period, from monthly delivered units (created-by-month basis unavailable, so units trend is shown).", table: { title: "Branch delivery trend", columns: ["Branch", "Overall rate", "Jun→Dec trend"], rows } };
}

function topReps(ctx: AIContext): IntentAnswer {
  const active = ctx.reps.filter((r) => r.leads > 0);
  const mostUnits = active[0];
  const bestRate = [...active].sort((a, b) => b.deliveryRate - a.deliveryRate)[0];
  const text = mostUnits
    ? `${mostUnits.name} leads with ${mostUnits.deliveredUnits} units delivered; ${bestRate?.name} has the best conversion at ${formatPercent(bestRate?.deliveryRate ?? 0)} (${bestRate?.deliveredUnits}/${bestRate?.leads}).`
    : "No rep data in scope.";
  const rows = active
    .slice(0, 10)
    .map((r) => [r.name, r.branchName, r.leads, r.deliveredUnits, formatPercent(r.deliveryRate)]);
  return { text, table: { title: "Top reps by units delivered", columns: ["Rep", "Branch", "Leads", "Delivered", "Rate"], rows } };
}

function coachingOpportunity(ctx: AIContext): IntentAnswer {
  const active = ctx.reps.filter((r) => r.leads > 0);
  const avgRate = active.length
    ? active.reduce((s, r) => s + r.deliveryRate, 0) / active.length
    : 0;
  const candidates = active
    .filter((r) => r.leads >= 8 && r.deliveryRate < avgRate * 0.8)
    .sort((a, b) => b.leads - a.leads);
  const text = candidates.length
    ? `${candidates.map((r) => `${r.name} (${r.leads} leads, ${formatPercent(r.deliveryRate)} vs ${formatPercent(avgRate)} avg)`).join("; ")} — high volume, below-average conversion.`
    : "No high-volume, low-converting reps in scope.";
  const rows = candidates.map((r) => [r.name, r.branchName, r.leads, r.deliveredUnits, formatPercent(r.deliveryRate)]);
  return { text, table: rows.length ? { title: "Coaching candidates", columns: ["Rep", "Branch", "Leads", "Delivered", "Rate"], rows } : undefined };
}

function staleLeadsByRep(ctx: AIContext): IntentAnswer {
  const byRep = new Map<string, { count: number; maxDays: number }>();
  for (const s of ctx.staleLeads) {
    const cur = byRep.get(s.repId) ?? { count: 0, maxDays: 0 };
    cur.count += 1;
    cur.maxDays = Math.max(cur.maxDays, s.days);
    byRep.set(s.repId, cur);
  }
  const rows = [...byRep.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(([repId, v]) => [
      ctx.scope.repNames[repId] ?? repId,
      v.count,
      `${v.maxDays}d`,
    ]);
  const total = ctx.staleLeads.length;
  return { text: `${total} stale open lead${total === 1 ? "" : "s"} (no activity 14+ days).`, table: { title: "Stale leads by rep", columns: ["Rep", "Stale", "Max idle"], rows } };
}

function repPeerAnomalies(ctx: AIContext): IntentAnswer {
  const flags = ctx.anomalies.filter((a) => a.entityType === "rep");
  const text = flags.length
    ? flags.map((f) => `${f.entityLabel}: ${formatPercent(f.value)} vs ${formatPercent(f.baseline)} peers (${f.direction}‑performing).`).join(" ")
    : "No statistically significant rep-level anomalies in scope.";
  const rows = flags.map((f) => [f.entityLabel, formatPercent(f.value), formatPercent(f.baseline), f.direction, `z=${f.zScore.toFixed(2)}`]);
  return { text, table: rows.length ? { title: "Rep anomalies vs branch peers", columns: ["Rep", "Rate", "Peer avg", "Direction", "Z-score"], rows } : undefined };
}

function biggestDropoff(ctx: AIContext): IntentAnswer {
  const conv = ctx.conversion;
  const worst = conv.length ? conv.reduce((a, b) => (a.rate < b.rate ? a : b)) : null;
  const text = worst
    ? `Biggest drop-off is ${worst.from.replace("_", " ")} → ${worst.to.replace("_", " ")} at ${formatPercent(worst.rate)} — ${worst.fromCount} leads reached, only ${worst.toCount} advanced.`
    : "No conversion data.";
  const rows = conv.map((c) => [`${c.from.replace("_", " ")} → ${c.to.replace("_", " ")}`, c.fromCount, c.toCount, formatPercent(c.rate)]);
  return { text, table: { title: "Stage conversion", columns: ["Transition", "From", "To", "Rate"], rows } };
}

function stageDwell(ctx: AIContext): IntentAnswer {
  const rows = ctx.dwell.map((d) => [d.stage.replace("_", " "), d.count, `${d.avgDays.toFixed(1)}d`, `${d.medianDays.toFixed(1)}d`]);
  const slow = ctx.dwell.filter((d) => d.count > 0).sort((a, b) => b.avgDays - a.avgDays)[0];
  const text = slow ? `Leads spend longest in ${slow.stage.replace("_", " ")} (avg ${slow.avgDays.toFixed(1)} days).` : "No dwell data.";
  return { text, table: { title: "Dwell time per stage", columns: ["Stage", "Leads", "Avg", "Median"], rows } };
}

function sourceRoi(ctx: AIContext): IntentAnswer {
  const top = [...ctx.sources].sort((a, b) => b.deliveredRate - a.deliveredRate)[0];
  const text = top
    ? `${top.source} converts ${formatPercent(top.deliveredRate)} with ${formatCurrency(top.revenue)} revenue across ${top.leads} leads — best delivery rate; refer to table for full ROI.`
    : "No source data.";
  const rows = ctx.sources.map((s) => [s.source, s.leads, formatPercent(s.deliveredRate), formatPercent(s.lostRate), formatCurrency(s.revenue)]);
  return { text, table: { title: "Source ROI", columns: ["Source", "Leads", "Delivered %", "Lost %", "Revenue"], rows } };
}

function modelPerformance(ctx: AIContext): IntentAnswer {
  const rows = ctx.models.map((m) => [m.model, m.leads, m.delivered, formatPercent(m.deliveryRate), formatCurrency(m.revenue), formatPercent(m.revenueShare)]);
  const top = ctx.models[0];
  const text = top ? `${top.model} is the top revenue model at ${formatCurrency(top.revenue)} (${formatPercent(top.revenueShare)} share).` : "No model data.";
  return { text, table: { title: "Model performance", columns: ["Model", "Leads", "Delivered", "Rate", "Revenue", "Share"], rows } };
}

function lostReasonsByBranch(ctx: AIContext): IntentAnswer {
  const rows = ctx.lostByBranch.flatMap((b) =>
    b.reasons.slice(0, 3).map((r) => [b.branchName, r.reason, r.count])
  );
  const top = ctx.lostReasons[0];
  const text = top
    ? `Top lost reason overall: "${top.reason}" (${top.count}). Breakdown by branch below.`
    : "No lost-lead data.";
  return { text, table: { title: "Top lost reasons by branch", columns: ["Branch", "Reason", "Count"], rows } };
}

function lostReasonCorrelation(ctx: AIContext): IntentAnswer {
  const rows = ctx.lostReasons.map((r) => [r.reason, r.count]);
  return { text: "Full source×model loss crosstab is not part of the compact context; showing global loss reasons. Enable an LLM key for a richer free-form analysis.", table: { title: "Global lost reasons", columns: ["Reason", "Count"], rows } };
}

function atRiskClose(ctx: AIContext): IntentAnswer {
  const list = ctx.atRiskClose;
  const text = list.length
    ? `${list.length} open lead${list.length === 1 ? "" : "s"} have expected_close_date within 30 days of as-of.`
    : "No open leads at risk of missing their close window.";
  const rows = list.map((l) => [l.leadId, l.customer, l.expectedClose, `${l.daysSinceActivity}d`]);
  return { text, table: rows.length ? { title: "At-risk close leads", columns: ["Lead", "Customer", "Expected close", "Idle"], rows } : undefined };
}

function agedNoFollowup(ctx: AIContext): IntentAnswer {
  const stale = ctx.staleLeads;
  const text = stale.length
    ? `${stale.length} open lead${stale.length === 1 ? "" : "s"} have had no activity for 14+ days.`
    : "No leads aged past the 14-day follow-up window.";
  const rows = stale.slice(0, 15).map((s) => [s.leadId, ctx.scope.branchNames[s.branchId] ?? s.branchId, `${s.days}d`]);
  return { text, table: rows.length ? { title: "Aged, unfollowed leads", columns: ["Lead", "Branch", "Idle"], rows } : undefined };
}

function daysToDeliverByBranch(ctx: AIContext): IntentAnswer {
  const rows = ctx.branches.map((b) => [b.name, formatNumber(b.deliveredUnits), b.avgDaysToDeliver ? b.avgDaysToDeliver.toFixed(1) : "—"]);
  const slowest = [...ctx.branches].filter((b) => b.avgDaysToDeliver > 0).sort((a, b) => b.avgDaysToDeliver - a.avgDaysToDeliver)[0];
  const text = slowest ? `${slowest.name} is slowest at ${slowest.avgDaysToDeliver.toFixed(1)} days to deliver.` : "No delivery data.";
  return { text, table: { title: "Days to deliver by branch", columns: ["Branch", "Delivered", "Avg days"], rows } };
}

function delayCauses(ctx: AIContext): IntentAnswer {
  const rows = ctx.delayReasons.map((r) => [r.reason, r.count]);
  const top = ctx.delayReasons[0];
  const text = top ? `Most common delay cause: "${top.reason}" (${top.count} deliveries).` : "No delayed deliveries in scope.";
  return { text, table: { title: "Delivery delay causes", columns: ["Reason", "Count"], rows } };
}

function slowestModels(ctx: AIContext): IntentAnswer {
  const rows = ctx.models
    .filter((m) => m.avgDaysToDeliver > 0)
    .map((m) => [m.model, m.delivered, m.avgDaysToDeliver.toFixed(1), formatPercent(m.deliveryRate)]);
  const slowest = [...ctx.models]
    .filter((m) => m.avgDaysToDeliver > 0)
    .sort((a, b) => b.avgDaysToDeliver - a.avgDaysToDeliver)[0];
  const text = slowest
    ? `${slowest.model} averages ${slowest.avgDaysToDeliver.toFixed(1)} days to deliver.`
    : "No model delivery data.";
  return { text, table: { title: "Days to deliver by model", columns: ["Model", "Delivered", "Avg days", "Rate"], rows } };
}

function weightedPipelineByBranch(ctx: AIContext): IntentAnswer {
  const rows = ctx.branchPipeline.map((b) => [
    b.branchName,
    b.openLeads,
    formatCurrency(b.weightedValue),
  ]);
  const top = [...ctx.branchPipeline].sort((a, b) => b.weightedValue - a.weightedValue)[0];
  const text = top
    ? `${top.branchName} holds the largest weighted pipeline at ${formatCurrency(top.weightedValue)} across ${top.openLeads} open lead${top.openLeads === 1 ? "" : "s"}.`
    : "No open pipeline in scope.";
  return { text, table: { title: "Weighted open pipeline by branch", columns: ["Branch", "Open leads", "Weighted value"], rows } };
}

function monthlyConversionStrength(ctx: AIContext): IntentAnswer {
  const rows = ctx.monthly.map((m) => [m.month, m.deliveredUnits, m.lostUnits, m.targetUnits]);
  const best = [...ctx.monthly].sort((a, b) => b.deliveredUnits - a.deliveredUnits)[0];
  const worst = [...ctx.monthly].filter((m) => m.deliveredUnits > 0).sort((a, b) => a.deliveredUnits - b.deliveredUnits)[0];
  const text = best
    ? `${best.month} had the most deliveries (${best.deliveredUnits}); ${worst ? `${worst.month} the fewest (${worst.deliveredUnits}).` : ""}`
    : "No monthly data.";
  return { text, table: { title: "Monthly delivered vs lost vs target", columns: ["Month", "Delivered", "Lost", "Target"], rows } };
}
