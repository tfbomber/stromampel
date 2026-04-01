// ============================================================
// lib/notifications.ts — Schedule notifications aligned with HeroCard
//
// ROOT CAUSE FIXES (v2):
//   1. Android 8+ requires setNotificationChannelAsync — without it
//      ALL local notifications are silently dropped.
//   2. Notification content must include channelId matching the channel.
//   3. Errors were silently swallowed — now logged verbosely.
//   4. Quiet-hours filter removed for user-picked notifications
//      (user explicitly chose the time).
// ============================================================

import { Platform }      from "react-native";
import * as Notifications from "expo-notifications";
import type { AppData, CheapWindow } from "./types";
import type { Device, Timing }       from "./settings";

// ── Android Channel ID ────────────────────────────────────────
export const CHANNEL_ID = "stromampel_alerts";

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
  isUserPicked?: boolean;
}

/**
 * Create the Android notification channel.
 * MUST be called before scheduling any notification on Android 8+.
 * Safe to call multiple times (idempotent).
 */
export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name:             "StromAmpel Alerts",
      importance:       Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 400, 200, 400],
      lightColor:       "#22c55e",
      enableVibrate:    true,
      // 'default' means use the system default notification sound
      sound:            "default",
    });
    console.log("[Notifications] Android channel ready:", CHANNEL_ID);
  } catch (e) {
    console.error("[Notifications] Failed to create Android channel:", e);
  }
}

/** Compute fire date for a window (start − timing minutes), respecting tomorrow offset */
function computeFireAt(window: CheapWindow, timingMinutes: number): Date {
  const d = new Date();
  if (window.date === "tomorrow") d.setDate(d.getDate() + 1);
  d.setHours(window.startHour, 0, 0, 0);
  return new Date(d.getTime() - timingMinutes * 60_000);
}

/** Build notification title + body for a window */
function buildContent(
  type:   WindowType,
  window: CheapWindow,
  device: Device,
  lang:   "de" | "en"
): { title: string; body: string } {
  const devLabel = lang === "en" ? DEVICE_LABELS_EN[device] : DEVICE_LABELS_DE[device];
  const emoji    = DEVICE_EMOJI[device];
  const priceStr = `${window.avgCt.toFixed(1).replace(".", ",")} ct/kWh`;
  const timeStr  = `${window.startHour}:00–${window.endHour}:00`;

  if (lang === "en") {
    switch (type) {
      case "next":
        return { title: `${emoji} Cheap power window starting soon`, body: `${devLabel}: ${timeStr} · ${priceStr}` };
      case "cheapest_today":
        return { title: `⭐ Cheapest electricity today`, body: `Best window: ${timeStr} · ${priceStr} — prepare ${devLabel}` };
      case "cheapest_tomorrow":
        return { title: `📅 Tomorrow's cheapest window`, body: `${timeStr} · ${priceStr} — plan ahead for ${devLabel}` };
    }
  }

  switch (type) {
    case "next":
      return { title: `${emoji} Günstige Phase startet gleich`, body: `${devLabel}: ${timeStr} · ${priceStr}` };
    case "cheapest_today":
      return { title: `⭐ Günstigste Phase heute`, body: `Bestes Fenster: ${timeStr} · ${priceStr} — ${devLabel} vorbereiten` };
    case "cheapest_tomorrow":
      return { title: `📅 Günstigste Phase morgen`, body: `${timeStr} · ${priceStr} — ${devLabel} einplanen` };
  }
}

/**
 * Cancel all existing StromAmpel notifications and re-schedule.
 *
 * If `userPickedFireAt` (epoch ms) is provided and still in the future,
 * that exact time is scheduled as the primary notification (user-pick mode).
 * Otherwise auto-selects HeroCard windows (auto mode, max 2–3/day).
 */
