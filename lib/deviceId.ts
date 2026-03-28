// ============================================================
// lib/deviceId.ts — Persistent anonymous device identifier
//
// Generates a UUID-style ID on first launch and stores it in
// AsyncStorage. Same ID is returned on every subsequent call.
// This is NOT linked to any personal data (GDPR-safe).
// ============================================================

import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "sa_device_id";

/** Generate a pseudo-UUID v4 (no external dependency required) */
function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

let _cached: string | null = null;

/**
 * Returns the persistent device ID.
 * Creates and stores a new UUID if none exists yet.
 */
export async function getDeviceId(): Promise<string> {
  if (_cached) return _cached;

  try {
    const stored = await AsyncStorage.getItem(KEY);
    if (stored) {
      _cached = stored;
      return stored;
    }
    const newId = generateUUID();
    await AsyncStorage.setItem(KEY, newId);
    _cached = newId;
    console.log("[DeviceId] Generated new device ID:", newId);
    return newId;
  } catch (e) {
    // Fallback: generate ephemeral ID (won't persist across sessions)
    console.warn("[DeviceId] AsyncStorage error, using ephemeral ID:", e);
    const fallback = generateUUID();
    _cached = fallback;
    return fallback;
  }
}
