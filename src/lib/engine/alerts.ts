import type { Dataset } from "../data/types";
import type { DatasetIndex } from "../data/load";
import { daysBetween } from "../data/load";
import type { FilteredContext } from "./metrics";
import { computeLeadAging } from "./metrics";
import type { Forecast } from "./pipeline";
import { computeAnomalies, type AnomalyFlag } from "./anomalies";
import { OPEN_STAGES } from "../data/types";

export type AlertSeverity = "critical" | "warning" | "info";
export type AlertCategory =
  | "aging"
  | "followup"
  | "pipeline"
  | "delivery"
  | "anomaly";

export interface Alert {
  id: string;
  severity: AlertSeverity;
  category: AlertCategory;
  title: string;
  reason: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  metric: string;
  value: number;
  delta: number;
  leadIds: string[];
  link?: string;
}

export interface AlertsResult {
  alerts: Alert[];
  counts: Record<AlertSeverity, number>;
}

const FOLLOW_UP_REASONS = new Set(["Unresponsive after follow-up"]);

export function computeAlerts(
  dataset: Dataset,
  index: DatasetIndex,
  ctx: FilteredContext,
  forecast: Forecast
): AlertsResult {
  const alerts: Alert[] = [];
  const asOf = ctx.filters.asOf;

  const aging = computeLeadAging(ctx.leads, asOf, 14);
  const staleLeads = aging.filter((a) => a.stale).slice(0, 20);

  if (staleLeads.length) {
    alerts.push({
      id: "aging-stale-pipeline",
      severity: staleLeads.length >= 15 ? "critical" : "warning",
      category: "aging",
      title: "Stale open pipeline",
      reason: `${staleLeads.length} open lead(s) have had no activity for 14+ days and may be dead weight in your pipeline.`,
      entityType: "network",
      entityId: "network",
      entityLabel: "All branches",
      metric: "stale_leads",
      value: staleLeads.length,
      delta: 0,
      leadIds: staleLeads.map((a) => a.lead.id),
      link: "/leads",
    });
  }

  const nearClose = ctx.leads.filter((l) => {
    const isOpen = OPEN_STAGES.includes(l.status as (typeof OPEN_STAGES)[number]);
    if (!isOpen) return false;
    const days = daysBetween(asOf, l.expected_close_date);
    return days >= -7 && days <= 30;
  });

  if (nearClose.length) {
    const unresponsive = nearClose.filter(
      (l) =>
        daysBetween(l.last_activity_at, asOf) > 7
    );
    alerts.push({
      id: "followup-close-window",
      severity: unresponsive.length >= 5 ? "critical" : "warning",
      category: "followup",
      title: `Leads closing in the next 30 days (${nearClose.length})`,
      reason: `${nearClose.length} open lead(s) have expected close dates within the next month; ${unresponsive.length} have had no activity in over a week.`,
      entityType: "network",
      entityId: "network",
      entityLabel: "All branches",
      metric: "leads_in_close_window",
      value: nearClose.length,
      delta: unresponsive.length,
      leadIds: nearClose.map((l) => l.id),
      link: "/leads",
    });
  }

  const lostFollowUp = ctx.leads.filter(
    (l) => l.status === "lost" && FOLLOW_UP_REASONS.has(l.lost_reason ?? "")
  );
  if (lostFollowUp.length >= 10) {
    alerts.push({
      id: "followup-lost-cluster",
      severity: "warning",
      category: "followup",
      title: "Follow-up discipline exposure",
      reason: `${lostFollowUp.length} leads were lost to "Unresponsive after follow-up" — the top contactable-loss driver.`,
      entityType: "network",
      entityId: "network",
      entityLabel: "All branches",
      metric: "lost_unresponsive",
      value: lostFollowUp.length,
      delta: 0,
      leadIds: lostFollowUp.map((l) => l.id),
      link: "/leads",
    });
  }

  const end = forecast.points[forecast.points.length - 1];
  if (end && end.gapCumulative < 0) {
    const gap = Math.round(Math.abs(end.gapCumulative));
    const ahead = forecast.remainingMonths > 0
      ? ` Remaining open pipeline is expected to add ${Math.round(forecast.expectedWinsAhead)} more units.`
      : "";
    alerts.push({
      id: "pipeline-pace-gap",
      severity: end.gapCumulative <= -15 ? "critical" : "warning",
      category: "pipeline",
      title: `Tracking ${gap} units short of the ${end.month} plan`,
      reason: `Weighted pipeline projects ${Math.round(forecast.projectedEndUnits)} delivered units through ${end.month} vs a ${forecast.targetEndUnits} cumulative plan target — a ${gap}-unit gap.${ahead}`,
      entityType: "network",
      entityId: "network",
      entityLabel: "All branches",
      metric: "projected_vs_target",
      value: Math.round(end.projectedCumulative),
      delta: Math.round(end.gapCumulative),
      leadIds: [],
      link: "/funnel",
    });
  }

  const delayCounts = new Map<string, number>();
  for (const delivery of ctx.deliveries) {
    if (!delivery.delay_reason) continue;
    delayCounts.set(
      delivery.delay_reason,
      (delayCounts.get(delivery.delay_reason) ?? 0) + 1
    );
  }
  const sortedDelays = [...delayCounts.entries()].sort((a, b) => b[1] - a[1]);
  const totalDelays = sortedDelays.reduce((sum, [, c]) => sum + c, 0);
  if (totalDelays >= 10) {
    const [topReason, topCount] = sortedDelays[0];
    alerts.push({
      id: "delivery-delay-prevalence",
      severity: topCount >= 15 ? "critical" : "warning",
      category: "delivery",
      title: `${totalDelays} deliveries delayed`,
      reason: `${topCount} of ${totalDelays} delayed deliveries trace to "${topReason}" — prioritize root-cause action.`,
      entityType: "network",
      entityId: "network",
      entityLabel: "All branches",
      metric: "delayed_deliveries",
      value: totalDelays,
      delta: topCount,
      leadIds: [],
      link: "/branches",
    });
  }

  for (const flag of computeAnomalies(dataset, index, ctx)) {
    const title =
      flag.category === "aging"
        ? `${flag.value} stale lead${flag.value === 1 ? "" : "s"} at ${flag.entityLabel}`
        : `${flag.entityLabel} ${flag.direction === "high" ? "over" : "under"}-performing`;
    alerts.push({
      id: `anomaly-${flag.id}`,
      severity: mapSeverity(flag.severity),
      category: "anomaly",
      title,
      reason: flag.reason,
      entityType: flag.entityType,
      entityId: flag.entityId,
      entityLabel: flag.entityLabel,
      metric: flag.metric,
      value: flag.value,
      delta: flag.delta,
      leadIds: [],
    });
  }

  const counts: Record<AlertSeverity, number> = {
    critical: alerts.filter((a) => a.severity === "critical").length,
    warning: alerts.filter((a) => a.severity === "warning").length,
    info: alerts.filter((a) => a.severity === "info").length,
  };

  return { alerts: sortAlerts(alerts), counts };
}

function mapSeverity(severity: AnomalyFlag["severity"]): AlertSeverity {
  return severity;
}

function severityRank(severity: AlertSeverity): number {
  return severity === "critical" ? 0 : severity === "warning" ? 1 : 2;
}

function sortAlerts(alerts: Alert[]): Alert[] {
  return alerts.sort(
    (a, b) =>
      severityRank(a.severity) - severityRank(b.severity) ||
      (b.delta > 0 && a.delta > 0 ? b.delta - a.delta : 0) ||
      b.value - a.value
  );
}