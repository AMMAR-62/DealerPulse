import { getDataset, buildIndex } from "@/lib/data/load";
import { parseSearchParams } from "@/lib/store/filters";
import { buildContext } from "@/lib/engine/metrics";
import LeadsTable from "@/components/LeadsTable";

export default async function LeadsPage({
  searchParams,
}: PageProps<"/leads">) {
  const dataset = getDataset();
  const index = buildIndex(dataset);
  const filters = parseSearchParams(await searchParams);
  const ctx = buildContext(dataset, index, filters);

  const branches: Record<string, string> = {};
  for (const b of dataset.branches) branches[b.id] = b.name;
  const reps: Record<string, string> = {};
  for (const r of dataset.sales_reps) reps[r.id] = r.name;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
          <p className="text-sm text-zinc-500">
            {ctx.leads.length} leads in scope · click a row for full history
          </p>
        </div>
      </div>

      <LeadsTable leads={ctx.leads} branches={branches} reps={reps} />
    </div>
  );
}