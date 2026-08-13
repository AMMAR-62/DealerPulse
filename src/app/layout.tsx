import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import Nav from "@/components/Nav";
import MobileNav from "@/components/MobileNav";
import FilterBar, { type FilterOptions } from "@/components/FilterBar";
import { getDataset, buildIndex } from "@/lib/data/load";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DealerPulse — Dealership Performance Dashboard",
  description:
    "Real-time dealership performance dashboard across 5 branches and 30 sales reps.",
};

function buildFilterOptions(): FilterOptions {
  const index = buildIndex(getDataset());
  return {
    branches: index.branchIds
      .map((id) => index.branchesById.get(id))
      .filter((b) => Boolean(b))
      .map((b) => ({ id: b!.id, name: b!.name, city: b!.city })),
    reps: index.repIds
      .map((id) => index.repsById.get(id))
      .filter((r) => Boolean(r))
      .map((r) => ({ id: r!.id, name: r!.name, branchId: r!.branch_id })),
    sources: index.sources,
    models: index.models,
    dateMin: index.dateMin,
    dateMax: index.dateMax,
  };
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  const options = buildFilterOptions();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("dealerpulse-theme");if(t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.classList.add("dark")}}catch(e){}})()`,
          }}
        />
      </head>
      <body className="flex min-h-full flex-col pb-14 md:pb-0">
        <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/80 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/80">
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="inline-block h-6 w-6 rounded bg-indigo-600" />
              <span className="text-base font-semibold tracking-tight">
                DealerPulse
              </span>
              <span className="hidden text-xs text-zinc-400 sm:inline">
                Dealership performance · Jun–Dec 2025
              </span>
            </div>
            <Nav />
          </div>
        </header>
        <Suspense fallback={null}>
          <FilterBar options={options} />
        </Suspense>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-zinc-200 px-4 py-3 text-xs text-zinc-400 dark:border-zinc-800">
          DealerPulse — synthetic dealership dataset · point-in-time analytics
          · Jun–Dec 2025
        </footer>
        <MobileNav />
      </body>
    </html>
  );
}