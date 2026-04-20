// ============================================================
// StromAmpel App — Cheap Window Finder
// v2: Negative-avg bug fix + Best-3h Core Block extraction
// ============================================================

import type { HourSlot, CheapWindow } from "./types";

const CHEAP_MIN_HOURS  = 2;
const CHEAP_THRESHOLD  = 0.12; // price must be at least 12% cheaper than avg
const CORE_BLOCK_HOURS = 3;    // hours to use for the "actionable" core label

function buildLabel(start: number, end: number): string {
  return `${start}–${end} Uhr`;
}

/**
 * Find the best consecutive CORE_BLOCK_HOURS sub-block within a set of slots.
 *
 * Returns { startHour, endHour, avgCt } for the block with the lowest average
 * ct/kWh.  Falls back to the cheapest single hour (wrapped to a 1-hour block)
 * if there are fewer than CORE_BLOCK_HOURS slots available.
 */
function findBestCoreBlock(
  slots: HourSlot[]
): { startHour: number; endHour: number; avgCt: number } | null {
  if (slots.length === 0) return null;

  const n = slots.length;
  const k = Math.min(CORE_BLOCK_HOURS, n); // actual block size (handles short windows)

  let bestAvg   = Infinity;
  let bestStart = 0;

  for (let i = 0; i <= n - k; i++) {
    const blockAvg =
      slots.slice(i, i + k).reduce((sum, s) => sum + (s.priceCt ?? 0), 0) / k;
    if (blockAvg < bestAvg) {
      bestAvg   = blockAvg;
      bestStart = i;
    }
  }

  return {
    startHour: slots[bestStart].hour,
    endHour:   slots[bestStart + k - 1].hour + 1,
    avgCt:     Math.round(bestAvg * 10) / 10,
  };
}

/** Find the next cheap window starting from `fromHour`.
 *
 * Bug fix (v2): replaced `avg * CHEAP_THRESHOLD` with `avg - |avg| * CHEAP_THRESHOLD`.
 * When avg is negative, `avg * 0.88` becomes less negative (closer to 0), inverting
 * the comparison so every slot appears "cheap". Using the absolute-value form keeps
 * the threshold correctly BELOW avg regardless of sign.
 */
export function findNextCheapWindow(
  slots: HourSlot[],
  fromHour: number,
  date: "today" | "tomorrow"
): CheapWindow | null {
  const future = slots.filter((s) => s.hour >= fromHour && s.priceCt !== null);
  if (future.length === 0) return null;

  const avg    = future.reduce((sum, s) => sum + (s.priceCt ?? 0), 0) / future.length;
  // Threshold: 12% cheaper than avg — correct for positive AND negative avg
  const cheapCeil = avg - Math.abs(avg) * CHEAP_THRESHOLD;

  // Find contiguous cheap blocks
  let best: CheapWindow | null = null;
  let i = 0;
  while (i < future.length) {
    const slot = future[i];
    if ((slot.priceCt ?? Infinity) <= cheapCeil) {
      let j   = i;
      let sum = 0;
      while (j < future.length && (future[j].priceCt ?? Infinity) <= cheapCeil) {
        sum += future[j].priceCt ?? 0;
        j++;
      }
      const length = j - i;
      if (length >= CHEAP_MIN_HOURS) {
        const windowSlots = future.slice(i, j);
        const avgCt       = sum / length;
        const core        = findBestCoreBlock(windowSlots);

        const candidate: CheapWindow = {
          startHour: future[i].hour,
          endHour:   future[j - 1].hour + 1,
          label:     buildLabel(future[i].hour, future[j - 1].hour + 1),
          avgCt:     Math.round(avgCt * 10) / 10,
          date,
          coreLabel:     core ? buildLabel(core.startHour, core.endHour) : buildLabel(future[i].hour, future[j - 1].hour + 1),
          coreAvgCt:     core ? core.avgCt : Math.round(avgCt * 10) / 10,
          coreStartHour: core ? core.startHour : future[i].hour,
        };

        if (!best || candidate.coreAvgCt < best.coreAvgCt) best = candidate;
        i = j;
        continue;
      }
    }
    i++;
  }
  return best;
}

/** Find the globally cheapest window of the day (used for cheapestWindow field). */
export function findCheapestWindow(
  slots: HourSlot[],
  date: "today" | "tomorrow"
): CheapWindow | null {
  return findNextCheapWindow(slots, 0, date);
}
