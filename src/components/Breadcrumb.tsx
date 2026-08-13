import Link from "next/link";

export interface Crumb {
  label: string;
  href?: string;
}

export default function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && (
            <span className="text-zinc-300 dark:text-zinc-600">/</span>
          )}
          {item.href ? (
            <Link
              href={item.href}
              className="text-zinc-500 transition-colors hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400"
            >
              {item.label}
            </Link>
          ) : (
            <span
              className="truncate font-medium text-zinc-800 dark:text-zinc-100"
              aria-current="page"
            >
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}