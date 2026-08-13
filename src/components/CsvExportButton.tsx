"use client";

export default function CsvExportButton({
  filename,
  headers,
  rows,
}: {
  filename: string;
  headers: { key: string; label: string }[];
  rows: readonly unknown[];
}) {
  const exportCsv = () => {
    const headerLine = headers.map((h) => h.label).join(",");
    const lines = rows.map((r) => {
      const row = r as Record<string, unknown>;
      return headers
        .map((h) => row[h.key])
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(",");
    });
    const csv = [headerLine, ...lines].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      type="button"
      onClick={exportCsv}
      className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
    >
      Export CSV ({rows.length})
    </button>
  );
}