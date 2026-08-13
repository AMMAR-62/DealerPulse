export const LEAD_STATUSES = [
  "new",
  "contacted",
  "test_drive",
  "negotiation",
  "order_placed",
  "delivered",
  "lost",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const FUNNEL_ORDER = [
  "new",
  "contacted",
  "test_drive",
  "negotiation",
  "order_placed",
  "delivered",
] as const satisfies readonly LeadStatus[];

export type FunnelStage = (typeof FUNNEL_ORDER)[number];

export const OPEN_STAGES = FUNNEL_ORDER.slice(0, -1) as readonly LeadStatus[];

export type RepRole = "branch_manager" | "sales_officer";

export interface Branch {
  id: string;
  name: string;
  city: string;
}

export interface SalesRep {
  id: string;
  name: string;
  branch_id: string;
  role: RepRole;
  joined: string;
}

export interface StatusEvent {
  status: LeadStatus;
  timestamp: string;
  note?: string | null;
}

export interface Lead {
  id: string;
  customer_name: string;
  phone: string;
  source: string;
  model_interested: string;
  status: LeadStatus;
  assigned_to: string;
  branch_id: string;
  created_at: string;
  last_activity_at: string;
  status_history: StatusEvent[];
  expected_close_date: string;
  deal_value: number;
  lost_reason?: string | null;
}

export interface Target {
  branch_id: string;
  month: string;
  target_units: number;
  target_revenue: number;
}

export interface Delivery {
  lead_id: string;
  order_date: string;
  delivery_date: string;
  days_to_deliver: number;
  delay_reason?: string | null;
}

export interface DatasetMeta {
  generated_at: string;
  description: string;
  date_range: string;
  notes: string;
}

export interface Dataset {
  metadata: DatasetMeta;
  branches: Branch[];
  sales_reps: SalesRep[];
  leads: Lead[];
  targets: Target[];
  deliveries: Delivery[];
}