// ============================================================
// StromAmpel App — Cheap Window Finder
// (ported from web lib/windows.ts)
// ============================================================

import type { HourSlot, CheapWindow } from "./types";

const CHEAP_MIN_HOURS = 2;
const CHEAP_THRESHOLD = 0.88; // avg fraction

function buildLabel(start: number, end: number): string {
  return `${start}–${end} Uhr`;
}

/** Find the next cheap window starting from `fromHour` */
export function findNextCheapWindow(
  slots: HourSlot[],
  fromHour: number,
  date: "today" | "tomorrow"
): CheapWindow | null {
  const future = slots.filter((s) => s.hour >= fromHour && s.priceCt !== null);
  if (future.length === 0) return null;

  const avg = future.reduce((sum, s) => sum + (s.priceCt ?? 0), 0) / future.length;

  // Find contiguous cheap blocks
  let best: CheapWindow | null = null;
  let i = 0;
  while (i < future.length) {
    const slot = future[i];
    if ((slot.priceCt ?? Infinity) <= avg * CHEAP_THRESHOLD) {
      let j = i;
      let sum = 0;
      while (j < future.length && (future[j].priceCt ?? Infinity) <= avg * CHEAP_THRESHOLD) {
        sum += future[j].priceCt ?? 0;
        j++;
      }
      const length = j - i;
      if (length >= CHEAP_MIN_HOURS) {
        const avgCt = sum / length;
        const candidate: CheapWindow = {
          startHour: future[i].hour,
          endHour: future[j - 1].hour + 1,
          label: buildLabel(future[i].hour, future[j - 1].hour + 1),
          avgCt: Math.round(avgCt * 10) / 10,
          date,
        };
        if (!best || candidate.avgCt < best.avgCt) best = candidate;
        i = j;
        continue;
      }
    }
    i++;
  }
  return best;
}

/** Find the globally cheapest window of the day */
export function findCheapestWindow(
  slots: HourSlot[],
  date: "today" | "tomorrow"
): CheapWindow | null {
  return findNextCheapWindow(slots, 0, date);
}
