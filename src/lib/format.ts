export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-IN").format(Math.round(value));
}

export function formatCompact(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatCurrency(value: number): string {
  return `₹${formatNumber(value)}`;
}

export function formatCompactCurrency(value: number): string {
  return `₹${formatCompact(value)}`;
}

export function formatLakhCr(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (abs >= 1e7) return `${sign}₹${trimZeros(value / 1e7)} Cr`;
  if (abs >= 1e5) return `${sign}₹${trimZeros(value / 1e5)} L`;
  return formatCurrency(value);
}

function trimZeros(value: number): string {
  return value
    .toFixed(2)
    .replace(/\.?0+$/, "")
    .replace(/\.$/, "");
}

export function formatPercent(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatSignedPercent(value: number, digits = 1): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${formatPercent(Math.abs(value), digits)}`;
}

export function plural(value: number, word: string): string {
  return `${formatNumber(value)} ${word}${value === 1 ? "" : "s"}`;
}