"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Alert, AlertSeverity } from "@/lib/engine/alerts";

const STORAGE_KEY = "dealerpulse-dismissed-alerts";

const SEVERITY_STYLE: Record<
  AlertSeverity,
  { badge: string; border: string }
> = {
  critical: {
    badge: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    border: "border-l-red-500",
  },
  warning: {
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    border: "border-l-amber-500",
  },
  info: {
    badge: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
    border: "border-l-sky-500",
  },
};

function readDismissed(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export default function AlertsList({ alerts }: { alerts: Alert[] }) {
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setDismissed(readDismissed()));
    return () => cancelAnimationFrame(raf);
  }, []);

  const dismiss = (id: string) => {
    const next = [...dismissed, id];
    setDismissed(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const restoreAll = () => {
    setDismissed([]);
    localStorage.setItem(STORAGE_KEY, "[]");
  };

  const visible = alerts.filter((a) => !dismissed.includes(a.id));
  const dismissedNow = alerts.length - visible.length;

  return (
    <div>
      {dismissedNow > 0 && (
        <div className="mb-3 flex items-center gap-2 text-sm text-zinc-500">
          <span>
            {dismissedNow} alert{dismissedNow === 1 ? "" : "s"} dismissed.
          </span>
          <button
            type="button"
            onClick={restoreAll}
            className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          >
            Restore all
          </button>
        </div>
      )}

      {visible.length === 0 ? (
        <p className="rounded-lg border border-zinc-200 p-6 text-center text-sm text-zinc-500 dark:border-zinc-800">
          No alerts in scope for this view.
        </p>
      ) : (
        <ul className="space-y-3">
          {visible.map((alert) => {
            const style = SEVERITY_STYLE[alert.severity];
            return (
              <li
                key={alert.id}
                className={`rounded-lg border border-l-4 border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 ${style.border}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium uppercase tracking-wide ${style.badge}`}
                      >
                        {alert.severity}
                      </span>
                      <span className="text-xs text-zinc-400">
                        {alert.category}
                      </span>
                      <h3 className="text-sm font-semibold">{alert.title}</h3>
                    </div>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                      {alert.reason}
                    </p>
                    <p className="mt-1 text-xs text-zinc-400">
                      {alert.entityLabel}
                    </p>
                    {alert.leadIds.length > 0 && alert.link && (
                      <Link
                        href={alert.link}
                        className="mt-2 inline-block text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                      >
                        Drill into {alert.leadIds.length} lead
                        {alert.leadIds.length === 1 ? "" : "s"} →
                      </Link>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => dismiss(alert.id)}
                    aria-label={`Dismiss alert: ${alert.title}`}
                    className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}