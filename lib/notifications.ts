// ============================================================
// lib/notifications.ts — Schedule notifications (v4)
//
// Two notification modes:
//   "once"        — fires at user-picked time, then app resets to off on next
//                   foreground open (detected in App.tsx via notifyFireAt expiry)
//   "daily_smart" — fires every day at the start of the cheapest 3h core block
//                   (= HeroCard coreLabel startHour − timing minutes)
//
// Android fixes (v3, retained):
//   1. setNotificationChannelAsync required on Android 8+
//   2. channelId must be present in content
//   3. SchedulableTriggerInputTypes.DATE enum (not raw string)
//   4. Android 12+ exact alarm permission check
// ============================================================

import { Platform }       from "react-native";
import * as Notifications  from "expo-notifications";
import type { AppData, CheapWindow } from "./types";
import type { Timing, NotifyMode }   from "./settings";

// ── Android Channel ID ────────────────────────────────────────
export const CHANNEL_ID = "stromampel_alerts_v3";

// ── Guard window ──────────────────────────────────────────────
const GUARD_MS       = 10 * 60_000;  // once-mode: skip reschedule if fire is within 10 min
const SMART_GUARD_MS = 60 * 60_000;  // daily_smart: skip reschedule if any alarm fires within 60 min

/**
 * Create the Android notification channel.
 * MUST be called before scheduling any notification on Android 8+.
 */
export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name:             "Strom Ampel Alerts",
      importance:       Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 800, 400, 800],
      lightColor:       "#22c55e",
      enableVibrate:    true,
      sound:            "default",
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
    console.log("[Notifications] Android channel ready:", CHANNEL_ID);
  } catch (e) {
    console.error("[Notifications] Failed to create Android channel:", e);
  }
}

/**
 * Check Android 12+ exact alarm permission diagnostic.
 */
export async function checkExactAlarmPermission(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    const { status, canAskAgain } = await Notifications.getPermissionsAsync();
    console.log(
      `[Notifications] Permission check — status=${status} canAskAgain=${canAskAgain}. ` +
      `SCHEDULE_EXACT_ALARM is declared in app.json android.permissions.`
    );
    if (status !== "granted") {
      console.error("[Notifications] PERMISSION NOT GRANTED — all notifications will be blocked.");
    }
  } catch (e: any) {
    console.error("[Notifications] Permission check failed:", e?.message ?? e);
  }
}

/** Compute fire date for a window (startHour − timing minutes). */
function computeFireAt(startHour: number, date: "today" | "tomorrow", timingMinutes: number): Date {
  const d = new Date();
  if (date === "tomorrow") d.setDate(d.getDate() + 1);
  d.setHours(startHour, 0, 0, 0);
  const windowStart = d.getTime();
  const fireAt      = windowStart - timingMinutes * 60_000;
  return new Date(Math.min(fireAt, windowStart)); // clamp: never fire after window start
}

/** Build notification title + body using EFFECTIVE price (spot + surchargeCt). */
function buildContent(
  window: CheapWindow,
  mode:   NotifyMode,
  lang:   "de" | "en",
  surchargeCt: number,
): { title: string; body: string } {
  const effCt    = window.coreAvgCt + surchargeCt;
  const ct       = `≈ ${effCt.toFixed(1).replace(".", ",")} ct`;
  const label    = window.coreLabel;
  const isToday  = window.date === "today";

  if (lang === "en") {
    return mode === "daily_smart"
      ? { title: "⚡ Daily cheapest window",
          body:  `${isToday ? "Today" : "Tomorrow"}: ${label} · ø ${ct}/kWh` }
      : { title: "⚡ Cheap power window starting soon",
          body:  `${label} · ø ${ct}/kWh` };
  }
  return mode === "daily_smart"
    ? { title: "⚡ Günstigste Phase heute",
        body:  `${isToday ? "Heute" : "Morgen"}: ${label} · ø ${ct}/kWh` }
    : { title: "⚡ Günstige Phase startet gleich",
        body:  `${label} · ø ${ct}/kWh` };
}

/**
 * Schedule notifications based on notifyMode.
 *
 * "once" mode:
 *   Schedules exactly one notification at userPickedFireAt.
 *   App.tsx detects expiry on next foreground open and resets notifyActive=false.
 *
 * "daily_smart" mode:
 *   Schedules today's (and if available, tomorrow's) cheapest 3h core window.
 *   Re-scheduled on every foreground resume so it always reflects the latest data.
 */
