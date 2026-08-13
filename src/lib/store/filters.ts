export type Role = "ceo" | "manager" | "rep";

export interface Filters {
  role: Role;
  branches: string[];
  reps: string[];
  sources: string[];
  models: string[];
  from: string;
  to: string;
  asOf: string;
}

export const DEFAULT_AS_OF = "2025-12-31";
export const DEFAULT_FROM = "2025-06-01";
export const DEFAULT_TO = "2025-12-31";

export const ROLE_LABELS: Record<Role, string> = {
  ceo: "CEO",
  manager: "Branch Manager",
  rep: "Sales Rep",
};

export function defaultFilters(): Filters {
  return {
    role: "ceo",
    branches: [],
    reps: [],
    sources: [],
    models: [],
    from: DEFAULT_FROM,
    to: DEFAULT_TO,
    asOf: DEFAULT_AS_OF,
  };
}

const ISO_DATE =
  /^\d{4}-\d{2}-\d{2}$/;

function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime());
}

function toList(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  const parts = Array.isArray(value) ? value.flatMap((v) => v.split(",")) : value.split(",");
  return parts
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

export function parseSearchParams(
  searchParams: Record<string, string | string[] | undefined>
): Filters {
  const f = defaultFilters();

  const role = searchParams["role"];
  if (role === "manager" || role === "rep") f.role = role;

  f.branches = toList(searchParams["branch"]);
  f.reps = toList(searchParams["rep"]);
  f.sources = toList(searchParams["source"]);
  f.models = toList(searchParams["model"]);

  const from = typeof searchParams["from"] === "string" ? searchParams["from"] : "";
  const to = typeof searchParams["to"] === "string" ? searchParams["to"] : "";
  const asOf = typeof searchParams["asof"] === "string" ? searchParams["asof"] : "";

  if (isIsoDate(from)) f.from = from;
  if (isIsoDate(to)) f.to = to;
  if (isIsoDate(asOf)) f.asOf = asOf;

  return f;
}

export function filtersToParams(filters: Filters): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.role !== "ceo") params.role = filters.role;
  if (filters.branches.length) params.branch = filters.branches.join(",");
  if (filters.reps.length) params.rep = filters.reps.join(",");
  if (filters.sources.length) params.source = filters.sources.join(",");
  if (filters.models.length) params.model = filters.models.join(",");
  if (filters.from !== DEFAULT_FROM) params.from = filters.from;
  if (filters.to !== DEFAULT_TO) params.to = filters.to;
  if (filters.asOf !== DEFAULT_AS_OF) params.asof = filters.asOf;
  return params;
}

export function updateParam(
  current: Record<string, string | string[] | undefined>,
  key: string,
  value: string[] | string | undefined
): Record<string, string | string[]> {
  const next: Record<string, string | string[]> = {};
  for (const [k, v] of Object.entries(current)) {
    if (k === key) continue;
    if (Array.isArray(v)) next[k] = v.join(",");
    else if (v !== undefined) next[k] = v;
  }
  if (Array.isArray(value)) {
    if (value.length) next[key] = value.join(",");
  } else if (value !== undefined && value !== "") {
    next[key] = value;
  }
  return next;
}

export function buildQueryString(params: Record<string, string | string[]>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) usp.set(k, v.join(","));
    else usp.set(k, v);
  }
  const qs = usp.toString();
  return qs ? `?${qs}` : "";
}