"use client";

import type { Lead, StatusEvent } from "@/lib/data/types";
import { formatCurrency } from "@/lib/format";

export default function LeadDrawer({
  lead,
  branchName,
  repName,
  onClose,
}: {
  lead: Lead;
  branchName: string;
  repName: string;
  onClose: () => void;
}) {
  const history = [...lead.status_history].sort((a, b) =>
    b.timestamp.localeCompare(a.timestamp)
  );

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/30"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Lead ${lead.id} details`}
    >
      <div
        className="h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-2xl dark:bg-zinc-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{lead.customer_name}</h2>
            <p className="text-xs text-zinc-400">
              {lead.id} · {branchName} · {repName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mt-4 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <Field label="Status" value={lead.status.replace("_", " ")} />
            <Field label="Deal value" value={formatCurrency(lead.deal_value)} />
            <Field label="Source" value={lead.source} />
            <Field label="Model" value={lead.model_interested} />
            <Field label="Created" value={lead.created_at.slice(0, 10)} />
            <Field label="Last activity" value={lead.last_activity_at.slice(0, 10)} />
            <Field label="Expected close" value={lead.expected_close_date} />
            <Field label="Phone" value={lead.phone} />
          </div>
          {lead.status === "lost" && lead.lost_reason && (
            <p className="mt-3 text-sm">
              <span className="text-zinc-500">Lost reason: </span>
              <span className="text-red-600">{lead.lost_reason}</span>
            </p>
          )}
        </div>

        <h3 className="mb-2 mt-5 text-sm font-semibold">Status history</h3>
        <ol className="relative space-y-4 border-l border-zinc-200 pl-4 dark:border-zinc-800">
          {history.map((event) => (
            <TimelineEvent key={`${lead.id}-${event.timestamp}`} event={event} />
          ))}
        </ol>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-zinc-400">{label}</p>
      <p className="capitalize">{value}</p>
    </div>
  );
}

function TimelineEvent({ event }: { event: StatusEvent }) {
  const timestamp = event.timestamp.slice(0, 10);
  const time = event.timestamp.slice(11, 16);
  return (
    <li className="relative">
      <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-indigo-500 dark:border-zinc-950" />
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-medium capitalize">
          {event.status.replace("_", " ")}
        </span>
        <span className="text-xs text-zinc-400">
          {timestamp} {time}Z
        </span>
      </div>
      {event.note && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{event.note}</p>
      )}
    </li>
  );
}