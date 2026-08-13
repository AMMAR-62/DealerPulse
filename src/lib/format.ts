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