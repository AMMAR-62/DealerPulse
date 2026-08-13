import { formatPercent } from "@/lib/format";

export interface FunnelRow {
  stage: string;
  current: number;
  reached: number;
  share: number;
  conversion?: number;
}

export default function FunnelBars({
  rows,
  asOfNote,
}: {
  rows: FunnelRow[];
  asOfNote?: string;
}) {
  const max = rows[0]?.reached || 1;
  return (
    <div className="space-y-2">
      {rows.map((row, i) => {
        const width = row.stage === "lost" ? Math.max(4, (row.current / max) * 100) : Math.max(4, (row.reached / max) * 100);
        return (
          <div key={row.stage}>
            <div className="flex items-baseline justify-between text-sm">
              <span className="capitalize text-zinc-600 dark:text-zinc-300">
                {row.stage.replace("_", " ")}
              </span>
              <span className="flex items-baseline gap-2">
                {row.conversion !== undefined && i > 0 && row.conversion < 1 && (
                  <span
                    className={`text-xs ${
                      row.conversion >= 0.7
                        ? "text-emerald-600"
                        : row.conversion >= 0.5
                          ? "text-amber-600"
                          : "text-red-600"
                    }`}
                  >
                    {formatPercent(row.conversion)}
                  </span>
                )}
                <span className="font-medium">
                  {row.current}
                  {row.stage === "lost" && row.reached > 0 && (
                    <span className="ml-1 text-xs font-normal text-zinc-400">
                      ({row.reached})
                    </span>
                  )}
                </span>
              </span>
            </div>
            <div className="mt-0.5 h-2 overflow-hidden rounded bg-zinc-100 dark:bg-zinc-800">
              <div
                className={`h-full rounded ${row.stage === "lost" ? "bg-zinc-400" : "bg-indigo-500"}`}
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        );
      })}
      {asOfNote && (
        <p className="pt-1 text-xs text-zinc-400">{asOfNote}</p>
      )}
    </div>
  );
}