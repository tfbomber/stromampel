// ============================================================
// StromAmpel App — Data Fetcher
// Calls aWATTar public API directly (no backend needed)
// ============================================================

import type { HourSlot, DayData, AppData } from "./types";
import { classifyPrice } from "./classify";
import { findNextCheapWindow, findCheapestWindow } from "./windows";

const AWATTAR_URL = "https://api.awattar.de/v1/marketdata";

interface AwattarEntry {
  start_timestamp: number; // ms
  end_timestamp: number;
  marketprice: number;     // EUR/MWh
  unit: string;
}

function eurMwhToCt(eurMwh: number): number {
  // EUR/MWh → ct/kWh: divide by 10
  // Add approximate average surcharges for display: taxes + grid ~25ct avg total
  // We show ONLY the spot component as "Referenzpreis"
  return Math.round((eurMwh / 10) * 10) / 10;
}

function buildSlots(entries: AwattarEntry[], date: Date): HourSlot[] {
  const nowHour = new Date().getHours();
  const isToday = date.toDateString() === new Date().toDateString();

  const prices: Record<number, number> = {};
  entries.forEach((e) => {
    const d = new Date(e.start_timestamp);
    if (d.toDateString() === date.toDateString()) {
      prices[d.getHours()] = eurMwhToCt(e.marketprice);
    }
  });

  // Use only remaining hours (from nowHour onward for today, all for tomorrow)
  // as the avg baseline — matching findNextCheapWindow's baseline exactly.
  const fromHour = isToday ? nowHour : 0;
  const futureValues = Object.entries(prices)
    .filter(([h]) => Number(h) >= fromHour)
    .map(([, v]) => v);
  const avg = futureValues.length > 0
    ? futureValues.reduce((a, b) => a + b, 0) / futureValues.length
    : 0;

  return Array.from({ length: 24 }, (_, h) => {
    const priceCt = prices[h] ?? null;
    return {
      hour: h,
      priceCt,
      status: priceCt !== null ? classifyPrice(priceCt, avg) : "UNKNOWN",
      isPast: isToday && h < nowHour,
      isCurrentHour: isToday && h === nowHour,
    };
  });
}

function buildDayData(slots: HourSlot[], date: "today" | "tomorrow"): DayData {
  const nowHour = new Date().getHours();
  const fromHour = date === "today" ? nowHour : 0;
  return {
    slots,
    cheapestWindow: findCheapestWindow(slots, date),
    nextCheapWindow: findNextCheapWindow(slots, fromHour, date),
  };
}

export async function fetchAppData(): Promise<AppData> {
  // Start from today's midnight so all past hours of today have real price data.
  // aWATTar returns both historical and future hourly prices within the window.
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const start = todayStart.getTime();
  const end   = start + 54 * 60 * 60 * 1000; // 54 h: today (24h) + tomorrow (24h) + buffer
  const url = `${AWATTAR_URL}?start=${start}&end=${end}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  let res: Response;
  try {
    res = await fetch(url, { signal: controller.signal });
  } catch (e: any) {
    clearTimeout(timeout);
    throw new Error(`aWATTar fetch failed: ${e?.message ?? "timeout"}`);
  }
  clearTimeout(timeout);
  if (!res.ok) throw new Error(`aWATTar API error: ${res.status}`);
  const json = await res.json();
  const entries: AwattarEntry[] = json.data ?? [];

  const today    = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const todaySlots    = buildSlots(entries, today);
  const tomorrowSlots = buildSlots(entries, tomorrow);

  const todayData    = buildDayData(todaySlots,    "today");
  const tomorrowData = tomorrowSlots.some((s) => s.priceCt !== null)
    ? buildDayData(tomorrowSlots, "tomorrow")
    : null;

  const nowHour   = new Date().getHours();
  const current   = todaySlots.find((s) => s.hour === nowHour) ?? null;

  return { current, today: todayData, tomorrow: tomorrowData };
}
