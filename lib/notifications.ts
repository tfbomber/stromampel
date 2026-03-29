// ============================================================
// lib/notifications.ts — Auto-schedule notifications for
// ALL upcoming cheap windows (works when app is closed).
//
// DESIGN: On each app load, cancel stale notifications and
// re-schedule up to 10 upcoming cheap-hour notifications for
// today + tomorrow. Expo local notifications fire at the
// scheduled date even when the app is fully closed.
// ============================================================

import * as Notifications from "expo-notifications";
import type { AppData, HourSlot }   from "./types";
import type { Device, Timing }       from "./settings";

const DEVICE_LABELS_DE: Record<Device, string> = {
  allgemein:     "Waschen oder Spülen",
  waschen:       "Waschmaschine",
  spuelmaschine: "Spülmaschine",
  trockner:      "Trockner",
};
const DEVICE_LABELS_EN: Record<Device, string> = {
  allgemein:     "Appliances",
  waschen:       "Washing Machine",
  spuelmaschine: "Dishwasher",
  trockner:      "Dryer",
};
const DEVICE_EMOJI: Record<Device, string> = {
  allgemein:     "🏠",
  waschen:       "🫧",
  spuelmaschine: "🍽️",
  trockner:      "🌀",
};

/** Find contiguous GREEN-hour windows from a list of HourSlots */
function extractCheapWindows(
  slots: HourSlot[],
  date: "today" | "tomorrow"
): { startHour: number; date: "today" | "tomorrow" }[] {
  const windows: { startHour: number; date: "today" | "tomorrow" }[] = [];
  let inWindow = false;

  for (const slot of slots) {
    if (slot.status === "GREEN" && !slot.isPast) {
      if (!inWindow) {
        windows.push({ startHour: slot.hour, date });
        inWindow = true;
      }
    } else {
      inWindow = false;
    }
  }
  return windows;
}

/**
 * Cancel all StromAmpel-scheduled notifications and re-schedule
 * notifications for all upcoming cheap windows.
 * Call this every time fresh data loads successfully.
 */
export async function scheduleAllUpcomingNotifications(
  data: AppData,
  device: Device,
  timing: Timing,
  lang: "de" | "en"
): Promise<void> {
  // 1. Check permission — silently abort if not granted
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") return;

  // 2. Cancel ALL previously scheduled notifications (avoids duplicates)
  await Notifications.cancelAllScheduledNotificationsAsync();

  // 3. Collect cheap windows from today + tomorrow
  const todayWindows    = extractCheapWindows(data.today.slots, "today");
  const tomorrowWindows = data.tomorrow
    ? extractCheapWindows(data.tomorrow.slots, "tomorrow")
    : [];

  const allWindows = [...todayWindows, ...tomorrowWindows];
  if (allWindows.length === 0) return;

  const devLabel = lang === "en" ? DEVICE_LABELS_EN[device] : DEVICE_LABELS_DE[device];
  const emoji    = DEVICE_EMOJI[device];
  const now      = new Date();
  let scheduled  = 0;
  const MAX      = 8; // max notifications per refresh cycle

  for (const w of allWindows) {
    if (scheduled >= MAX) break;

    // Compute the exact fire time = window start − timing minutes
    const target = new Date();
    if (w.date === "tomorrow") target.setDate(target.getDate() + 1);
    target.setHours(w.startHour, 0, 0, 0);
    const fireAt = new Date(target.getTime() - timing * 60_000);

    // Skip if fire time has already passed
    if (fireAt <= now) continue;

    // Optional: only fire during decent hours (7:00 – 21:00)
    const fireH = fireAt.getHours();
    if (fireH < 7 || fireH >= 21) continue;

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: lang === "en"
            ? `${emoji} StromAmpel · Cheap power starting soon`
            : `${emoji} StromAmpel · Günstige Phase startet gleich`,
          body: lang === "en"
            ? `Prepare ${devLabel} — starts at ${w.startHour}:00`
            : `${devLabel} jetzt vorbereiten — ab ${w.startHour} Uhr`,
          sound: true,
        },
        trigger: { type: "date", date: fireAt } as any,
      });
      scheduled++;
    } catch {
      // Silently ignore individual scheduling errors
    }
  }

  // Log for debugging (visible in Metro logs)
  console.log(
    `[Notifications] Scheduled ${scheduled} notification(s) for upcoming cheap windows.`
  );
}
