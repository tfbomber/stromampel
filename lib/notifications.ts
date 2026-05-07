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
const QUIET_HOUR_START = 22;
const QUIET_HOUR_END   = 7;
const TEST_NOTIFICATION_DELAY_MS = 5_000;

export type QuietHoursEffect = "none" | "clamped" | "skipped";

interface PendingNotification {
  window: CheapWindow;
  fireAt: Date;
}

export interface NotificationPreview {
  nextPreciseAt: number | null;
  nextPreciseLabel: string | null;
  nextPreciseQuietHours: QuietHoursEffect | null;
  nextFallbackAt: number | null;
  fallbackOnly: boolean;
  noPreciseReason: "none" | "quiet_hours" | "no_window";
}

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

function applyQuietHours(fireAt: Date): { fireAt: Date | null; effect: QuietHoursEffect } {
  const next = new Date(fireAt);
  const fireHour = next.getHours();
  if (fireHour >= QUIET_HOUR_START) {
    return { fireAt: null, effect: "skipped" };
  }
  if (fireHour < QUIET_HOUR_END) {
    next.setHours(QUIET_HOUR_END, 0, 0, 0);
    return { fireAt: next, effect: "clamped" };
  }
  return { fireAt: next, effect: "none" };
}

function buildPrecisePendingNotifications(
  data: AppData,
  notifyMode: NotifyMode,
  timing: Timing,
  userPickedFireAt?: number,
  now: Date = new Date(),
): PendingNotification[] {
  const pending: PendingNotification[] = [];
  const nowMs = now.getTime();
  const nowHour = now.getHours();

  if (notifyMode === "once" && userPickedFireAt && userPickedFireAt > nowMs) {
    const fireAt     = new Date(userPickedFireAt);
    const isToday    = fireAt.toDateString() === now.toDateString();
    const targetDate: "today" | "tomorrow" = isToday ? "today" : "tomorrow";
    const dayData    = isToday ? data.today : data.tomorrow;
    const winHour    = Math.min(23, fireAt.getHours() + Math.round(timing / 60));
    const nearestSlot = dayData?.slots
      .filter(s => s.priceCt !== null)
      .reduce((best: (typeof dayData.slots)[0] | null, s) =>
        best === null || Math.abs(s.hour - winHour) < Math.abs(best.hour - winHour) ? s : best,
        null);
    const avgCt = nearestSlot?.priceCt ?? 0;
    pending.push({
      window: {
        startHour: winHour,
        endHour:   Math.min(23, winHour + 1),
        label:     `${winHour}:00–${Math.min(23, winHour + 1)}:00`,
        avgCt,
        date:      targetDate,
        coreLabel:     `${winHour}–${Math.min(23, winHour + 1)} Uhr`,
        coreAvgCt:     Math.round(avgCt * 10) / 10,
        coreStartHour: winHour,
      },
      fireAt,
    });
    return pending;
  }

  if (notifyMode === "daily_smart") {
    const todayCore    = data.today.cheapestWindow ?? null;
    const tomorrowCore = data.tomorrow?.cheapestWindow ?? null;

    if (todayCore && todayCore.coreStartHour > nowHour) {
      const fireAt = computeFireAt(todayCore.coreStartHour, "today", timing);
      if (fireAt > now) pending.push({ window: todayCore, fireAt });
    }
    if (tomorrowCore) {
      const fireAt = computeFireAt(tomorrowCore.coreStartHour, "tomorrow", timing);
      pending.push({ window: tomorrowCore, fireAt });
    }
  }

  pending.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());
  return pending;
}

function buildFallbackDates(now: Date = new Date()): Date[] {
  const dates: Date[] = [];
  for (let dayOffset = 1; dayOffset <= 5; dayOffset++) {
    const fb = new Date(now);
    fb.setDate(fb.getDate() + dayOffset);
    fb.setHours(QUIET_HOUR_END, 0, 0, 0);
    dates.push(fb);
  }
  return dates;
}