export async function scheduleAllUpcomingNotifications(
  data:             AppData,
  device:           Device,
  timing:           Timing,
  lang:             "de" | "en",
  userPickedFireAt?: number,   // epoch ms — user's explicit pick
): Promise<void> {

  // ── 1. Ensure Android channel exists ──────────────────────
  await ensureAndroidChannel();

  // ── 2. Permission check ───────────────────────────────────
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") {
    console.warn("[Notifications] Permission not granted, skipping schedule");
    return;
  }

  // ── 3. Cancel previous ────────────────────────────────────
  await Notifications.cancelAllScheduledNotificationsAsync();
  console.log("[Notifications] Cleared all previous notifications");

  const now     = new Date();
  const nowHour = now.getHours();
  const pending: PendingNotif[] = [];

  // ── Mode A: User picked a specific time ───────────────────
  if (userPickedFireAt && userPickedFireAt > now.getTime()) {
    const fireAt     = new Date(userPickedFireAt);
    const isToday    = fireAt.toDateString() === now.toDateString();
    const targetDate: "today" | "tomorrow" = isToday ? "today" : "tomorrow";
    // Reconstruct window hour: fireAt + timing minutes
    const winHour    = Math.min(23, fireAt.getHours() + Math.round(timing / 60));
    const dayData    = isToday ? data.today : data.tomorrow;
    const slot       = dayData?.slots.find(s => s.hour === winHour);
    const avgCt      = slot?.priceCt ?? 0;

    const syntheticWindow: CheapWindow = {
      startHour: winHour,
      endHour:   Math.min(23, winHour + 1),
      label:     `${winHour}:00–${Math.min(23, winHour + 1)}:00`,
      avgCt,
      date:      targetDate,
    };
    pending.push({ window: syntheticWindow, type: "next", fireAt, isUserPicked: true });
    console.log(`[Notifications] User-pick mode: fireAt=${fireAt.toISOString()} window=${winHour}:00`);

    // Also schedule tomorrow's best window unless user already picked tomorrow
    const tomorrowBest = data.tomorrow?.cheapestWindow ?? null;
    if (tomorrowBest && isToday) {
      pending.push({
        window: tomorrowBest,
        type:   "cheapest_tomorrow",
        fireAt: computeFireAt(tomorrowBest, timing),
      });
    }

  } else {
    // ── Mode B: Auto HeroCard windows ─────────────────────────
    console.log("[Notifications] Auto mode: selecting from HeroCard windows");
    const todayNext     = data.today.nextCheapWindow  ?? null;
    const todayCheapest = data.today.cheapestWindow   ?? null;
    const tomorrowBest  = data.tomorrow?.cheapestWindow ?? null;

    if (todayNext && todayNext.startHour > nowHour) {
      pending.push({ window: todayNext, type: "next", fireAt: computeFireAt(todayNext, timing) });
    }
    if (todayCheapest && todayCheapest.startHour > nowHour && todayCheapest.startHour !== todayNext?.startHour) {
      pending.push({ window: todayCheapest, type: "cheapest_today", fireAt: computeFireAt(todayCheapest, timing) });
    } else if (todayNext && todayCheapest && todayCheapest.startHour === todayNext.startHour && todayNext.startHour > nowHour) {
      const idx = pending.findIndex(p => p.type === "next");
      if (idx !== -1) pending[idx].type = "cheapest_today";
    }
    if (tomorrowBest) {
      pending.push({ window: tomorrowBest, type: "cheapest_tomorrow", fireAt: computeFireAt(tomorrowBest, timing) });
    }
  }

  // ── 4. Schedule each notification ─────────────────────────
  let scheduled = 0;
  for (const p of pending) {
    // Skip already-past notifications
    if (p.fireAt <= now) {
      console.log(`[Notifications] SKIP (past): ${p.type} fireAt=${p.fireAt.toISOString()}`);
      continue;
    }

    // Quiet hours (07:00–22:00) — only for AUTO mode
    // User-picked times are always honoured
    if (!p.isUserPicked) {
      const fireHour = p.fireAt.getHours();
      if (fireHour < 7 || fireHour >= 22) {
        console.log(`[Notifications] SKIP (quiet hours ${fireHour}h): ${p.type}`);
        continue;
      }
    }

    const { title, body } = buildContent(p.type, p.window, device, lang);
    console.log(`[Notifications] Scheduling ${p.type} at ${p.fireAt.toISOString()} — "${title}"`);

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound:     "default",
          // Android: reference the channel we created
          ...(Platform.OS === "android" ? { channelId: CHANNEL_ID } : {}),
        },
        trigger: { type: "date", date: p.fireAt } as any,
      });
      scheduled++;
      console.log(`[Notifications] ✓ Scheduled: ${p.type} at ${p.fireAt.toLocaleTimeString()}`);
    } catch (err) {
      console.error(`[Notifications] ✗ FAILED to schedule ${p.type}:`, err);
    }
  }

  console.log(`[Notifications] Done: ${scheduled}/${pending.length} scheduled (mode=${userPickedFireAt ? "user-pick" : "auto"})`);
}
