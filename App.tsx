// ============================================================
// App.tsx — Main screen for Strom Ampel Android
// ============================================================

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  RefreshControl, ActivityIndicator, TouchableOpacity,
  Alert, Linking, AppState, AppStateStatus, Platform,
} from "react-native";
import * as IntentLauncher from "expo-intent-launcher";
import * as Haptics        from "expo-haptics";
import { SafeAreaView, SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";

import HeroCard        from "./components/HeroCard";
import TimelineBar     from "./components/TimelineBar";
import SettingsSheet   from "./components/SettingsSheet";
import NotifySheet     from "./components/NotifySheet";
import SavingsScenarios from "./components/SavingsScenarios";
import FeedbackSheet   from "./components/FeedbackSheet";
import PrivacyConsentModal from "./components/PrivacyConsentModal";
import { logAppOpen } from "./lib/analytics";

import { fetchAppData }                          from "./lib/fetcher";
import { loadSettings, saveSettings }            from "./lib/settings";
// lib/savings claim functions no longer used (claim model removed)
import { scheduleAllUpcomingNotifications, ensureAndroidChannel, checkExactAlarmPermission } from "./lib/notifications";
import type { AppData }                          from "./lib/types";
import type { AppSettings, Timing, NotifyMode }  from "./lib/settings";
import { ThemeContext, LIGHT, DARK }             from "./lib/theme";
import { I18nContext, makeI18n, useI18n }        from "./lib/i18n";

// Configure foreground notification behaviour (SDK 53+: Expo Go has limited support)
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList:   true,
      shouldPlaySound:  true,   // NOTE: false suppresses Android drop-down banners
      shouldSetBadge:   false,
    }),
  });
} catch (e) {
  console.warn("[Notifications] setNotificationHandler skipped in Expo Go:", e);
}

/** Mini calendar-style date badge — dynamically shows weekday + day number.
 *  Used in section headers instead of static emojis. */
function DateBadge({ date, color, locale }: { date: Date; color: string; locale: string }) {
  const wd  = date.toLocaleDateString(locale, { weekday: "short" }).slice(0, 2).toUpperCase();
  const day = date.getDate();
  return (
    <View style={{
      width: 30, height: 30, borderRadius: 7,
      overflow: "hidden", backgroundColor: color,
      shadowColor: color, shadowOpacity: 0.45, shadowRadius: 4,
      shadowOffset: { width: 0, height: 1 }, elevation: 3,
    }}>
      {/* Top strip — dark overlay acts as calendar binding */}
      <View style={{ backgroundColor: "rgba(0,0,0,0.28)", alignItems: "center", paddingVertical: 3 }}>
        <Text style={{ fontSize: 7, fontWeight: "900", color: "rgba(255,255,255,0.92)",
                       letterSpacing: 0.8 }}>
          {wd}
        </Text>
      </View>
      {/* Day number */}
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 13, fontWeight: "900", color: "#fff", lineHeight: 15 }}>
          {day}
        </Text>
      </View>
    </View>
  );
}

// ── Root wrapper ─────────────────────────────────────────────
export default function App() {
  return (
    <SafeAreaProvider>
      <AppInner />
    </SafeAreaProvider>
  );
}