export async function scheduleAllUpcomingNotifications(
  data:            AppData,
  notifyMode:      NotifyMode,
  timing:          Timing,
  lang:            "de" | "en",
  userPickedFireAt?: number,
  surchargeCt:     number = 23,
  forceSchedule:   boolean = false, // true = explicit user activation; bypass imminent-alarm guard
): Promise<void> {

  // ── 1. Channel ────────────────────────────────────────────
  await ensureAndroidChannel();

  // ── 2. Permission ─────────────────────────────────────────
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") {
    console.warn("[Notifications] Permission not granted, skipping schedule");
    return;
  }

  const now    = new Date();
  const nowMs  = now.getTime();

  // ── 3. Guard: skip cancel+reschedule if an alarm is imminent ─────────
  // IMPORTANT: forceSchedule=true bypasses this guard.
  // This guard must NOT apply to explicit user activations — only to silent
  // background load() calls where a pending alarm already exists.
  if (!forceSchedule && notifyMode === "once" && userPickedFireAt) {
    const msUntil = userPickedFireAt - nowMs;
    if (msUntil >= -GUARD_MS && msUntil <= GUARD_MS) {
      console.log(`[Notifications] GUARD(once): fire in ${Math.round(msUntil / 1000)}s — skip reschedule (background only)`);
      return;
    }
  }

  if (!forceSchedule && notifyMode === "daily_smart") {
    // Check if any already-scheduled notification fires within the next 60 min.
    // If so, do NOT cancel it — that would destroy the imminent alarm that Doze
    // is already holding, and rescheduling would push it to tomorrow.
    try {
      const existing = await Notifications.getAllScheduledNotificationsAsync();
      for (const n of existing) {
        const trigger = n.trigger as any;
        const scheduledMs: number | null =
          trigger?.dateMs ?? trigger?.value ?? trigger?.seconds != null
            ? (trigger.dateMs ?? trigger.value ?? trigger.seconds * 1000)
            : null;
        if (scheduledMs && scheduledMs - nowMs <= SMART_GUARD_MS && scheduledMs > nowMs - GUARD_MS) {
          console.log(`[Notifications] GUARD(daily_smart): alarm in ${Math.round((scheduledMs - nowMs) / 60000)}min — skip reschedule`);
          return;
        }
      }
    } catch (e) {
      console.warn("[Notifications] GUARD check failed, proceeding:", e);
    }
  }

  // ── 4. Cancel previous ──────────────────────────────────────────────
  await Notifications.cancelAllScheduledNotificationsAsync();
  console.log("[Notifications] Cleared previous notifications");

  const pending: { window: CheapWindow; fireAt: Date }[] = [];
  const nowHour = now.getHours();

  // ── 5. Build pending list by mode ─────────────────────────
  if (notifyMode === "once" && userPickedFireAt && userPickedFireAt > nowMs) {
    // ONE-TIME: fire at the user-picked epoch exactly
    const fireAt     = new Date(userPickedFireAt);
    const isToday    = fireAt.toDateString() === now.toDateString();
    const targetDate: "today" | "tomorrow" = isToday ? "today" : "tomorrow";
    const dayData    = isToday ? data.today : data.tomorrow;
    // Find closest slot to winHour (exact match → nearest neighbour → fallback 0)
    const winHour     = Math.min(23, fireAt.getHours() + Math.round(timing / 60));
    const nearestSlot = dayData?.slots
      .filter(s => s.priceCt !== null)
      .reduce((best: (typeof dayData.slots)[0] | null, s) =>
        best === null || Math.abs(s.hour - winHour) < Math.abs(best.hour - winHour) ? s : best,
        null);
    const avgCt       = nearestSlot?.priceCt ?? 0;
    const synth: CheapWindow = {
      startHour: winHour,
      endHour:   Math.min(23, winHour + 1),
      label:     `${winHour}:00–${Math.min(23, winHour + 1)}:00`,
      avgCt,
      date:      targetDate,
      coreLabel:  `${winHour}–${Math.min(23, winHour + 1)} Uhr`,
      coreAvgCt:  Math.round(avgCt * 10) / 10,
    };
    pending.push({ window: synth, fireAt });
    console.log(`[Notifications] once: fireAt=${fireAt.toISOString()} window=${winHour}:00`);

  } else if (notifyMode === "daily_smart") {
    // DAILY SMART: fire at coreLabel startHour - timing for today AND tomorrow
    const todayCore    = data.today.nextCheapWindow ?? data.today.cheapestWindow ?? null;
    const tomorrowCore = data.tomorrow?.cheapestWindow ?? null;

    if (todayCore && todayCore.startHour > nowHour) {
      const fireAt = computeFireAt(todayCore.startHour, "today", timing);
      if (fireAt > now) {
        pending.push({ window: todayCore, fireAt });
        console.log(`[Notifications] daily_smart today: ${todayCore.coreLabel} fireAt=${fireAt.toISOString()}`);
      }
    }
    if (tomorrowCore) {
      const fireAt = computeFireAt(tomorrowCore.startHour, "tomorrow", timing);
      pending.push({ window: tomorrowCore, fireAt });
      console.log(`[Notifications] daily_smart tomorrow: ${tomorrowCore.coreLabel} fireAt=${fireAt.toISOString()}`);
    }
  }

  // ── 6. Schedule each ──────────────────────────────────────
  let scheduled = 0;
  for (const p of pending) {
    if (p.fireAt <= now) {
      console.log(`[Notifications] SKIP (past): fireAt=${p.fireAt.toISOString()}`);
      continue;
    }
    // Quiet hours (07:00–22:00) filter — always active
    const fireHour = p.fireAt.getHours();
    if (fireHour < 7 || fireHour >= 22) {
      console.log(`[Notifications] SKIP (quiet hours ${fireHour}h)`);
      continue;
    }

    const { title, body } = buildContent(p.window, notifyMode, lang, surchargeCt);
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title, body,
          sound: true,
          ...(Platform.OS === "android" ? { channelId: CHANNEL_ID } : {}),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          // Fire 2 min early to compensate for Doze delays.
          // Clamped to now+3s so we never pass a past-dated trigger
          // (expo-notifications silently drops past triggers on Android).
          date: new Date(Math.max(Date.now() + 3000, p.fireAt.getTime() - 120_000)),
          ...(Platform.OS === "android" ? { channelId: CHANNEL_ID } : {}),
        },
      });
      scheduled++;
      console.log(`[Notifications] ✓ Scheduled: "${title}" at ${p.fireAt.toLocaleTimeString()}`);
    } catch (err) {
      console.error(`[Notifications] ✗ FAILED:`, err);
    }
  }

  console.log(`[Notifications] Done: ${scheduled}/${pending.length} scheduled (mode=${notifyMode})`);
}
