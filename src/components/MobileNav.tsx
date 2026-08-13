"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LINKS } from "@/components/Nav";

export default function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Mobile"
      className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-around border-t border-zinc-200 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90 md:hidden"
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
            className={`flex-1 px-2 py-2.5 text-center text-[10px] font-semibold ${
              active
                ? "text-indigo-600 dark:text-indigo-400"
                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
            aria-current={active ? "page" : undefined}
          >
            <span className="block truncate">{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}