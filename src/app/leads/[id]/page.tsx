import Link from "next/link";
import { notFound } from "next/navigation";
import { getDataset, buildIndex, daysBetween } from "@/lib/data/load";
import { parseSearchParams } from "@/lib/store/filters";
import { formatLakhCr } from "@/lib/format";
import type { LeadStatus, StatusEvent } from "@/lib/data/types";
import Breadcrumb from "@/components/Breadcrumb";
import StatusBadge from "@/components/StatusBadge";

export default async function LeadDetailPage({
  params,
  searchParams,
}: PageProps<"/leads/[id]">) {
  const { id } = await params;
  const dataset = getDataset();
  const index = buildIndex(dataset);

  const lead = dataset.leads.find((l) => l.id === id);
  if (!lead) notFound();

  const branch = index.branchesById.get(lead.branch_id);
  const rep = index.repsById.get(lead.assigned_to);
  const delivery = index.deliveryByLeadId.get(lead.id);

  const filters = parseSearchParams(await searchParams);
  const daysSinceActivity = daysBetween(lead.last_activity_at, filters.asOf);
  const isOpen = !["delivered", "lost"].includes(lead.status);
  const stale = isOpen && daysSinceActivity > 7;

  const history = [...lead.status_history].sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp)
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <Breadcrumb
        items={[
          { label: "Leads", href: "/leads" },
          { label: lead.customer_name },
        ]}
      />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {lead.customer_name}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-500">
            <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs dark:bg-zinc-800">
              {lead.id}
            </span>
            <StatusBadge status={lead.status} />
            {stale && (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                ⚠ AGING ({daysSinceActivity}d)
              </span>
            )}
            {delivery && (
              <span className="text-xs">
                Delivered in {delivery.days_to_deliver}d
              </span>
            )}
          </p>
        </div>
        <Link
          href="/leads"
          className="rounded-md border border-zinc-300 px-2.5 py-1 text-sm text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          ← Back to Leads
        </Link>
      </div>

      <section className="mb-6 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-3 text-sm font-semibold">Lead information</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Customer" value={lead.customer_name} />
          <Field label="Phone" value={lead.phone} />
          <Field label="Model interested" value={lead.model_interested} />
          <Field label="Source" value={lead.source} />
          <Field
            label="Branch"
            value={`${branch?.name ?? lead.branch_id}${branch?.city ? `, ${branch.city}` : ""}`}
          />
          <Field label="Rep" value={rep?.name ?? lead.assigned_to} />
          <Field label="Created" value={formatDate(lead.created_at)} />
          <Field label="Last activity" value={formatDate(lead.last_activity_at)} />
          <Field label="Expected close" value={formatDate(lead.expected_close_date)} />
          <Field label="Deal value" value={formatLakhCr(lead.deal_value)} emphasis />
          {lead.status === "lost" && lead.lost_reason && (
            <Field label="Lost reason" value={lead.lost_reason} tone="bad" />
          )}
        </div>
      </section>

      <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-4 text-sm font-semibold">Status timeline</h2>
        <div className="relative">
          <div className="absolute bottom-0 left-5 top-0 w-0.5 bg-zinc-200 dark:bg-zinc-700" />
          <ol>
            {history.map((event, i) => (
              <li key={`${lead.id}-${event.timestamp}`}>
                {i > 0 && (
                  <p className="ml-5 flex items-center gap-2 py-1 pl-6 text-[11px] font-medium text-zinc-400">
                    <span className="h-px w-3 bg-zinc-300 dark:bg-zinc-600" />
                    +{daysBetween(history[i - 1].timestamp, event.timestamp)} day
                    {daysBetween(history[i - 1].timestamp, event.timestamp) === 1 ? "" : "s"}
                  </p>
                )}
                <TimelineEvent
                  event={event}
                  isCurrent={isOpen && i === history.length - 1}
                />
              </li>
            ))}
          </ol>
        </div>
        {history.length === 0 && (
          <p className="text-sm text-zinc-400">No status history recorded.</p>
        )}
      </section>
    </div>
  );
}

function TimelineEvent({
  event,
  isCurrent,
}: {
  event: StatusEvent;
  isCurrent: boolean;
}) {
  const dot = DOT_CLASSES[event.status] ?? DOT_CLASSES.new;
  return (
    <div className="relative flex items-start gap-4 pb-6">
      <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 bg-white dark:bg-zinc-950">
        <span className={`h-3 w-3 rounded-full ${dot}`} />
      </div>
      <div className="flex-1 pt-1">
        <div className="mb-0.5 flex flex-wrap items-center gap-2">
          <StatusBadge status={event.status} />
          {isCurrent && (
            <span className="text-[10px] font-bold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
              Current
            </span>
          )}
        </div>
        <p className="text-xs text-zinc-400">
          {formatDate(event.timestamp, true)}
        </p>
        {event.note && (
          <p className="mt-0.5 text-sm italic text-zinc-600 dark:text-zinc-300">
            “{event.note}”
          </p>
        )}
      </div>
    </div>
  );
}

const DOT_CLASSES: Record<LeadStatus, string> = {
  new: "bg-sky-500",
  contacted: "bg-amber-500",
  test_drive: "bg-indigo-500",
  negotiation: "bg-orange-500",
  order_placed: "bg-violet-500",
  delivered: "bg-emerald-500",
  lost: "bg-red-500",
};

function Field({
  label,
  value,
  tone,
  emphasis,
}: {
  label: string;
  value: string;
  tone?: "bad";
  emphasis?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-zinc-400">{label}</p>
      <p
        className={`text-sm ${emphasis ? "font-bold" : "font-medium"} ${
          tone === "bad" ? "text-red-600" : "text-zinc-800 dark:text-zinc-200"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function formatDate(iso: string, withTime = false): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  if (!withTime) return date;
  const time = d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  });
  return `${date} at ${time}`;
}