export const LEAD_SORT_KEYS = [
  "id",
  "customer_name",
  "source",
  "model_interested",
  "status",
  "created_at",
  "last_activity_at",
  "deal_value",
] as const;

export const LEAD_COLUMNS: { key: (typeof LEAD_SORT_KEYS)[number]; label: string }[] = [
  { key: "id", label: "Lead" },
  { key: "customer_name", label: "Customer" },
  { key: "source", label: "Source" },
  { key: "model_interested", label: "Model" },
  { key: "status", label: "Status" },
  { key: "created_at", label: "Created" },
  { key: "last_activity_at", label: "Activity" },
  { key: "deal_value", label: "Value" },
];
