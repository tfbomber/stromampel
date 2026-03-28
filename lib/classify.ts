// ============================================================
// StromAmpel App — Price Classification
// ============================================================

import type { Status } from "./types";

/** Classify a price relative to the day average */
export function classifyPrice(priceCt: number, avgCt: number): Status {
  if (priceCt <= avgCt * 0.85) return "GREEN";
  if (priceCt <= avgCt * 1.10) return "YELLOW";
  return "RED";
}

export function statusToLabel(status: Status, lang?: string): string {
  if (lang === "en") {
    switch (status) {
      case "GREEN":   return "Currently cheap";
      case "YELLOW":  return "Fairly OK";
      case "RED":     return "Currently expensive";
      default:        return "Loading …";
    }
  }
  switch (status) {
    case "GREEN":   return "Jetzt günstig";
    case "YELLOW":  return "Gerade okay";
    case "RED":     return "Jetzt teuer";
    default:        return "Wird geladen …";
  }
}

export function statusToEmoji(status: Status): string {
  switch (status) {
    case "GREEN":  return "🟢";
    case "YELLOW": return "🟡";
    case "RED":    return "🔴";
    default:       return "⚪";
  }
}

/** Map status → background color string for RN */
export function statusToColor(status: Status): string {
  switch (status) {
    case "GREEN":  return "#dcfce7"; // green-100
    case "YELLOW": return "#fef9c3"; // yellow-100
    case "RED":    return "#fee2e2"; // red-100
    default:       return "#f3f4f6"; // gray-100
  }
}

export function statusToBorderColor(status: Status): string {
  switch (status) {
    case "GREEN":  return "#16a34a";
    case "YELLOW": return "#ca8a04";
    case "RED":    return "#dc2626";
    default:       return "#d1d5db";
  }
}

export function statusToSlotColor(status: Status): string {
  switch (status) {
    case "GREEN":  return "#22c55e";
    case "YELLOW": return "#eab308";
    case "RED":    return "#ef4444";
    default:       return "#d1d5db";
  }
}

// Lerp between two hex colors by fraction t (0–1)
function lerpColor(a: string, b: string, t: number): string {
  const p = (hex: string) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const [rA, gA, bA] = p(a);
  const [rB, gB, bB] = p(b);
  return `rgb(${clamp(rA + (rB - rA) * t)},${clamp(gA + (gB - gA) * t)},${clamp(bA + (bB - bA) * t)})`;
}

// Per-status color endpoints: [cheapest-end, most-expensive-end]
const STATUS_GRADIENT: Record<string, [string, string]> = {
  GREEN:   ["#86efac", "#15803d"],
  YELLOW:  ["#fde047", "#f97316"],
  RED:     ["#fca5a5", "#991b1b"],
  UNKNOWN: ["#e5e7eb", "#9ca3af"],
};

/**
 * Continuous green → yellow → red heatmap across the full day price range.
 * t=0 (cheapest) = vivid green, t=1 (most expensive) = vivid red.
 * status param kept for API compatibility but is not used.
 */
export function priceToGradientColor(
  priceCt: number,
  dayMin: number,
  dayMax: number,
  status: Status
): string {
  const range = dayMax - dayMin;
  const t = range > 0 ? Math.max(0, Math.min(1, (priceCt - dayMin) / range)) : 0;
  // 3-stop: green → yellow (first half) then yellow → red (second half)
  if (t <= 0.5) {
    return lerpColor("#22c55e", "#facc15", t * 2);
  }
  return lerpColor("#facc15", "#ef4444", (t - 0.5) * 2);
}
