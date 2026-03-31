// ============================================================
// StromAmpel App — Settings (AsyncStorage)
// ============================================================

import AsyncStorage from "@react-native-async-storage/async-storage";

export type TariffType = "dynamic" | "fixed";
export type Device     = "allgemein" | "waschen" | "spuelmaschine" | "trockner";
export type Timing     = 0 | 30 | 60;
export type Theme      = "light" | "dark";
export type Language   = "de" | "en";

export interface AppSettings {
  tariffType:    TariffType;
  anbieter:      string;
  device:        Device;
  timing:        Timing;
  notifyActive:  boolean;
  notifyFireAt?: number;   // epoch ms — exact time the notification should fire
  theme:         Theme;
  language:      Language;
}

const KEY     = "sa_settings_v1";
const DEFAULTS: AppSettings = {
  tariffType:   "dynamic",
  anbieter:     "",
  device:       "allgemein",
  timing:       30,
  notifyActive: false,
  theme:        "light",
  language:     "de",
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
    await AsyncStorage.setItem(KEY, JSON.stringify({ ...current, ...s }));
  } catch {
    // ignore write errors
  }
}

export { DEFAULTS };
