// ============================================================
// lib/notifications.ts — Schedule notifications aligned with HeroCard
//
// STRATEGY (max 3/day, all meaningful):
//   1. Today's nextCheapWindow  → what HeroCard is currently pointing at
//   2. Today's cheapestWindow   → absolute cheapest today (if different from #1)
//   3. Tomorrow's cheapestWindow → best window of tomorrow
//
// Deduplication: if cheapest == next (same startHour), only send ONE
// notification tagged as "cheapest today".
//
// All notifications respect the user's timing offset and quiet hours (07–22).
// ============================================================

import * as Notifications from "expo-notifications";
import type { AppData, CheapWindow } from "./types";
import type { Device, Timing }       from "./settings";

// ── Labels ───────────────────────────────────────────────────
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

type WindowType = "next" | "cheapest_today" | "cheapest_tomorrow";

interface PendingNotif {
  window:   CheapWindow;
  type:     WindowType;
  fireAt:   Date;
}

/** Compute fire date for a window (start − timing minutes), respecting tomorrow offset */
function computeFireAt(
  window: CheapWindow,
  timingMinutes: number
): Date {
  const d = new Date();
  if (window.date === "tomorrow") d.setDate(d.getDate() + 1);
  d.setHours(window.startHour, 0, 0, 0);
  return new Date(d.getTime() - timingMinutes * 60_000);
}

/** Build notification title + body for a window */
function buildContent(
  type:      WindowType,
  window:    CheapWindow,
  device:    Device,
  lang:      "de" | "en"
): { title: string; body: string } {
  const devLabel = lang === "en" ? DEVICE_LABELS_EN[device] : DEVICE_LABELS_DE[device];
  const emoji    = DEVICE_EMOJI[device];
  const priceStr = `${window.avgCt.toFixed(1).replace(".", ",")} ct/kWh`;
  const timeStr  = `${window.startHour}:00–${window.endHour}:00`;

  if (lang === "en") {
    switch (type) {
      case "next":
        return {
          title: `${emoji} Cheap power window starting soon`,
          body:  `${devLabel}: ${timeStr} · ${priceStr}`,
        };
      case "cheapest_today":
        return {
          title: `⭐ Cheapest electricity today`,
          body:  `Best window: ${timeStr} · ${priceStr} — prepare ${devLabel}`,
        };
      case "cheapest_tomorrow":
        return {
          title: `📅 Tomorrow's cheapest window`,
          body:  `${timeStr} · ${priceStr} — plan ahead for ${devLabel}`,
        };
    }
  }

  switch (type) {
    case "next":
      return {
        title: `${emoji} Günstige Phase startet gleich`,
        body:  `${devLabel}: ${timeStr} · ${priceStr}`,
      };
    case "cheapest_today":
      return {
        title: `⭐ Günstigste Phase heute`,
        body:  `Bestes Fenster: ${timeStr} · ${priceStr} — ${devLabel} vorbereiten`,
      };
    case "cheapest_tomorrow":
      return {
        title: `📅 Günstigste Phase morgen`,
        body:  `${timeStr} · ${priceStr} — ${devLabel} einplanen`,
      };
  }
}

/**
 * Cancel all existing StromAmpel notifications and re-schedule
 * up to 3 meaningful notifications aligned with HeroCard windows.
 * Call this on every successful data load.
 */
export async function scheduleAllUpcomingNotifications(
  data:   AppData,
  device: Device,
  timing: Timing,
  lang:   "de" | "en"
): Promise<void> {
  // 1. Permission check — abort silently if not granted
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") return;

  // 2. Cancel previously scheduled notifications
  await Notifications.cancelAllScheduledNotificationsAsync();

  const now     = new Date();
  const nowHour = now.getHours();
  const pending: PendingNotif[] = [];

  // ── Collect candidate windows ─────────────────────────────
  const todayNext      = data.today.nextCheapWindow  ?? null;
  const todayCheapest  = data.today.cheapestWindow   ?? null;
  const tomorrowBest   = data.tomorrow?.cheapestWindow ?? null;

  // 3a. Today's nextCheapWindow (HeroCard-aligned)
  if (todayNext && todayNext.startHour > nowHour) {
    pending.push({
      window: todayNext,
      type:   "next",
      fireAt: computeFireAt(todayNext, timing),
    });
  }

  // 3b. Today's cheapestWindow — only if DIFFERENT start hour from next
  //     and not already past
  if (
    todayCheapest &&
    todayCheapest.startHour > nowHour &&
    todayCheapest.startHour !== todayNext?.startHour
  ) {
    pending.push({
      window: todayCheapest,
      type:   "cheapest_today",
      fireAt: computeFireAt(todayCheapest, timing),
    });
  } else if (
    // Both point to same hour → upgrade the "next" label to "cheapest"
    todayNext &&
    todayCheapest &&
    todayCheapest.startHour === todayNext.startHour &&
    todayNext.startHour > nowHour
  ) {
    // Replace "next" type with "cheapest_today" for clearer messaging
    const idx = pending.findIndex((p) => p.type === "next");
    if (idx !== -1) pending[idx].type = "cheapest_today";
  }

  // 3c. Tomorrow's cheapestWindow (always future)
  if (tomorrowBest) {
    pending.push({
      window: tomorrowBest,
      type:   "cheapest_tomorrow",
      fireAt: computeFireAt(tomorrowBest, timing),
    });
  }

  // ── Schedule each notification ────────────────────────────
  let scheduled = 0;
  for (const p of pending) {
    // Skip if fire time already passed
    if (p.fireAt <= now) continue;

    // Quiet hours: only send between 07:00 and 22:00
    const fireHour = p.fireAt.getHours();
    if (fireHour < 7 || fireHour >= 22) continue;

    const { title, body } = buildContent(p.type, p.window, device, lang);

    try {
      await Notifications.scheduleNotificationAsync({
        content: { title, body, sound: true },
        trigger: { type: "date", date: p.fireAt } as any,
      });
      scheduled++;
    } catch {
      // Silently ignore individual scheduling errors
    }
  }

  console.log(
    `[Notifications] Scheduled ${scheduled}/${pending.length} notification(s)` +
    ` (next=${todayNext?.startHour ?? "–"}, cheapest=${todayCheapest?.startHour ?? "–"}, tomorrow=${tomorrowBest?.startHour ?? "–"})`
  );
}
