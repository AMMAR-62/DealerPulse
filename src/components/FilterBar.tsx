"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  buildQueryString,
  filtersToParams,
  parseSearchParams,
  updateParam,
  type Role,
} from "@/lib/store/filters";
import ThemeToggle from "@/components/ThemeToggle";

export interface FilterOptions {
  branches: { id: string; name: string; city: string }[];
  reps: { id: string; name: string; branchId: string }[];
  sources: string[];
  models: string[];
  dateMin: string;
  dateMax: string;
}

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "ceo", label: "CEO" },
  { value: "manager", label: "Branch Manager" },
  { value: "rep", label: "Sales Rep" },
];

export default function FilterBar({ options }: { options: FilterOptions }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params: Record<string, string> = {};
  for (const [key, value] of searchParams.entries()) params[key] = value;
  const filters = parseSearchParams(params);

  const apply = useCallback(
    (nextParams: Record<string, string | string[]>) => {
      router.replace(`${pathname}${buildQueryString(nextParams)}`, {
        scroll: false,
      });
    },
    [router, pathname]
  );

  const setRole = (role: Role) => {
    const current = parseSearchParams(params);
    const next = filtersToParams(current);
    next.role = role;
    if (role === "manager") {
      delete next.rep;
      if (!next.branch && options.branches.length) {
        next.branch = options.branches[0].id;
      }
    } else if (role === "rep") {
      delete next.branch;
      delete next.rep;
      if (options.reps.length) {
        const first = options.reps[0];
        next.rep = first.id;
        next.branch =
          options.branches.find((b) => b.id === first.branchId)?.id ??
          first.branchId;
      }
    }
    apply(next);
  };

  const reset = () => apply({});

  return (
    <div className="border-b border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
      <div className="flex flex-wrap items-center gap-2 px-4 py-2">
        <RoleSwitcher value={filters.role} onChange={setRole} />

        <MultiSelect
          label="Branches"
          values={filters.branches}
          options={options.branches.map((b) => ({ value: b.id, label: b.name }))}
          onChange={(next) => apply(updateParam(params, "branch", next))}
          placeholder="All branches"
        />

        <MultiSelect
          label="Reps"
          values={filters.reps}
          options={options.reps.map((r) => ({ value: r.id, label: r.name }))}
          onChange={(next) => apply(updateParam(params, "rep", next))}
          placeholder="All reps"
        />

        <MultiSelect
          label="Sources"
          values={filters.sources}
          options={options.sources.map((s) => ({ value: s, label: s }))}
          onChange={(next) => apply(updateParam(params, "source", next))}
          placeholder="All sources"
        />

        <MultiSelect
          label="Models"
          values={filters.models}
          options={options.models.map((m) => ({ value: m, label: m }))}
          onChange={(next) => apply(updateParam(params, "model", next))}
          placeholder="All models"
        />

        <label className="flex items-center gap-1 text-xs text-zinc-500">
          From
          <input
            type="date"
            min={options.dateMin}
            max={options.dateMax}
            value={filters.from}
            onChange={(e) => apply(updateParam(params, "from", e.target.value))}
            className="rounded-md border border-zinc-300 px-2 py-1 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </label>

        <label className="flex items-center gap-1 text-xs text-zinc-500">
          To
          <input
            type="date"
            min={options.dateMin}
            max={options.dateMax}
            value={filters.to}
            onChange={(e) => apply(updateParam(params, "to", e.target.value))}
            className="rounded-md border border-zinc-300 px-2 py-1 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </label>

        <label className="flex items-center gap-1 text-xs text-zinc-500">
          As of
          <input
            type="date"
            min={options.dateMin}
            max={options.dateMax}
            value={filters.asOf}
            onChange={(e) => apply(updateParam(params, "asof", e.target.value))}
            className="rounded-md border border-zinc-300 px-2 py-1 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </label>

        <button
          type="button"
          onClick={reset}
          title="Reset all filters"
          className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Reset
        </button>

        <div className="ml-auto flex items-center gap-2">
          <ShareButton />
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}

function ShareButton() {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore clipboard failures silently
    }
  };

  return (
    <button
      type="button"
      onClick={share}
      title="Copy shareable link with current filters"
      className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
    >
      {copied ? "Copied!" : "Share"}
    </button>
  );
}

function RoleSwitcher({
  value,
  onChange,
}: {
  value: Role;
  onChange: (r: Role) => void;
}) {
  return (
    <div
      className="flex overflow-hidden rounded-md border border-zinc-300 dark:border-zinc-700"
      role="group"
      aria-label="Role"
    >
      {ROLE_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={`px-2.5 py-1 text-xs font-medium ${
            value === option.value
              ? "bg-indigo-600 text-white"
              : "bg-white text-zinc-600 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function MultiSelect({
  label,
  values,
  options,
  onChange,
  placeholder,
}: {
  label: string;
  values: string[];
  options: { value: string; label: string }[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const selected = options.filter((o) => values.includes(o.value));
  const display =
    selected.length === 0
      ? placeholder
      : selected.length === options.length
        ? "All " + label.toLowerCase()
        : selected.map((o) => o.label).join(", ");

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="max-w-48 truncate rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
        title={display}
      >
        {values.length > 0 && (
          <span className="mr-1.5 rounded bg-indigo-100 px-1.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">
            {values.length}
          </span>
        )}
        {label}
      </button>
      {open && (
        <div
          role="listbox"
          aria-label={label}
          className="absolute left-0 z-50 mt-1 max-h-64 w-64 max-w-[calc(100vw-2rem)] overflow-auto rounded-md border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          <button
            type="button"
            onClick={() => onChange([])}
            className="w-full rounded px-2 py-1 text-left text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950"
          >
            Clear selection
          </button>
          {options.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm text-zinc-800 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <input
                type="checkbox"
                checked={values.includes(option.value)}
                onChange={() => {
                  const next = values.includes(option.value)
                    ? values.filter((v) => v !== option.value)
                    : [...values, option.value];
                  onChange(next);
                }}
                className="accent-indigo-600"
              />
              <span className="truncate">{option.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}