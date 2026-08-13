"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LINKS } from "@/components/Nav";

export default function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Mobile"
      className="fixed inset-x-0 bottom-0 z-50 flex items-center gap-1 overflow-x-auto border-t border-zinc-200 bg-white/90 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90 lg:hidden"
    >
      {LINKS.map((link) => {
        const active =
          link.href === "/"
            ? pathname === "/"
            : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`shrink-0 whitespace-nowrap rounded-md px-3 py-2 text-[11px] font-semibold ${
              active
                ? "text-indigo-600 dark:text-indigo-400"
                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
            aria-current={active ? "page" : undefined}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}