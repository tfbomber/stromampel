// ============================================================
// lib/backgroundTask.ts — DISABLED
//
// expo-background-fetch + expo-task-manager were removed in
// v20260416 due to native module initialization crash on
// Android release builds.
//
// Notification rescheduling now happens exclusively in the
// foreground (on app open + AppState resume). This is
// sufficient for the current use case and avoids the need
// for background native modules.
// ============================================================

// No-op export kept so any future re-import doesn't break builds.
export const BACKGROUND_TASK_ID = "stromampel-notification-refresh";

export async function registerBackgroundTask(): Promise<void> {
  // No-op: background task system is disabled.
  console.log("[BackgroundTask] Background task system is disabled in this build.");
}
