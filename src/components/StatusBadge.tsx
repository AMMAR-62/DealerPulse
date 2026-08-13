const palette: Record<string, string> = {
  new: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  contacted: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  test_drive: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  negotiation: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  order_placed: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  delivered: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  lost: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
        palette[status] ?? "bg-zinc-100 text-zinc-700"
      }`}
    >
      {status.replace("_", " ")}
    </span>
  );
}