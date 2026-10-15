/** Indian-style currency, compact for large values (₹12.4L, ₹1.2Cr). */
export function formatCurrency(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e7) return `₹${trim(value / 1e7)}Cr`;
  if (abs >= 1e5) return `₹${trim(value / 1e5)}L`;
  return `₹${value.toLocaleString('en-IN')}`;
}

/** Full (non-compact) rupee amount, e.g. ₹24,500. */
export function formatRupees(value: number): string {
  return `₹${value.toLocaleString('en-IN')}`;
}

export function formatNumber(value: number): string {
  return value.toLocaleString('en-IN');
}

export function formatPercent(value: number): string {
  return `${Math.abs(value).toFixed(1)}%`;
}

function trim(n: number): string {
  return n.toFixed(2).replace(/\.?0+$/, '');
}

export function getGreeting(date: Date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}