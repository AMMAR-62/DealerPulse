"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Lead } from "@/lib/data/types";
import { formatLakhCr } from "@/lib/format";
import StatusBadge from "@/components/StatusBadge";
import CsvExportButton from "@/components/CsvExportButton";
import LeadSidePanel, {
  type LeadAgingInfo,
  type LeadDeliveryInfo,
} from "@/components/LeadSidePanel";
import { LEAD_COLUMNS } from "@/lib/leadsSortKeys";

export default function RepLeadsTable({
  leads,
  branchNames,
  repName,
  aging,
  deliveries,
  repId,
  sortKey,
  sortDir,
}: {
  leads: Lead[];
  branchNames: Record<string, string>;
  repName: string;
  aging?: Map<string, LeadAgingInfo>;
  deliveries?: Record<string, LeadDeliveryInfo>;
  repId: string;
  sortKey: string;
  sortDir: "asc" | "desc";
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const leadParam = searchParams.get("lead");
  const selectedLead = leadParam
    ? (leads.find((l) => l.id === leadParam) ?? null)
    : null;

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

  const sortHref = (key: string) => {
    const nextDir = sortKey === key ? (sortDir === "desc" ? "asc" : "desc") : "desc";
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", key);
    params.set("dir", nextDir);
    return `${pathname}?${params.toString()}`;
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">
          Rep&apos;s leads <span className="font-normal text-zinc-400">({leads.length})</span>
        </h2>
        <CsvExportButton
          filename={`dealerpulse-${repId}-leads.csv`}
          headers={[
            { key: "id", label: "Lead ID" },
            { key: "customer_name", label: "Customer" },
            { key: "phone", label: "Phone" },
            { key: "source", label: "Source" },
            { key: "model_interested", label: "Model" },
            { key: "status", label: "Status" },
            { key: "created_at", label: "Created" },
            { key: "last_activity_at", label: "Last Activity" },
            { key: "expected_close_date", label: "Expected Close" },
            { key: "deal_value", label: "Deal Value" },
            { key: "lost_reason", label: "Lost Reason" },
          ]}
          rows={leads}
        />
      </div>
      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
              {LEAD_COLUMNS.map((col) => (
                <th key={col.key} className="py-2 pl-4 pr-3">
                  <Link
                    href={sortHref(col.key)}
                    className={`uppercase tracking-wide hover:text-zinc-900 dark:hover:text-zinc-50 ${
                      sortKey === col.key ? "text-indigo-600 dark:text-indigo-400" : ""
                    }`}
                  >
                    {col.label}
                    {sortKey === col.key && (
                      <span className="ml-0.5 text-[10px]">
                        {sortDir === "asc" ? "▲" : "▼"}
                      </span>
                    )}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
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
                </td>
                <td className="py-2 pr-3">{l.source}</td>
                <td className="py-2 pr-3">{l.model_interested}</td>
                <td className="py-2 pr-3">
                  <StatusBadge status={l.status} />
                </td>
                <td className="py-2 pr-3 text-zinc-500">{l.created_at.slice(0, 10)}</td>
                <td className="py-2 pr-3 text-zinc-500">{l.last_activity_at.slice(0, 10)}</td>
                <td className="py-2 pr-4 text-right font-medium">
                  {formatLakhCr(l.deal_value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <LeadSidePanel
        lead={selectedLead}
        branchName={
          selectedLead
            ? (branchNames[selectedLead.branch_id] ?? selectedLead.branch_id)
            : ""
        }
        repName={repName}
        aging={selectedLead ? aging?.get(selectedLead.id) : undefined}
        delivery={selectedLead ? deliveries?.[selectedLead.id] : undefined}
        onClose={closeLead}
      />
    </div>
  );
}