export function getNotificationPreview(
  data: AppData,
  notifyMode: NotifyMode,
  timing: Timing,
  userPickedFireAt?: number,
  now: Date = new Date(),
): NotificationPreview {
  const precisePending = buildPrecisePendingNotifications(data, notifyMode, timing, userPickedFireAt, now);
  let skippedByQuietHours = false;

  for (const pending of precisePending) {
    const quiet = applyQuietHours(pending.fireAt);
    if (!quiet.fireAt) {
      skippedByQuietHours = true;
      continue;
    }
    return {
      nextPreciseAt: quiet.fireAt.getTime(),
      nextPreciseLabel: pending.window.coreLabel,
      nextPreciseQuietHours: quiet.effect,
      nextFallbackAt: notifyMode === "daily_smart" ? buildFallbackDates(now)[0]?.getTime() ?? null : null,
      fallbackOnly: false,
      noPreciseReason: "none",
    };
  }

  return {
    nextPreciseAt: null,
    nextPreciseLabel: null,
    nextPreciseQuietHours: null,
    nextFallbackAt: notifyMode === "daily_smart" ? buildFallbackDates(now)[0]?.getTime() ?? null : null,
    fallbackOnly: notifyMode === "daily_smart",
    noPreciseReason: skippedByQuietHours ? "quiet_hours" : "no_window",
  };
}

export async function clearAllScheduledNotifications(): Promise<number> {
  let allScheduled: Awaited<ReturnType<typeof Notifications.getAllScheduledNotificationsAsync>> = [];
  try {
    allScheduled = await Notifications.getAllScheduledNotificationsAsync();
  } catch (e) {
    console.warn("[Notifications] Could not fetch scheduled notifications for clearing:", e);
    return 0;
  }

  let cleared = 0;
  for (const notification of allScheduled) {
    try {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      cleared++;
    } catch (e) {
      console.warn(`[Notifications] Failed to cancel scheduled notification ${notification.identifier}:`, e);
    }
  }
  console.log(`[Notifications] Cleared ${cleared} scheduled notifications`);
  return cleared;
}

