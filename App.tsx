// ============================================================
// App.tsx — Main screen for StromAmpel Android
// ============================================================

import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  RefreshControl, ActivityIndicator, TouchableOpacity,
} from "react-native";
import { SafeAreaView, SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";

import HeroCard        from "./components/HeroCard";
import TimelineBar     from "./components/TimelineBar";
import SettingsSheet   from "./components/SettingsSheet";
import NotifySheet     from "./components/NotifySheet";
import DeviceSavings   from "./components/DeviceSavings";
import SavingsSummary  from "./components/SavingsSummary";
import FeedbackSheet   from "./components/FeedbackSheet";
import PrivacyConsentModal from "./components/PrivacyConsentModal";
import { logAppOpen } from "./lib/analytics";

import { fetchAppData }                          from "./lib/fetcher";
import { loadSettings, saveSettings }            from "./lib/settings";
import { adjustPriceCt, adjustDayData }          from "./lib/pricing";
import { addClaim, removeLastClaim }             from "./lib/savings";
import { scheduleAllUpcomingNotifications }       from "./lib/notifications";
import type { AppData }                          from "./lib/types";
import type { AppSettings, Device, Timing }      from "./lib/settings";
import { ThemeContext, LIGHT, DARK }             from "./lib/theme";
import { I18nContext, makeI18n, useI18n }        from "./lib/i18n";

// Configure foreground notification behaviour (SDK 53+: Expo Go has limited support)
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList:   true,
      shouldPlaySound:  false,
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

// ── Inner: reads settings.language to build i18n context ────
function AppInnerWithI18n() {
  return <AppInner />;
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
  const [claimsRefreshKey, setClaimsRefreshKey] = useState(0);
  // Shared timeline selection: only one bar active at a time
  const [activeBarSel, setActiveBarSel] = useState<{ barId: string; hour: number } | null>(null);

  const makeOnChange = (barId: string) => (hour: number | null) =>
    setActiveBarSel(hour !== null ? { barId, hour } : null);

  // ── Load persisted settings ───────────────────────────────
  useEffect(() => {
    loadSettings().then(setSettings);
  }, []);

  // ── Fetch price data ──────────────────────────────────────
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const d = await fetchAppData();
      setData(d);

      // Auto-schedule notifications for ALL upcoming cheap windows.
      // Fires even when app is closed. Re-schedules on every load
      // to stay current. Uses latest settings from AsyncStorage.
      const s = await import("./lib/settings").then((m) => m.loadSettings());
      if (s.notifyActive) {
        scheduleAllUpcomingNotifications(
          d,
          s.device,
          s.timing,
          s.language ?? "de",
          s.notifyFireAt,          // re-use user's explicit pick if still future
        ).catch(() => {});
      }
    } catch (e: any) {
      setError(t("errorLoad"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  // Log app open (Firestore + native analytics)
  useEffect(() => { logAppOpen(); }, []);


  // Auto-refresh every 15 minutes
  useEffect(() => {
    const timer = setInterval(() => load(true), 15 * 60 * 1000);
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
  async function handleNotifyActivate(device: Device, timing: Timing, fireAtEpoch: number) {
    await handleSettingsChange({ notifyActive: true, device, timing, notifyFireAt: fireAtEpoch });
    // Immediately schedule — don't wait for next 15-min auto-refresh
    if (data) {
      scheduleAllUpcomingNotifications(
        data, device, timing, settings?.language ?? "de", fireAtEpoch
      ).catch(() => {});
    }
  }

  // ── Claim savings ─────────────────────────────────────────
  async function handleClaim(device: string, kWh: number, savingEur: number) {
    await addClaim(device, kWh, savingEur);
    setClaimsRefreshKey((k) => k + 1);
  }

  // ── Cancel / undo a claim ────────────────────────────────
  async function handleCancelClaim(device: string) {
    await removeLastClaim(device);
    setClaimsRefreshKey((k) => k + 1);
  }

  // ── Derived data (raw spot) ───────────────────────────────
  const rawCurrent  = data?.current ?? null;
  const rawToday    = data?.today ?? null;
  const rawTomorrow = data?.tomorrow ?? null;

  // ── Provider-adjusted pricing ─────────────────────────────
  const anbieter     = settings?.anbieter ?? "";
  const adjToday     = adjustDayData(rawToday,    anbieter);
  const adjTomorrow  = adjustDayData(rawTomorrow, anbieter);
  const adjCurrentPriceCt = rawCurrent?.priceCt != null
    ? adjustPriceCt(rawCurrent.priceCt, anbieter)
    : null;
  const current = rawCurrent ? { ...rawCurrent, priceCt: adjCurrentPriceCt } : null;
  const today   = adjToday;
  const tomorrow = adjTomorrow;

  const nextCheap   = today?.nextCheapWindow ?? tomorrow?.cheapestWindow ?? null;
  const cheapWindow = today?.nextCheapWindow ?? tomorrow?.cheapestWindow ?? null;

  // Theme tokens
  const T = settings?.theme === "dark" ? DARK : LIGHT;
  // i18n
  const lang   = settings?.language ?? "de";
  const i18n   = makeI18n(lang);
  const { t }  = i18n;
  const locale = lang === "de" ? "de-DE" : "en-GB";

  // Find cheapUntilHour for GREEN status
  const nowHour = new Date().getHours();
  let cheapUntilHour: number | null = null;
  if (current?.status === "GREEN" && today) {
    const futureSlots = today.slots.filter((s) => s.hour > nowHour);
    const endSlot = futureSlots.find((s) => s.status !== "GREEN");
    if (endSlot) cheapUntilHour = endSlot.hour;
  }

  // Tomorrow date label e.g. "26. Mär." / "26 Mar."
  const tomorrowDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toLocaleDateString(locale, { day: "numeric", month: "short" });
  })();
  // Date objects for DateBadge
  const todayDateObj    = new Date();
  const tomorrowDateObj = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d; })();

  // Anbieter display label
  const ANBIETER_LABELS: Record<string, string> = {
    tibber: "Tibber", awattar: "aWATTar", ostrom: "Ostrom",
    eprimo: "eprimo", other: "Sonstiger",
  };
  const anbieterLabel = settings?.anbieter ? ANBIETER_LABELS[settings.anbieter] ?? settings.anbieter : null;

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
            <View style={{ flex: 1 }} />
            <View style={styles.headerCenter}>
              <Text style={[styles.appTitle, { color: T.text }]}>StromAmpel</Text>
              <Text style={[styles.appSub, { color: T.sub }]}>{t("appSub")}</Text>
              {anbieterLabel && (
                <Text style={[styles.anbieterBadge, { color: "#15803d" }]}>
                  ⚡ {anbieterLabel}
                </Text>
              )}
            </View>
            <View style={styles.headerRight}>
              <Pressable onPress={() => setSettingsOpen(true)} hitSlop={12} style={styles.gearBtn}>
                <Text style={styles.gearIcon}>⚙️</Text>
              </Pressable>
            </View>
          </View>

          {/* ── Hero ──────────────────────────────────── */}
          <HeroCard
            current={current}
            nextCheap={nextCheap}
            cheapUntilHour={cheapUntilHour}
          />

          {/* ── Fixed tariff notice ───────────────────── */}
          {settings?.tariffType === "fixed" && (
            <View style={[styles.card, styles.fixedNotice, { backgroundColor: T.card }]}>
              <Text style={styles.fixedNoticeIcon}>🔒</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fixedNoticeTitle, { color: T.text }]}>{t("fixedActive")}</Text>
                <Text style={[styles.fixedNoticeSub, { color: T.sub }]}>{t("fixedActiveSub")}</Text>
              </View>
            </View>
          )}

          {/* ── Weekly savings (outcome first) ────────── */}
          <SavingsSummary refreshKey={claimsRefreshKey} />

          {/* ── Device savings (action area) ───────────────────── */}
          <DeviceSavings
            todaySlots={today?.slots ?? []}
            currentPriceCt={current?.priceCt ?? null}
            tariffType={settings?.tariffType ?? "dynamic"}
            currentStatus={current?.status ?? "UNKNOWN"}
            todayNextWindow={today?.nextCheapWindow ?? null}
            tomorrowBestWindow={tomorrow?.cheapestWindow ?? null}
            onClaim={handleClaim}
            onCancel={handleCancelClaim}
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
                  <Text style={[styles.sectionBadge, { color: T.sub }]}>{t("cheapFrom")} {today.nextCheapWindow.label}</Text>
                )}
              </View>
              <TimelineBar
                slots={today.slots}
                isToday={true}
                activeHour={activeBarSel?.barId === "today" ? activeBarSel.hour : null}
                onActiveHourChange={makeOnChange("today")}
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
                    {t("best")} {tomorrow.cheapestWindow.label} · {tomorrow.cheapestWindow.avgCt.toFixed(1).replace(".", ",")} ct
                  </Text>
                )}
              </View>
              <TimelineBar
                slots={tomorrow.slots}
                isToday={false}
                activeHour={activeBarSel?.barId === "tomorrow" ? activeBarSel.hour : null}
                onActiveHourChange={makeOnChange("tomorrow")}
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

          {/* ── Notify CTA (one-time setup, below charts) */}
          <View style={[styles.card, styles.notifyRow, { backgroundColor: T.card }]}>
            {settings?.notifyActive ? (
              <>
                <Text style={[styles.notifyActive, { color: T.text, flex: 1 }]}>
                  {(() => {
                    const fireAt = settings.notifyFireAt ? new Date(settings.notifyFireAt) : null;
                    const timeStr = fireAt && fireAt > new Date()
                      ? `${fireAt.getHours().toString().padStart(2, "0")}:${fireAt.getMinutes().toString().padStart(2, "0")} Uhr`
                      : null;
                    const devLabel = settings.device === "allgemein" ? t("allgemein") : settings.device;
                    return `🔔 ${timeStr ? (lang === "en" ? `Reminder at ${timeStr}` : `Erinnerung um ${timeStr}`) : (settings.timing === 0 ? t("notifyOnStart") : settings.timing === 30 ? t("notifyBefore30") : t("notifyBefore60"))} · ${devLabel}`;
                  })()}
                </Text>
                <Pressable onPress={() => setNotifyOpen(true)}>
                  <Text style={[styles.notifyEdit, { color: T.sub }]}>{t("notifyChange")}</Text>
                </Pressable>
                <Pressable onPress={() => handleSettingsChange({ notifyActive: false })}>
                  <Text style={styles.notifyDisable}>{t("notifyOff")}</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={[styles.notifyPrompt, { color: T.sub, flex: 1 }]}>{t("notifyPrompt")}</Text>
                <TouchableOpacity
                  style={[styles.notifyBtn, { borderColor: T.inputBorder }]}
                  onPress={() => setNotifyOpen(true)}
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
              {anbieterLabel
                ? t("spotWithProvider").replace("{p}", anbieterLabel)
                : t("spotRef")}
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
          tomorrowSlots={tomorrow?.slots ?? null}
          tomorrowCheapestWindow={tomorrow?.cheapestWindow ?? null}
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
  headerCenter:    { flex: 2, alignItems: "center" },
  headerRight:     { flex: 1, alignItems: "flex-end" },
  appTitle:        { fontSize: 20, fontWeight: "700" },
  appSub:          { fontSize: 11, marginTop: 1, opacity: 0.6 },
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
  // Notify row
  notifyRow:       { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 },
  notifyActive:    { fontSize: 12, fontWeight: "500" },
  notifyEdit:      { fontSize: 11, textDecorationLine: "underline", opacity: 0.7 },
  notifyDisable:   { fontSize: 11, color: "#ef4444", opacity: 0.8 },
  notifyPrompt:    { fontSize: 12, opacity: 0.65 },
  // Outline style — lightweight, informational
  notifyBtn:       { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8,
                     borderWidth: 1, alignItems: "center" },
  notifyBtnText:   { fontWeight: "500", fontSize: 12 },
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
});
