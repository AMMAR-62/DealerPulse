"use client";

import { useMemo, useState } from "react";
import type { Lead } from "@/lib/data/types";
import { formatCurrency } from "@/lib/format";
import LeadDrawer from "@/components/LeadDrawer";

type SortKey =
  | "id"
  | "customer_name"
  | "source"
  | "model_interested"
  | "status"
  | "created_at"
  | "last_activity_at"
  | "deal_value";

export default function LeadsTable({
  leads,
  branches,
  reps,
}: {
  leads: Lead[];
  branches: Record<string, string>;
  reps: Record<string, string>;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const statuses = useMemo(
    () => [...new Set(leads.map((l) => l.status))].sort(),
    [leads]
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let filtered = leads.filter((l) => {
      if (status !== "all" && l.status !== status) return false;
      if (!q) return true;
      return (
        l.customer_name.toLowerCase().includes(q) ||
        l.id.toLowerCase().includes(q) ||
        l.model_interested.toLowerCase().includes(q) ||
        l.source.toLowerCase().includes(q) ||
        l.phone.includes(q)
      );
    });
    filtered = [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      let cmp = 0;
      if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
      else cmp = String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return filtered;
  }, [leads, query, status, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const exportCsv = () => {
    const header = [
      "Lead ID",
      "Customer",
      "Phone",
      "Source",
      "Model",
      "Status",
      "Branch",
      "Rep",
      "Created",
      "Last Activity",
      "Expected Close",
      "Deal Value",
      "Lost Reason",
    ];
    const lines = rows.map((l) =>
      [
        l.id,
        l.customer_name,
        l.phone,
        l.source,
        l.model_interested,
        l.status,
        branches[l.branch_id] ?? l.branch_id,
        reps[l.assigned_to] ?? l.assigned_to,
        l.created_at,
        l.last_activity_at,
        l.expected_close_date,
        l.deal_value,
        l.lost_reason ?? "",
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = [header.join(","), ...lines].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dealerpulse-leads-${status === "all" ? "all" : status}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selected = selectedId ? leads.find((l) => l.id === selectedId) ?? null : null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search customer, model, source, phone…"
          aria-label="Search leads"
          className="min-w-0 flex-1 rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filter by status"
          className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        >
          <option value="all">All statuses</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={exportCsv}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Export CSV ({rows.length})
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
              <SortTh label="Lead" onClick={() => toggleSort("id")} active={sortKey === "id"} dir={sortDir} />
              <SortTh label="Customer" onClick={() => toggleSort("customer_name")} active={sortKey === "customer_name"} dir={sortDir} />
              <SortTh label="Model" onClick={() => toggleSort("model_interested")} active={sortKey === "model_interested"} dir={sortDir} />
              <SortTh label="Status" onClick={() => toggleSort("status")} active={sortKey === "status"} dir={sortDir} />
              <SortTh label="Created" onClick={() => toggleSort("created_at")} active={sortKey === "created_at"} dir={sortDir} />
              <SortTh label="Activity" onClick={() => toggleSort("last_activity_at")} active={sortKey === "last_activity_at"} dir={sortDir} />
              <SortTh label="Value" onClick={() => toggleSort("deal_value")} active={sortKey === "deal_value"} dir={sortDir} />
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => (
              <tr
                key={l.id}
                onClick={() => setSelectedId(l.id)}
                className="cursor-pointer border-b border-zinc-100 last:border-0 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-900/50"
              >
                <td className="py-2 pl-4 pr-3 text-zinc-400">{l.id}</td>
                <td className="py-2 pr-3 font-medium">{l.customer_name}</td>
                <td className="py-2 pr-3">{l.model_interested}</td>
                <td className="py-2 pr-3">
                  <StatusBadge status={l.status} />
                </td>
                <td className="py-2 pr-3 text-zinc-500">{l.created_at.slice(0, 10)}</td>
                <td className="py-2 pr-3 text-zinc-500">{l.last_activity_at.slice(0, 10)}</td>
                <td className="py-2 pr-4 text-right font-medium">
                  {formatCurrency(l.deal_value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length === 0 && (
        <p className="mt-6 rounded-lg border border-zinc-200 p-6 text-center text-sm text-zinc-500 dark:border-zinc-800">
          No leads match the current search and filters.
        </p>
      )}

      {selected && (
        <LeadDrawer
          lead={selected}
          branchName={branches[selected.branch_id] ?? selected.branch_id}
          repName={reps[selected.assigned_to] ?? selected.assigned_to}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}

function SortTh({
  label,
  onClick,
  active,
  dir,
}: {
  label: string;
  onClick: () => void;
  active: boolean;
  dir: "asc" | "desc";
}) {
  return (
    <th className="py-2 pl-4 pr-3">
      <button
        type="button"
        onClick={onClick}
        className={`flex items-center gap-1 uppercase tracking-wide hover:text-zinc-900 dark:hover:text-zinc-50 ${active ? "text-indigo-600 dark:text-indigo-400" : ""}`}
      >
        {label}
        {active && <span className="text-[10px]">{dir === "asc" ? "▲" : "▼"}</span>}
      </button>
    </th>
  );
}

function StatusBadge({ status }: { status: string }) {
  const palette: Record<string, string> = {
    new: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    contacted: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
    test_drive: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
    negotiation: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    order_placed: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
    delivered: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    lost: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
        palette[status] ?? "bg-zinc-100 text-zinc-700"
      }`}
    >
      {status.replace("_", " ")}
    </span>
  );
}