export async function scheduleTestNotification(lang: "de" | "en"): Promise<boolean> {
  await ensureAndroidChannel();
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") return false;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: lang === "en" ? "Test reminder" : "Test-Erinnerung",
      body: lang === "en"
        ? "If you see this, Android notifications are working."
        : "Wenn du das siehst, funktionieren Android-Benachrichtigungen.",
      sound: true,
      ...(Platform.OS === "android" ? { channelId: CHANNEL_ID } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(Date.now() + TEST_NOTIFICATION_DELAY_MS),
      ...(Platform.OS === "android" ? { channelId: CHANNEL_ID } : {}),
    },
  });
  return true;
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
  // NOTE: daily_smart notifications always fire ON the day of the window,
  // so from the user's perspective at delivery time it is always "today".
  // Do NOT use window.date here — it reflects scheduling-time perspective.

  if (lang === "en") {
    return mode === "daily_smart"
      ? { title: "⚡ Daily cheapest window",
          body:  `Today: ${label} · ø ${ct}/kWh` }
      : { title: "⚡ Cheap power window starting soon",
          body:  `${label} · ø ${ct}/kWh` };
  }
  return mode === "daily_smart"
    ? { title: "⚡ Günstigste Phase heute",
        body:  `Heute: ${label} · ø ${ct}/kWh` }
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
): Promise<NotificationPreview> {

  // ── 1. Channel ────────────────────────────────────────────
  await ensureAndroidChannel();

  // ── 2. Permission ─────────────────────────────────────────
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") {
    console.warn("[Notifications] Permission not granted, skipping schedule");
    return getNotificationPreview(data, notifyMode, timing, userPickedFireAt);
  }

  const now    = new Date();
  const nowMs  = now.getTime();
  const preview = getNotificationPreview(data, notifyMode, timing, userPickedFireAt, now);

  // ── 3. Fetch currently scheduled notifications ───────────────────────
  // Shared across: GUARD check, selective cancel, and fallback dedup.
  // Fetched once to avoid multiple round-trips to the OS scheduler.
  let allScheduled: Awaited<ReturnType<typeof Notifications.getAllScheduledNotificationsAsync>> = [];
  try {
    allScheduled = await Notifications.getAllScheduledNotificationsAsync();
  } catch (e) {
    console.warn("[Notifications] Could not fetch scheduled notifications:", e);
  }

  // ── GUARD: skip cancel+reschedule if an alarm is imminent ────────────
  // IMPORTANT: forceSchedule=true bypasses this guard.
  // This guard must NOT apply to explicit user activations — only to silent
  // background load() calls where a pending alarm already exists.
  if (!forceSchedule && notifyMode === "once" && userPickedFireAt) {
    const msUntil = userPickedFireAt - nowMs;
    if (msUntil >= -GUARD_MS && msUntil <= GUARD_MS) {
      console.log(`[Notifications] GUARD(once): fire in ${Math.round(msUntil / 1000)}s — skip reschedule (background only)`);
      return preview;
    }
  }

  if (!forceSchedule && notifyMode === "daily_smart") {
    // Check if any already-scheduled PRECISE notification fires within the next 60 min.
    // If so, do NOT cancel it — that would destroy the imminent alarm that Doze
    // is already holding, and rescheduling would push it to tomorrow.
    for (const n of allScheduled) {
      const nData = (n.content as any)?.data;
      if (nData?.type === "fallback") continue;  // skip fallbacks — only precise alarms matter here

      const trigger = n.trigger as any;
      const scheduledMs: number | null =
        trigger?.dateMs ?? trigger?.value ?? trigger?.seconds != null
          ? (trigger.dateMs ?? trigger.value ?? trigger.seconds * 1000)
          : null;
      if (scheduledMs && scheduledMs - nowMs <= SMART_GUARD_MS && scheduledMs > nowMs - GUARD_MS) {
        console.log(`[Notifications] GUARD(daily_smart): alarm in ${Math.round((scheduledMs - nowMs) / 60000)}min — skip reschedule`);
        return preview;
      }
    }
  }

  // ── 4. Selective cancel: once-mode clears all; daily_smart preserves fallbacks ─
  // ROOT-FIX: Previously cancelAllScheduledNotificationsAsync() wiped fallbacks
  // on every App open. Re-scheduling them from day+2 left day+1 uncovered when
  // tomorrow's aWATTar data was not yet published at scheduling time.
  // Now we only cancel precise (non-fallback) notifications, preserving the
  // fallback runway already held by the OS scheduler.
  const idsToCancel = notifyMode === "once"
    ? allScheduled.map(n => n.identifier)
    : allScheduled
        .filter(n => (n.content as any)?.data?.type !== "fallback")
        .map(n => n.identifier);
  for (const id of idsToCancel) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch (e) {
      console.warn(`[Notifications] Failed to cancel precise notification ${id}:`, e);
    }
  }
  console.log(
    notifyMode === "once"
      ? `[Notifications] Cleared ${idsToCancel.length} scheduled notifications for once-mode`
      : `[Notifications] Cleared ${idsToCancel.length} precise notifications (fallbacks preserved)`
  );

  const pending = buildPrecisePendingNotifications(data, notifyMode, timing, userPickedFireAt, now);
  for (const p of pending) {
    console.log(`[Notifications] pending ${notifyMode}: ${p.window.coreLabel} fireAt=${p.fireAt.toISOString()}`);
  }

  // ── 6. Schedule each ──────────────────────────────────────
  let scheduled = 0;
  for (const p of pending) {
    if (p.fireAt <= now) {
      console.log(`[Notifications] SKIP (past): fireAt=${p.fireAt.toISOString()}`);
      continue;
    }
    const quiet = applyQuietHours(p.fireAt);
    if (!quiet.fireAt) {
      console.log(`[Notifications] SKIP (quiet hours ${p.fireAt.getHours()}h — too late)`);
      continue;
    }
    if (quiet.effect === "clamped") {
      console.log(`[Notifications] CLAMP (quiet hours ${p.fireAt.getHours()}h → 07:00)`);
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
          date: new Date(Math.max(Date.now() + 3000, quiet.fireAt.getTime())),
          ...(Platform.OS === "android" ? { channelId: CHANNEL_ID } : {}),
        },
      });
      scheduled++;
      console.log(`[Notifications] ✓ Scheduled: "${title}" at ${quiet.fireAt.toLocaleTimeString()}`);
    } catch (err) {
      console.error(`[Notifications] ✗ FAILED:`, err);
    }
  }

  // ── 7. Fallback reminders (daily_smart only) ──────────────
  // Coverage: day+1 through day+5 at 07:00 local time.
  // ROOT-FIX: Start from day+1 (was day+2) so there is always a safety-net
  // for tomorrow even when aWATTar hasn't published tomorrow's data yet.
  // Dedup: because fallbacks are now PRESERVED across reschedules (step 4),
  // we skip scheduling a date that is already covered by a surviving fallback.
  let fallbackCount = 0;
  if (notifyMode === "daily_smart") {
    // Build set of calendar dates already covered by surviving fallback notifications.
    const existingFallbackDates = new Set(
      allScheduled
        .filter(n => (n.content as any)?.data?.type === "fallback")
        .map(n => {
          const trigger = n.trigger as any;
          const ms: number | null =
            trigger?.dateMs ?? trigger?.value ?? trigger?.seconds != null
              ? (trigger.dateMs ?? trigger.value ?? trigger.seconds * 1000)
              : null;
          return ms ? new Date(ms).toDateString() : null;
        })
        .filter((d): d is string => d !== null)
    );

    const fallbackDates = buildFallbackDates(now);
    for (let index = 0; index < fallbackDates.length; index++) {
      const dayOffset = index + 1;
      const fb = fallbackDates[index];

      // Dedup: skip if OS already holds a fallback for this date.
      if (existingFallbackDates.has(fb.toDateString())) {
        console.log(`[Notifications] Fallback day+${dayOffset} (${fb.toDateString()}): already held by OS — skip`);
        fallbackCount++;  // count as active coverage
        continue;
      }

      const fbTitle = lang === "en"
        ? "\u26A1 Check today's electricity prices"
        : "\u26A1 Strompreise f\u00FCr heute abrufen";
      const fbBody = lang === "en"
        ? "Open Strom Ampel to find the cheapest window."
        : "\u00D6ffne Strom Ampel und finde das g\u00FCnstigste Fenster.";

      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: fbTitle, body: fbBody,
            sound: true,
            data: { type: "fallback" },
            ...(Platform.OS === "android" ? { channelId: CHANNEL_ID } : {}),
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(Math.max(Date.now() + 3000, fb.getTime())),
            ...(Platform.OS === "android" ? { channelId: CHANNEL_ID } : {}),
          },
        });
        fallbackCount++;
        console.log(`[Notifications] \u2713 Fallback day+${dayOffset}: ${fb.toISOString()}`);
      } catch (err) {
        console.error(`[Notifications] \u2717 Fallback day+${dayOffset} FAILED:`, err);
      }
    }
  }

  // ── 8. OS verification log ───────────────────────────────────────────
  // Confirms actual OS scheduler state after all operations complete.
  // Root cause of silent failures: OS drops triggers silently (past date,
  // missing SCHEDULE_EXACT_ALARM, or Doze rejection). This log surfaces them.
  try {
    const finalScheduled = await Notifications.getAllScheduledNotificationsAsync();
    const finalPrecise   = finalScheduled.filter(n => (n.content as any)?.data?.type !== "fallback");
    const finalFallback  = finalScheduled.filter(n => (n.content as any)?.data?.type === "fallback");
    console.log(
      `[Notifications] OS-verify: ${finalScheduled.length} total registered ` +
      `(${finalPrecise.length} precise + ${finalFallback.length} fallback)`
    );
  } catch (e) {
    console.warn("[Notifications] OS verification check failed:", e);
  }

  console.log(`[Notifications] Done: ${scheduled} precise + ${fallbackCount} fallback active (mode=${notifyMode})`);
  return preview;
}
