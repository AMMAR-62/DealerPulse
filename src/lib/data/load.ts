import raw from "../../../data/dealership_data.json";
import type {
  Branch,
  Delivery,
  Dataset,
  Lead,
  SalesRep,
  StatusEvent,
  Target,
} from "./types";

function assertRecord(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Invalid dataset: "${label}" is not an object.`);
  }
}

function assertArray<T>(value: unknown, label: string): asserts value is T[] {
  if (!Array.isArray(value)) {
    throw new Error(`Invalid dataset: "${label}" is not an array.`);
  }
}

function parseStatusHistory(value: unknown): StatusEvent[] {
  assertArray(value, "lead.status_history");
  return value.filter(
    (e): e is StatusEvent =>
      typeof e === "object" && e !== null && "status" in e && "timestamp" in e
  );
}

function parseLead(value: unknown): Lead {
  assertRecord(value, "lead");
  const required = [
    "id",
    "customer_name",
    "source",
    "model_interested",
    "status",
    "assigned_to",
    "branch_id",
    "created_at",
    "last_activity_at",
    "expected_close_date",
  ];
  for (const key of required) {
    if (typeof value[key] !== "string") {
      throw new Error(`Invalid dataset: lead missing string field "${key}".`);
    }
  }
  return value as unknown as Lead;
}

function loadDataset(): Dataset {
  assertRecord(raw, "dataset");
  const dataset = raw as unknown as Dataset;

  assertArray(dataset.branches, "branches");
  assertArray(dataset.sales_reps, "sales_reps");
  assertArray(dataset.targets, "targets");
  assertArray(dataset.deliveries, "deliveries");
  assertArray(dataset.leads, "leads");

  if (!dataset.metadata) {
    throw new Error("Invalid dataset: missing metadata.");
  }

  dataset.leads = dataset.leads.map(parseLead);
  dataset.leads.forEach((lead) => {
    lead.status_history = parseStatusHistory(lead.status_history);
    if (!Number.isFinite(lead.deal_value)) {
      throw new Error(`Invalid dataset: lead "${lead.id}" has a non-numeric deal_value.`);
    }
  });

  dataset.branches.sort((a, b) => a.id.localeCompare(b.id));
  dataset.sales_reps.sort((a, b) => a.id.localeCompare(b.id));
  dataset.leads.sort((a, b) => a.created_at.localeCompare(b.created_at));

  return dataset;
}

const cached = loadDataset();

export function getDataset(): Dataset {
  return cached;
}

export interface DatasetIndex {
  branchesById: Map<string, Branch>;
  repsById: Map<string, SalesRep>;
  repsByBranch: Map<string, SalesRep[]>;
  leadIdsByRep: Map<string, string[]>;
  leadIdsByBranch: Map<string, string[]>;
  deliveryByLeadId: Map<string, Delivery>;
  targetsByBranchMonth: Map<string, Map<string, Target>>;
  sources: string[];
  models: string[];
  branchIds: string[];
  repIds: string[];
  dateMin: string;
  dateMax: string;
}

export function buildIndex(dataset: Dataset = cached): DatasetIndex {
  const branchesById = new Map<string, Branch>();
  const repsById = new Map<string, SalesRep>();
  const repsByBranch = new Map<string, SalesRep[]>();
  const leadIdsByRep = new Map<string, string[]>();
  const leadIdsByBranch = new Map<string, string[]>();
  const deliveryByLeadId = new Map<string, Delivery>();
  const targetsByBranchMonth = new Map<string, Map<string, Target>>();

  for (const branch of dataset.branches) {
    branchesById.set(branch.id, branch);
    repsByBranch.set(branch.id, []);
    leadIdsByBranch.set(branch.id, []);
    targetsByBranchMonth.set(branch.id, new Map());
  }

  for (const rep of dataset.sales_reps) {
    repsById.set(rep.id, rep);
    repsByBranch.get(rep.branch_id)?.push(rep);
  }

  for (const lead of dataset.leads) {
    leadIdsByBranch.get(lead.branch_id)?.push(lead.id);
    const repLeads = leadIdsByRep.get(lead.assigned_to) ?? [];
    repLeads.push(lead.id);
    leadIdsByRep.set(lead.assigned_to, repLeads);
  }

  for (const delivery of dataset.deliveries) {
    deliveryByLeadId.set(delivery.lead_id, delivery);
  }

  for (const target of dataset.targets) {
    let byMonth = targetsByBranchMonth.get(target.branch_id);
    if (!byMonth) {
      byMonth = new Map();
      targetsByBranchMonth.set(target.branch_id, byMonth);
    }
    byMonth.set(target.month, target);
  }

  const sources = [...new Set(dataset.leads.map((l) => l.source))].sort();
  const models = [...new Set(dataset.leads.map((l) => l.model_interested))].sort();

  const dates = dataset.leads.map((l) => l.created_at.slice(0, 10));
  const dateMin = dates.length ? dates[0] : "2025-06-01";
  const dateMax = dates.length ? dates[dates.length - 1] : "2025-12-31";

  return {
    branchesById,
    repsById,
    repsByBranch,
    leadIdsByRep,
    leadIdsByBranch,
    deliveryByLeadId,
    targetsByBranchMonth,
    sources,
    models,
    branchIds: [...branchesById.keys()],
    repIds: [...repsById.keys()],
    dateMin,
    dateMax,
  };
}

export function toDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function dateOf(value: string): Date {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? toDate(value) : date;
}

export function monthKey(value: Date | string): string {
  const d = typeof value === "string" ? dateOf(value) : value;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function daysBetween(a: string, b: string): number {
  const msPerDay = 86_400_000;
  return Math.round((dateOf(b).getTime() - dateOf(a).getTime()) / msPerDay);
}

export type { Dataset, Delivery, Lead, SalesRep, Target };