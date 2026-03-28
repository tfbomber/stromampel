// ============================================================
// lib/analytics.ts — Analytics wrapper
//
// Current mode: Firestore session logging (works in Expo Go ✅)
// After EAS Build: @react-native-firebase/analytics will be added
//   for full GA4 dashboard support (native module required).
// All calls are fire-and-forget — must never crash the app.
// ============================================================

import { Platform } from "react-native";
import Constants from "expo-constants";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

// ── Helpers ───────────────────────────────────────────────
const appVersion = Constants.expoConfig?.version ?? "unknown";

/** Date string "YYYY-MM-DD" for daily bucketing */
function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

// ── Firestore event logger (Expo Go + EAS Build compatible) ─
async function firestoreLogEvent(event: string, extra?: Record<string, unknown>) {
  try {
    await addDoc(collection(db, "analytics"), {
      event,
      date:       todayStr(),
      platform:   Platform.OS,
      appVersion,
      timestamp:  serverTimestamp(),
      at:         Date.now(),
      ...extra,
    });
  } catch {
    // Silently ignore — analytics must never crash the app
  }
}

// ── Public API ────────────────────────────────────────────

/** Call once on app mount */
export async function logAppOpen(): Promise<void> {
  await firestoreLogEvent("app_open");
}

/** General event logger */
export async function logEvent(
  name: string,
  params?: Record<string, string | number | boolean>,
): Promise<void> {
  await firestoreLogEvent(name, params as Record<string, unknown>);
}

/** Feedback submitted */
export async function logFeedbackSubmitted(): Promise<void> {
  await firestoreLogEvent("feedback_submitted");
}

/** User tapped a price bar */
export async function logBarTapped(hour: number): Promise<void> {
  await firestoreLogEvent("bar_tapped", { hour });
}

/** Device claimed / Starten tapped */
export async function logDeviceClaimed(deviceName: string): Promise<void> {
  await firestoreLogEvent("device_claimed", { device: deviceName });
}