// ── Main app component ───────────────────────────────────────
function AppInner() {
  const [data,         setData]         = useState<AppData | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [refreshing,   setRefreshing]   = useState(false);
  const [settings,     setSettings]     = useState<AppSettings | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notifyOpen,   setNotifyOpen]   = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  // claimsRefreshKey removed — claim model replaced by SavingsScenarios
  // Shared timeline selection: only one bar active at a time
  const [activeBarSel, setActiveBarSel] = useState<{ barId: string; hour: number } | null>(null);
  // OS-level notification permission state: null=not checked, true=ok, false=denied
  const [hasOsNotifPerm, setHasOsNotifPerm] = useState<boolean | null>(null);
  // langRef: keeps current language accessible inside stale useCallback closures
  const langRef = useRef<"de" | "en">("de");
  // notifyActiveRef: keeps notifyActive accessible inside stale AppState closure
  const notifyActiveRef = useRef<boolean>(false);


  const makeOnChange = (barId: string) => (hour: number | null) =>
    setActiveBarSel(hour !== null ? { barId, hour } : null);

  // ── Load persisted settings ───────────────────────────────
  useEffect(() => {
    loadSettings().then(setSettings);
    // Ensure Android notification channel exists before any scheduling
    ensureAndroidChannel().catch(e => console.warn("[App] Channel init failed:", e));
    // Diagnose Android 12+ exact alarm permission (logs error if missing)
    checkExactAlarmPermission().catch(e => console.warn("[App] Exact alarm check failed:", e));
  }, []);

  // ── Sync notifyActiveRef (fixes stale closure in AppState listener) ───
  useEffect(() => {
    notifyActiveRef.current = settings?.notifyActive ?? false;
  }, [settings?.notifyActive]);

  // ── Immediate once-mode reset when notification fires ─────────────────
  // Handles two scenarios:
  //   1. User taps the notification (app opens from tray) — ResponseReceived
  //   2. Notification arrives while app is foregrounded  — NotificationReceived
  // Both immediately reset notifyActive so the bell icon clears without waiting
  // for the next load() cycle (which can be up to 15 min later).
  useEffect(() => {
    async function resetIfOnceExpired() {
      const { loadSettings: ls, saveSettings: ss } = await import("./lib/settings");
      const s = await ls();
      if (s.notifyMode === "once" && s.notifyActive && s.notifyFireAt && s.notifyFireAt <= Date.now()) {
        console.log("[App] once-mode: notification event detected — immediate reset");
        await ss({ notifyActive: false, notifyFireAt: undefined });
        setSettings(prev => prev ? { ...prev, notifyActive: false, notifyFireAt: undefined } : prev);
      }
    }
    const responseSub = Notifications.addNotificationResponseReceivedListener(() => resetIfOnceExpired());
    const receivedSub = Notifications.addNotificationReceivedListener(() => resetIfOnceExpired());
    return () => { responseSub.remove(); receivedSub.remove(); };
  }, []);

  // ── Reactive OS permission check (runs after settings load from AsyncStorage) ─
  // Bug-fix: using useEffect on notifyActive avoids the timing race where
  // settings is still null during the initial render cycle.
  // Bug-fix: only 'denied' triggers the banner; 'undetermined' does NOT.
  useEffect(() => {
    if (!settings?.notifyActive) {
      setHasOsNotifPerm(null); // reset so next enable triggers a fresh check
      return;
    }
    Notifications.getPermissionsAsync().then(p => {
      setHasOsNotifPerm(p.status !== "denied");
    });
  }, [settings?.notifyActive]);

  // ── Fetch price data ──────────────────────────────────────
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const d = await fetchAppData();
      setData(d);
      // Haptic: confirm successful data load on pull-to-refresh (not on silent bg refresh)
      if (!silent) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }

      // Auto-schedule notifications for ALL upcoming cheap windows.
      // Fires even when app is closed. Re-schedules on every load
      // to stay current. Uses latest settings from AsyncStorage.
      const s = await import("./lib/settings").then((m) => m.loadSettings());
      if (s.notifyActive) {
        // "once" mode: if notifyFireAt has expired → auto-reset to off
        if (s.notifyMode === "once" && s.notifyFireAt && s.notifyFireAt <= Date.now()) {
          console.log(`[App] once-mode expired (${new Date(s.notifyFireAt).toISOString()}) — resetting notifyActive=false`);
          const { saveSettings } = await import("./lib/settings");
          await saveSettings({ notifyActive: false, notifyFireAt: undefined });
          // Update React state so the bell icon resets immediately without app restart
          setSettings(prev => prev ? { ...prev, notifyActive: false, notifyFireAt: undefined } : prev);
        } else {
          const futureFireAt = s.notifyMode === "once" && s.notifyFireAt && s.notifyFireAt > Date.now()
            ? s.notifyFireAt : undefined;
          scheduleAllUpcomingNotifications(
            d,
            s.notifyMode ?? "daily_smart",
            s.timing,
            s.language ?? "de",
            futureFireAt,
            s.surchargeCt ?? 23,
          ).catch(e => console.warn("[App] Notification scheduling failed:", e));
        }
      }
    } catch (e: any) {
      // Use langRef (not stale t) to pick error message language (ISSUE-3 fix)
      setError(langRef.current === "en" ? "Failed to load prices." : "Preise konnten nicht geladen werden.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  // Log app open (Firestore + native analytics)
  useEffect(() => { logAppOpen(); }, []);

  // Re-schedule notifications when app comes back to foreground.
  // Prevents missed reschedule if the app was closed for hours.
  // Guard window in notifications.ts protects imminent user-picks.
  const appState = useRef<AppStateStatus>(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      const wasBackground = appState.current === "background" || appState.current === "inactive";
      const nowActive     = nextState === "active";
      if (wasBackground && nowActive) {
        console.log("[App] Foreground resume — triggering silent refresh + reschedule");
        // NOTE: do NOT call dismissAllNotificationsAsync() here —
        // it would wipe background-delivered notifications from the tray
        // before the user has a chance to see them.
        load(true);
        // Re-check OS notification permission so banner appears/disappears instantly.
        // Uses notifyActiveRef to avoid stale closure over settings state.
        if (notifyActiveRef.current) {
          Notifications.getPermissionsAsync().then(p => {
            setHasOsNotifPerm(p.status !== "denied");
          });
        }
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  }, [load]);


  // Auto-refresh data every 15 minutes (foreground only via AppState guard above).
  // Notification reschedule is protected by GUARD_MS window in notifications.ts.
  useEffect(() => {
    const timer = setInterval(() => {
      if (AppState.currentState === "active") {
        load(true);
      }
    }, 15 * 60 * 1000);
    return () => clearInterval(timer);
  }, [load]);



  // ── Settings updates ──────────────────────────────────────
  async function handleSettingsChange(patch: Partial<AppSettings>) {
    const next = { ...(settings ?? {}), ...patch } as AppSettings;
    setSettings(next);
    // Save the FULL merged object — do NOT rely on saveSettings's internal re-read
    // which can lose fields under Expo Go async timing
    try {
      const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
      await AsyncStorage.setItem("sa_settings_v1", JSON.stringify(next));
    } catch { /* ignore */ }
  }

  // ── Notify activation ─────────────────────────────────────────
  async function handleNotifyActivate(mode: NotifyMode, timing: Timing, fireAtEpoch?: number) {
    // Haptic: celebrate successful notification activation
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    await handleSettingsChange({
      notifyActive: true,
      notifyMode:   mode,
      timing,
      notifyFireAt: fireAtEpoch,
    });
    if (data) {
      scheduleAllUpcomingNotifications(
        data, mode, timing, settings?.language ?? "de", fireAtEpoch, surchargeCt,
        true,  // forceSchedule: explicit user activation — bypass imminent-alarm Guard
      ).catch((e) => console.error("[App] handleNotifyActivate scheduling failed:", e));
    }
    showBatteryOptimizationPromptOnce(settings?.language ?? "de");
  }

  /** Show a one-time Alert guiding the user to disable battery optimisation.
   *  Stored in AsyncStorage under key "sa_battery_prompt_v1" so it only ever fires once.
   *  Android only — silently skipped on iOS. */
  async function showBatteryOptimizationPromptOnce(lang: "de" | "en") {
    if (Platform.OS !== "android") return;
    try {
      const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
      const alreadyShown = await AsyncStorage.getItem("sa_battery_prompt_v1");
      if (alreadyShown) return;
      // Mark as shown BEFORE the timeout so a force-close can't re-trigger it
      await AsyncStorage.setItem("sa_battery_prompt_v1", "1");
      // Delay 700 ms so the NotifySheet close animation finishes first
      setTimeout(() => {
        Alert.alert(
          lang === "en" ? "Improve notification timing" : "Pünktlichere Benachrichtigungen",
          lang === "en"
            ? "Android's battery saver can delay alerts by 10–20 min.\n\nTap \"Disable Optimisation\" to fix this — it takes 2 seconds."
            : "Androids Akkusparmodus kann Erinnerungen um 10–20 Min. verzögern.\n\nTippe auf \"Optimierung deaktivieren\" – dauert 2 Sekunden.",
          [
            { text: lang === "en" ? "Later" : "Später", style: "cancel" },
            {
              text: lang === "en" ? "Disable Optimisation" : "Optimierung deaktivieren",
              onPress: () => {
                // expo-intent-launcher correctly passes packageName as a data URI
                // (setData), which is required by ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS.
                // Falls back to generic settings on devices that reject the intent.
                IntentLauncher.startActivityAsync(
                  "android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS",
                  { data: "package:de.stromampel.app" }
                ).catch(() => Linking.openSettings());
              },
            },
          ]
        );
      }, 700);
    } catch (e) {
      console.warn("[App] Battery prompt check failed:", e);
    }
  }

  // Claim / cancel functions removed — SavingsScenarios is purely passive

  // Keep langRef in sync with current settings language so stale useCallback
  // closures (e.g. load) can safely read the current language (ISSUE-3 fix).
  langRef.current = settings?.language ?? "de";

  // ── Derived data (raw spot) ───────────────────────────────
  const rawCurrent  = data?.current ?? null;
  const rawToday    = data?.today ?? null;
  const rawTomorrow = data?.tomorrow ?? null;

  // Use raw spot prices directly; effective price computed in HeroCard via surchargeCt
  const current  = rawCurrent;
  const today    = rawToday;
  const tomorrow = rawTomorrow;

  const nextCheap   = today?.nextCheapWindow ?? tomorrow?.cheapestWindow ?? null;
  const cheapWindow = today?.nextCheapWindow ?? tomorrow?.cheapestWindow ?? null;
  const surchargeCt = settings?.surchargeCt ?? 23;

  // Theme tokens
  const T = settings?.theme === "dark" ? DARK : LIGHT;
  // i18n
  const lang   = settings?.language ?? "de";
  const i18n   = makeI18n(lang);
  const { t }  = i18n;
  const locale = lang === "de" ? "de-DE" : "en-GB";

  // cheapUntilHour removed — HeroCard v4 uses unified coreLabel from CheapWindow

  // Tomorrow date label e.g. "26. Mär." / "26 Mar."
  const tomorrowDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toLocaleDateString(locale, { day: "numeric", month: "short" });
  })();
  // Date objects for DateBadge
  const todayDateObj    = new Date();
  const tomorrowDateObj = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d; })();


  // ── Loading state ─────────────────────────────────────────
  if (loading && !data) {
    return (
      <I18nContext.Provider value={i18n}>
        <ThemeContext.Provider value={T}>
          <SafeAreaView style={[styles.centered, { backgroundColor: T.bg }]}>
            <ActivityIndicator size="large" color={T.indicator} />
            <Text style={[styles.loadingText, { color: T.sub }]}>{t("loading")}</Text>
          </SafeAreaView>
        </ThemeContext.Provider>
      </I18nContext.Provider>
    );
  }

  // ── Error state ───────────────────────────────────────────
  if (error && !data) {
    return (
      <I18nContext.Provider value={i18n}>
        <ThemeContext.Provider value={T}>
          <SafeAreaView style={[styles.centered, { backgroundColor: T.bg }]}>
            <Text style={styles.errorText}>{t("errorLoad")}</Text>
            <Pressable style={styles.retryBtn} onPress={() => load()}>
              <Text style={styles.retryText}>{t("retry")}</Text>
            </Pressable>
          </SafeAreaView>
        </ThemeContext.Provider>
      </I18nContext.Provider>
    );
  }

  // ── Main render ───────────────────────────────────────────
  return (
    <I18nContext.Provider value={i18n}>
    <ThemeContext.Provider value={T}>
      <SafeAreaView style={[styles.root, { backgroundColor: T.bg }]}>
        {/* StatusBar style: dark icons on light bg, light icons on dark bg */}
        <StatusBar style={settings?.theme === "dark" ? "light" : "dark"} />

        {/* ── Permission Banner ───────────────────────────────────── */}
        {/* Pinned above ScrollView — always visible, does NOT scroll away.  */}
        {/* Only shown when: (1) user enabled notifications in-app AND        */}
        {/* (2) OS explicitly denied the notification permission.              */}
        {settings?.notifyActive && hasOsNotifPerm === false && (
          <TouchableOpacity
            style={styles.permissionBanner}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              Linking.openSettings();
            }}
            activeOpacity={0.85}
          >
            <Text style={styles.permissionBannerText}>
              {lang === "en"
                ? "⚠️  Notifications blocked by system — tap to fix"
                : "⚠️  Benachrichtigungen systemseitig gesperrt — antippen"}
            </Text>
          </TouchableOpacity>
        )}



        <ScrollView
          contentContainerStyle={styles.scroll}
          onScrollBeginDrag={() => setActiveBarSel(null)}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(true); }}
              tintColor={T.indicator}
            />
          }
        >
          {/* ── Header ────────────────────────────────── */}
          <View style={styles.header}>
            <View style={styles.headerLeft} />
            <View style={styles.headerCenter}>
              <Text style={[styles.appTitle, { color: T.text }]}>Strom Ampel</Text>
              <Text
                style={[styles.appSub, { color: T.sub }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >{t("appSub")}</Text>
            </View>
            <View style={styles.headerRight}>
              <Pressable onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setSettingsOpen(true);
              }} hitSlop={12} style={styles.gearBtn}>
                <Text style={styles.gearIcon}>⚙️</Text>
              </Pressable>
            </View>
          </View>

          {/* ── Hero ──────────────────────────────────── */}
          <HeroCard
            current={current}
            nextCheap={nextCheap}
            surchargeCt={surchargeCt}
          />

          {/* ── Fixed tariff notice ───────────────────── */}
          {settings?.tariffType === "fixed" && (() => {
            // FOMO: compute avg spot vs current price (surcharge cancels out)
            const allCts = today?.slots
              .filter(s => s.priceCt !== null && !s.isPast)
              .map(s => s.priceCt!) ?? [];
            const avgCt = allCts.length > 0
              ? allCts.reduce((a, b) => a + b, 0) / allCts.length
              : null;
            // Use cheapest remaining window as reference for max potential saving
            const cheapRef = today?.nextCheapWindow?.coreAvgCt ?? today?.cheapestWindow?.coreAvgCt ?? null;
            const diffCt = current?.priceCt != null && cheapRef != null
              ? current.priceCt - cheapRef
              : null;
            const showFomo = diffCt !== null && diffCt > 3;

            return (
              <View style={[styles.card, styles.fixedNotice, { backgroundColor: T.card }]}>
                <Text style={styles.fixedNoticeIcon}>🔒</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fixedNoticeTitle, { color: "#dc2626" }]}>{t("fixedActive")}</Text>
                  <Text style={[styles.fixedNoticeSub, { color: T.sub }]}>{t("fixedActiveSub")}</Text>
                  {showFomo && (
                    <Text style={[styles.fixedNoticeFomo, { color: "#b45309" }]}>
                      {(lang === "en"
                        ? `Today dynamic would be ≈${diffCt!.toFixed(1).replace(".", ",")} ct cheaper`
                        : `Heute wäre Strom ≈${diffCt!.toFixed(1).replace(".", ",")} ct günstiger`)}
                    </Text>
                  )}
                </View>
              </View>
            );
          })()}

          {/* ── Savings scenarios (passive hint, no interaction) ── */}
          <SavingsScenarios
            currentPriceCt={current?.priceCt ?? null}
            nextCheap={nextCheap}
            currentStatus={current?.status ?? "UNKNOWN"}
            tariffType={settings?.tariffType ?? "dynamic"}
          />

          {/* ── Today (context) ───────────────────────── */}
          {today && (
            <Pressable
              style={[styles.card, { backgroundColor: T.card }]}
              onPress={() => setActiveBarSel(null)}
            >
              <View style={styles.sectionHeader}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <DateBadge date={todayDateObj} color="#16a34a" locale={locale} />
                  <Text style={[styles.sectionTitle, { color: T.text }]}>{t("today")}</Text>
                </View>
                {today.nextCheapWindow && (
                  <Text style={[styles.sectionBadge, { color: T.sub }]}>{t("cheapFrom")} {today.nextCheapWindow.coreLabel}</Text>
                )}
              </View>
              <TimelineBar
                slots={today.slots}
                isToday={true}
                activeHour={activeBarSel?.barId === "today" ? activeBarSel.hour : null}
                onActiveHourChange={makeOnChange("today")}
                surchargeCt={surchargeCt}
              />
            </Pressable>
          )}

          {/* ── Tomorrow ──────────────────────────────── */}
          {tomorrow ? (
            <Pressable
              style={[styles.card, { backgroundColor: T.card }]}
              onPress={() => setActiveBarSel(null)}
            >
              <View style={styles.sectionHeader}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <DateBadge date={tomorrowDateObj} color="#f59e0b" locale={locale} />
                  <Text style={[styles.sectionTitle, { color: T.text }]}>{t("tomorrow")}</Text>
                </View>
                {tomorrow.cheapestWindow && (
                  <Text style={[styles.sectionBadge, { color: T.sub }]}>
                    {t("best")} {tomorrow.cheapestWindow.label} · ≈ {(tomorrow.cheapestWindow.avgCt + surchargeCt).toFixed(1).replace(".", ",")} ct
                  </Text>
                )}
              </View>
              <TimelineBar
                slots={tomorrow.slots}
                isToday={false}
                activeHour={activeBarSel?.barId === "tomorrow" ? activeBarSel.hour : null}
                onActiveHourChange={makeOnChange("tomorrow")}
                surchargeCt={surchargeCt}
              />
            </Pressable>
          ) : (
            <View style={[styles.card, styles.tomorrowPlaceholder, { backgroundColor: T.card }]}>
              <DateBadge date={tomorrowDateObj} color="#f59e0b" locale={locale} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.sectionTitle, { color: T.text }]}>{t("tomorrow")}</Text>
                <Text style={[styles.tomorrowPlaceholderText, { color: T.sub }]}>{t("tomorrowPending")}</Text>
                <Text style={[styles.tomorrowPlaceholderHint, { color: T.footer }]}>{t("tomorrowAuto")}</Text>
              </View>
            </View>
          )}

          {/* ── Notify CTA ───────────────────────────── */}
          <View style={[styles.card, styles.notifyRow, { backgroundColor: T.card }]}>
            {settings?.notifyActive ? (() => {
              // ── Compute next trigger time from scheduled windows ──
              const isOnce = settings.notifyMode === "once";
              const timingMin: number = settings.timing ?? 0;

              // Next fire epoch
              let nextFireMs: number | null = null;
              if (isOnce && settings.notifyFireAt && settings.notifyFireAt > Date.now()) {
                nextFireMs = settings.notifyFireAt;
              } else if (!isOnce) {
                // daily_smart: derive from today's or tomorrow's core block start
                const todayCore = today?.nextCheapWindow ?? today?.cheapestWindow ?? null;
                const tomorrowCore = tomorrow?.cheapestWindow ?? null;
                const now = new Date();
                if (todayCore && todayCore.coreStartHour > now.getHours()) {
                  const d = new Date(); d.setHours(todayCore.coreStartHour, 0, 0, 0);
                  const fire = d.getTime() - timingMin * 60_000;
                  if (fire > Date.now()) nextFireMs = fire;
                }
                if (!nextFireMs && tomorrowCore) {
                  const d = new Date(); d.setDate(d.getDate() + 1);
                  d.setHours(tomorrowCore.coreStartHour, 0, 0, 0);
                  nextFireMs = d.getTime() - timingMin * 60_000;
                }
              }

              // Format next fire time for display
              const nextFireLabel = (() => {
                if (!nextFireMs) return null;
                const fireDate = new Date(nextFireMs);
                const hh = fireDate.getHours().toString().padStart(2, "0");
                const mm = fireDate.getMinutes().toString().padStart(2, "0");
                const isToday = new Date().toDateString() === fireDate.toDateString();
                const dayLabel = isToday
                  ? (lang === "en" ? "Today" : "Heute")
                  : (lang === "en" ? "Tomorrow" : "Morgen");
                return `${dayLabel} ${hh}:${mm}`;
              })();

              // Mode + timing chip text
              const modeChip = isOnce
                ? (lang === "en" ? "One-time" : "Einmalig")
                : (lang === "en" ? "Daily" : "Täglich");
              const timingChip = timingMin === 0
                ? (lang === "en" ? "on start" : "bei Start")
                : timingMin === 30
                  ? "30 Min."
                  : (lang === "en" ? "1 hr" : "1 Std.");

              return (
                <>
                  {/* Left: icon + compact label stack */}
                  <Text style={styles.notifyIcon}>🔔</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.notifyModeLine, { color: T.text }]}>
                      {modeChip}
                      <Text style={{ color: T.sub, fontWeight: "400" }}> · {timingChip}</Text>
                      {nextFireLabel && (
                        <Text style={{ color: T.sub, fontWeight: "400" }}>
                          {"  ›  "}{nextFireLabel}
                        </Text>
                      )}
                    </Text>
                  </View>
                  {/* Right: action links */}
                  <Pressable onPress={() => setNotifyOpen(true)} hitSlop={8}>
                    <Text style={[styles.notifyEdit, { color: T.sub }]}>{t("notifyChange")}</Text>
                  </Pressable>
                  <Pressable onPress={() => {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    handleSettingsChange({ notifyActive: false });
                  }} hitSlop={8}>
                    <Text style={styles.notifyDisable}>{t("notifyOff")}</Text>
                  </Pressable>
                </>
              );
            })() : (
              <>
                <Text style={[styles.notifyPrompt, { color: T.sub, flex: 1 }]}>
                  🔔 {t("notifyPrompt")}
                </Text>
                <TouchableOpacity
                  style={[styles.notifyBtn, { borderColor: T.inputBorder }]}
                  onPress={async () => {
                    const perm = await Notifications.getPermissionsAsync();
                    if (!perm.canAskAgain && perm.status !== "granted") {
                      Alert.alert(
                        lang === "en" ? "Notifications blocked" : "Benachrichtigungen blockiert",
                        lang === "en"
                          ? "Enable in Settings → Apps → Strom Ampel → Notifications."
                          : "Unter Einstellungen → Apps → Strom Ampel → Benachrichtigungen aktivieren.",
                        [
                          { text: lang === "en" ? "Cancel" : "Abbrechen", style: "cancel" },
                          { text: lang === "en" ? "Open Settings" : "Einstellungen", onPress: () => Linking.openSettings() },
                        ]
                      );
                      return;
                    }
                    setNotifyOpen(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.notifyBtnText, { color: T.sub }]}>{t("notifyYes")}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* ── Footer ────────────────────────────────── */}
          <View style={styles.footerSection}>
            <Text style={[styles.footerAttrib, { color: T.footer }]}>
              {t("spotRef")}
            </Text>
            <View style={[styles.footerDivider, { backgroundColor: T.border }]} />
            <Pressable onPress={() => setFeedbackOpen(true)} hitSlop={10}>
              <Text style={[styles.feedbackLink, { color: T.sub }]}>{t("feedbackLink")}</Text>
            </Pressable>
          </View>


        </ScrollView>

        {/* ── Sheets ──────────────────────────────────── */}
        {settings && (
          <SettingsSheet
            visible={settingsOpen}
            settings={settings}
            onClose={() => setSettingsOpen(false)}
            onChange={handleSettingsChange}
          />
        )}

        <NotifySheet
          visible={notifyOpen}
          onClose={() => setNotifyOpen(false)}
          onActivate={handleNotifyActivate}
          todaySlots={today?.slots ?? []}
          todayCheapestWindow={today?.cheapestWindow ?? null}
          todayNextCheapWindow={today?.nextCheapWindow ?? null}
          tomorrowSlots={tomorrow?.slots ?? null}
          tomorrowCheapestWindow={tomorrow?.cheapestWindow ?? null}
          initialMode={settings?.notifyMode}
          initialTiming={settings?.timing}
          surchargeCt={surchargeCt}
        />

        <FeedbackSheet
          visible={feedbackOpen}
          onClose={() => setFeedbackOpen(false)}
        />

        {/* Privacy consent — shown once on first launch */}
        <PrivacyConsentModal />

      </SafeAreaView>
    </ThemeContext.Provider>
    </I18nContext.Provider>
  );
}

