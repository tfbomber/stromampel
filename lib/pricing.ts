// ============================================================
// StromAmpel App — Provider-specific pricing
// Applies Anbieter markup + 19% MwSt on top of raw spot price
// ============================================================

import type { HourSlot, DayData, CheapWindow } from "./types";

/**
 * Additional ct/kWh charged by the provider ABOVE the raw spot price (netto).
 * Source: approximate 2024/2025 published tariffs.
 * Grid fees (Netzentgelt) are NOT included — they vary by region.
 */
export const ANBIETER_MARKUP_CT: Record<string, number> = {
  awattar: 0.5,   // minimal pass-through margin
  tibber:  3.5,   // subscription model + per-kWh fee
  ostrom:  2.5,
  eprimo:  1.5,
  other:   1.0,
  "":      0,     // no provider selected → raw spot only
};

const VAT = 1.19; // German MwSt

/** Adjust a single raw spot price (ct/kWh) for the selected provider + VAT. */
export function adjustPriceCt(rawCt: number, anbieter: string): number {
  const markup = ANBIETER_MARKUP_CT[anbieter] ?? 0;
  return Math.round(((rawCt + markup) * VAT) * 10) / 10;
}

/** Remap all priceCt values in a slot array. VAT always applied; markup = 0 when no provider. */
export function adjustSlots(slots: HourSlot[], anbieter: string): HourSlot[] {
  return slots.map((s) => ({
    ...s,
    priceCt: s.priceCt !== null ? adjustPriceCt(s.priceCt, anbieter) : null,
  }));
}

/** Adjust a CheapWindow's avgCt for the provider + VAT. */
function adjustWindow(w: CheapWindow | null, anbieter: string): CheapWindow | null {
  if (!w) return w;
  return { ...w, avgCt: adjustPriceCt(w.avgCt, anbieter) };
}

/** Return a fully provider-adjusted copy of DayData. VAT always applied. */
export function adjustDayData(day: DayData | null, anbieter: string): DayData | null {
  if (!day) return day;
  return {
    slots:           adjustSlots(day.slots,          anbieter),
    cheapestWindow:  adjustWindow(day.cheapestWindow,  anbieter),
    nextCheapWindow: adjustWindow(day.nextCheapWindow, anbieter),
  };
}
