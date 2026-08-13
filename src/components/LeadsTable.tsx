"use client";

import { useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toPng } from "html-to-image";
import type { Lead } from "@/lib/data/types";
import { formatCurrency } from "@/lib/format";
import StatusBadge from "@/components/StatusBadge";
import LeadSidePanel, {
  type LeadAgingInfo,
  type LeadDeliveryInfo,
} from "@/components/LeadSidePanel";

type SortKey =
  | "id"
  | "customer_name"
  | "source"
  | "model_interested"
  | "status"
  | "created_at"
  | "last_activity_at"
  | "deal_value"
  | "days_stale";

export default function LeadsTable({
  leads,
  branches,
  reps,
  aging,
  staleAfter = 7,
  deliveries,
}: {
  leads: Lead[];
  branches: Record<string, string>;
  reps: Record<string, string>;
  aging?: Map<string, LeadAgingInfo>;
  staleAfter?: number;
  deliveries?: Record<string, LeadDeliveryInfo>;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [staleOnly, setStaleOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const tableRef = useRef<HTMLDivElement>(null);

  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const leadParam = searchParams.get("lead");
  const selectedLead = leadParam ? (leads.find((l) => l.id === leadParam) ?? null) : null;

  const openLead = (id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("lead", id);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const closeLead = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("lead");
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const statuses = useMemo(
    () => [...new Set(leads.map((l) => l.status))].sort(),
    [leads]
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let filtered = leads.filter((l) => {
      if (status !== "all" && l.status !== status) return false;
      if (staleOnly && !(aging?.get(l.id)?.stale ?? false)) return false;
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
      if (sortKey === "days_stale") {
        const av = aging?.get(a.id)?.daysSinceActivity ?? -1;
        const bv = aging?.get(b.id)?.daysSinceActivity ?? -1;
        const cmp = av - bv;
        return sortDir === "asc" ? cmp : -cmp;
      }
      const av = a[sortKey];
      const bv = b[sortKey];
      let cmp = 0;
      if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
      else cmp = String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return filtered;
  }, [leads, query, status, staleOnly, sortKey, sortDir, aging]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const exportPng = async () => {
    const node = tableRef.current;
    if (!node) return;
    try {
      const dataUrl = await toPng(node, { backgroundColor: "#ffffff", pixelRatio: 2 });
      const link = document.createElement("a");
      link.download = `dealerpulse-leads-${staleOnly ? "stale" : "all"}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      // ignore export failures silently
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
      "Days Stale",
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
        aging?.get(l.id)?.daysSinceActivity ?? "",
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
          onClick={() => setStaleOnly((s) => !s)}
          aria-pressed={staleOnly}
          className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
            staleOnly
              ? "border-indigo-600 bg-indigo-600 text-white"
              : "border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          }`}
        >
          Stale only ({staleAfter}d+)
        </button>
        <button
          type="button"
          onClick={exportPng}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Export PNG
        </button>
        <button
          type="button"
          onClick={exportCsv}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Export CSV ({rows.length})
        </button>
      </div>

      <div ref={tableRef} className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
              <SortTh label="Lead" onClick={() => toggleSort("id")} active={sortKey === "id"} dir={sortDir} />
              <SortTh label="Customer" onClick={() => toggleSort("customer_name")} active={sortKey === "customer_name"} dir={sortDir} />
              <SortTh label="Model" onClick={() => toggleSort("model_interested")} active={sortKey === "model_interested"} dir={sortDir} />
              <SortTh label="Status" onClick={() => toggleSort("status")} active={sortKey === "status"} dir={sortDir} />
              <SortTh label="Created" onClick={() => toggleSort("created_at")} active={sortKey === "created_at"} dir={sortDir} />
              <SortTh label="Activity" onClick={() => toggleSort("last_activity_at")} active={sortKey === "last_activity_at"} dir={sortDir} />
              <SortTh label="Stale" onClick={() => toggleSort("days_stale")} active={sortKey === "days_stale"} dir={sortDir} />
              <SortTh label="Value" onClick={() => toggleSort("deal_value")} active={sortKey === "deal_value"} dir={sortDir} />
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => {
              const staleInfo = aging?.get(l.id);
              return (
                <tr
                  key={l.id}
                  className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-900/50"
                >
                  <td className="py-2 pl-4 pr-3 text-zinc-400">{l.id}</td>
                  <td className="py-2 pr-3 font-medium">
                    <button
                      type="button"
                      onClick={() => openLead(l.id)}
                      className="text-left text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      {l.customer_name}
                    </button>
                    {staleInfo?.stale && (
                      <span
                        className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                        title={`No activity for ${staleInfo.daysSinceActivity} days`}
                      >
                        AGING
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-3">{l.model_interested}</td>
                  <td className="py-2 pr-3">
                    <StatusBadge status={l.status} />
                  </td>
                  <td className="py-2 pr-3 text-zinc-500">{l.created_at.slice(0, 10)}</td>
                  <td className="py-2 pr-3 text-zinc-500">{l.last_activity_at.slice(0, 10)}</td>
                  <td className="py-2 pr-3">
                    {staleInfo && staleInfo.daysSinceActivity >= 0 ? (
                      <span
                        className={`text-sm font-semibold ${
                          staleInfo.daysSinceActivity > 14
                            ? "text-red-600 dark:text-red-400"
                            : staleInfo.daysSinceActivity > staleAfter
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-zinc-400"
                        }`}
                      >
                        {staleInfo.daysSinceActivity}d
                      </span>
                    ) : (
                      <span className="text-zinc-300 dark:text-zinc-600">—</span>
                    )}
                  </td>
                  <td className="py-2 pr-4 text-right font-medium">
                    {formatCurrency(l.deal_value)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rows.length === 0 && (
        <p className="mt-6 rounded-lg border border-zinc-200 p-6 text-center text-sm text-zinc-500 dark:border-zinc-800">
          {staleOnly
            ? `No stale leads (${staleAfter}+ days without activity) match the current filters.`
            : "No leads match the current search and filters."}
        </p>
      )}

      <LeadSidePanel
        lead={selectedLead}
        branchName={
          selectedLead
            ? (branches[selectedLead.branch_id] ?? selectedLead.branch_id)
            : ""
        }
        repName={
          selectedLead
            ? (reps[selectedLead.assigned_to] ?? selectedLead.assigned_to)
            : ""
        }
        aging={selectedLead ? aging?.get(selectedLead.id) : undefined}
        delivery={selectedLead ? deliveries?.[selectedLead.id] : undefined}
        onClose={closeLead}
      />
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