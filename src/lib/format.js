export function formatCostUsd(cost) {
  if (cost === null || cost === undefined) return "N/A";
  return `$${Number(cost).toFixed(2)}`;
}

// Shows USD with an approximate THB conversion alongside it, e.g. "$0.80 (≈29 บาท)".
// `rate` is the server-configured USD_TO_THB_RATE (display-only, not a live FX rate) —
// if it isn't available yet (config still loading), falls back to USD-only.
export function formatCostWithThb(cost, rate) {
  if (cost === null || cost === undefined) return "N/A";
  const usd = Number(cost);
  if (!rate) return formatCostUsd(usd);
  const thb = usd * Number(rate);
  return `$${usd.toFixed(2)} (≈${thb.toLocaleString("th-TH", { maximumFractionDigits: 0 })} บาท)`;
}
