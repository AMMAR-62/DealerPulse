import type { AnomalyFlag } from "@/lib/engine/anomalies";
import { formatPercent } from "@/lib/format";

export default function AnomalyStrip({ flags }: { flags: AnomalyFlag[] }) {
  return (
    <ul className="grid gap-3 md:grid-cols-3">
      {flags.map((flag) => {
        const isBad = flag.direction === "low";
        return (
          <li
            key={flag.id}
            className={`rounded-lg border-l-4 bg-white p-3 dark:bg-zinc-900 ${
              isBad
                ? "border-l-red-500"
                : "border-l-emerald-500"
            } border border-zinc-200 dark:border-zinc-800`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-semibold">
                {flag.entityLabel}
              </p>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium uppercase ${
                  flag.severity === "critical"
                    ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                    : flag.severity === "warning"
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                      : "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
                }`}
              >
                {flag.severity}
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
              {flag.reason}
            </p>
            <p className="mt-2 text-xs text-zinc-400">
              {formatPercent(flag.value)} vs {formatPercent(flag.baseline)}{" "}
              baseline · z={flag.zScore.toFixed(2)} · n=
              {flag.sampleSize}
            </p>
          </li>
        );
      })}
    </ul>
  );
}