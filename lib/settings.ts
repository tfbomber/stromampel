// ============================================================
// StromAmpel App — Settings (AsyncStorage)
// v2: notifyMode ("once" | "daily_smart"), surchargeCt replaces anbieter
// ============================================================

import AsyncStorage from "@react-native-async-storage/async-storage";

export type TariffType  = "dynamic" | "fixed";
export type Timing      = 0 | 30 | 60;
export type Theme       = "light" | "dark";
export type Language    = "de" | "en";
/** once   = fires at the chosen time, then auto-resets to off
 *  daily_smart = fires daily at the start of the cheapest 3h window */
export type NotifyMode  = "once" | "daily_smart";

export interface AppSettings {
  tariffType:    TariffType;
  timing:        Timing;
  notifyActive:  boolean;
  notifyMode:    NotifyMode;
  notifyFireAt?: number;   // epoch ms — used only in "once" mode
  theme:         Theme;
  language:      Language;
  /** Flat surcharge added to spot price for "effective" display (ct/kWh).
   *  Covers Netzentgelt + taxes + levies. Default 23 is a reasonable German average. */
  surchargeCt:   number;
}

const KEY      = "sa_settings_v1";
const DEFAULTS: AppSettings = {
  tariffType:   "dynamic",
  timing:       30,
  notifyActive: false,
  notifyMode:   "daily_smart",
  theme:        "light",
  language:     "de",
  surchargeCt:  23,
};

export async function loadSettings(): Promise<AppSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

export async function saveSettings(s: Partial<AppSettings>): Promise<void> {
  try {
    const current = await loadSettings();
    const merged = { ...current, ...s } as Record<string, unknown>;
    // Explicitly remove keys set to undefined — JSON.stringify silently drops
    // undefined values, which would leave the old value intact in AsyncStorage.
    (Object.keys(s) as (keyof AppSettings)[]).forEach(k => {
      if (s[k] === undefined) delete merged[k];
    });
    await AsyncStorage.setItem(KEY, JSON.stringify(merged));
  } catch {
    // ignore write errors
  }
}

export { DEFAULTS };