const styles = StyleSheet.create({
  root:            { flex: 1 },
  scroll:          { padding: 14, paddingBottom: 24 },
  centered:        { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  loadingText:     { marginTop: 12, fontSize: 13, opacity: 0.7 },
  errorText:       { color: "#dc2626", fontSize: 13, textAlign: "center", marginBottom: 16 },
  retryBtn:        { backgroundColor: "#111827", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  retryText:       { color: "#fff", fontWeight: "600", fontSize: 14 },
  header:          { flexDirection: "row", alignItems: "center", paddingTop: 6, paddingBottom: 12 },
  headerLeft:      { width: 44 },
  headerCenter:    { flex: 1, alignItems: "center" },
  headerRight:     { width: 44, alignItems: "flex-end" },
  appTitle:        { fontSize: 20, fontWeight: "700" },
  appSub:          { fontSize: 13, marginTop: 1, opacity: 0.6 },
  anbieterBadge:   { fontSize: 10, marginTop: 3, paddingHorizontal: 8, paddingVertical: 2,
                     borderRadius: 10, backgroundColor: "#f0fdf4", color: "#15803d" },
  gearBtn:         { padding: 4 },
  gearIcon:        { fontSize: 19 },
  card:            {
    borderRadius: 14, padding: 16, marginTop: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  sectionHeader:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  sectionTitle:    { fontSize: 14, fontWeight: "600" },
  sectionBadge:    { fontSize: 11, opacity: 0.65 },
  // Notify row — compact single-line
  notifyRow:       { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 9 },
  notifyIcon:      { fontSize: 13, opacity: 0.75 },
  notifyModeLine:  { fontSize: 12, fontWeight: "600", lineHeight: 16 },
  notifyActive:    { fontSize: 12, fontWeight: "600" },      // kept for any fallback refs
  notifySchedule:  { fontSize: 11, marginTop: 2, opacity: 0.65 },  // kept
  notifyEdit:      { fontSize: 11, textDecorationLine: "underline", opacity: 0.65 },
  notifyDisable:   { fontSize: 11, color: "#ef4444", opacity: 0.75 },
  notifyPrompt:    { fontSize: 12, opacity: 0.65 },
  // Outline style — lightweight, informational
  notifyBtn:       { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 7,
                     borderWidth: 1, alignItems: "center" },
  notifyBtnText:   { fontWeight: "500", fontSize: 11 },
  // Footer
  footerSection:   { marginTop: 16, alignItems: "center", gap: 5 },
  footerAttrib:    { fontSize: 9, textAlign: "center", lineHeight: 13 },
  footerDivider:   { height: StyleSheet.hairlineWidth, width: "20%", opacity: 0.2 },
  feedbackLink:    { fontSize: 10, textDecorationLine: "underline", opacity: 0.6 },
  tomorrowPlaceholder:    { flexDirection: "row", alignItems: "center", gap: 14 },
  tomorrowPlaceholderIcon:{ fontSize: 28 },
  tomorrowPlaceholderText:{ fontSize: 11, marginTop: 4, lineHeight: 16, opacity: 0.7 },
  tomorrowPlaceholderHint:{ fontSize: 10, marginTop: 4, fontStyle: "italic", opacity: 0.5 },
  // Fixed tariff top notice
  fixedNotice:      { flexDirection: "row", alignItems: "center", gap: 12,
                      borderWidth: 1, borderColor: "#f59e0b" },
  fixedNoticeIcon:  { fontSize: 18, opacity: 0.85 },
  fixedNoticeTitle: { fontSize: 12, fontWeight: "600" },
  fixedNoticeSub:   { fontSize: 10, marginTop: 2, lineHeight: 14, opacity: 0.7 },
  fixedNoticeFomo:  { fontSize: 10, marginTop: 3, fontWeight: "600", lineHeight: 14 },
  // Permission banner — pinned above ScrollView, amber warning style
  permissionBanner: {
    backgroundColor: "#b45309",
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center" as const,
  },
  permissionBannerText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600" as const,
    textAlign: "center" as const,
    lineHeight: 17,
  },

});

