import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, Pressable, StyleSheet, Modal,
  Animated, TouchableOpacity, Alert, ScrollView, Linking,
} from "react-native";
import * as Notifications from "expo-notifications";
import * as Haptics from "expo-haptics";
import type { Timing, NotifyMode } from "../lib/settings";
import type { HourSlot, CheapWindow } from "../lib/types";
import { useTheme } from "../lib/theme";
import { useI18n } from "../lib/i18n";
import TimelineBar from "./TimelineBar";

interface Props {
  visible:    boolean;
  onClose:    () => void;
  onActivate: (mode: NotifyMode, timing: Timing, fireAtEpoch?: number) => void;
  todaySlots:             HourSlot[];
  todayCheapestWindow:    CheapWindow | null;
  todayNextCheapWindow:   CheapWindow | null;
  tomorrowSlots:          HourSlot[] | null;
  tomorrowCheapestWindow: CheapWindow | null;
  initialMode?:   NotifyMode;
  initialTiming?: Timing;
  surchargeCt?: number;
}

function pad2(n: number) { return n.toString().padStart(2, "0"); }

export default function NotifySheet({
  visible,
  onClose,
  onActivate,
  todaySlots,
  todayCheapestWindow,
  todayNextCheapWindow,
  tomorrowSlots,
  tomorrowCheapestWindow,
  initialMode,
  initialTiming,
  surchargeCt = 0,
}: Props) {
  const T = useTheme();
  const { lang } = useI18n();

  const [mode,        setMode]        = useState<NotifyMode>("daily_smart");
  const [selectedDay, setSelectedDay] = useState<"today" | "tomorrow">("today");
  const [selectedHour, setSelectedHour] = useState<number>(0);
  const [timing,      setTiming]      = useState<Timing>(30);

  const slideAnim = useRef(new Animated.Value(400)).current;
  const nowHour   = new Date().getHours();

  const todayFuture  = todaySlots.filter(s => s.hour > nowHour && s.priceCt !== null);
  const tomorrowFull = (tomorrowSlots ?? []).filter(s => s.priceCt !== null);
  const hasTomorrow  = tomorrowFull.length > 0;

  const todayCheapHour =
    todayNextCheapWindow?.coreStartHour ??
    todayCheapestWindow?.coreStartHour ??
    todayFuture[0]?.hour ??
    (nowHour + 1);
  const tomorrowCheapHour = tomorrowCheapestWindow?.coreStartHour ?? tomorrowFull[0]?.hour ?? 10;

  useEffect(() => {
    if (visible) {
      setMode(initialMode ?? "daily_smart");
      setSelectedDay("today");
      setSelectedHour(todayCheapHour);
      setTiming(initialTiming ?? 30);
    }
  }, [visible, initialMode, initialTiming, todayCheapHour]);

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 0 : 400,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  }, [visible, slideAnim]);

  function handleDaySwitch(day: "today" | "tomorrow") {
    setSelectedDay(day);
    setSelectedHour(day === "today" ? todayCheapHour : tomorrowCheapHour);
  }

  const fireAtDate = (() => {
    const d = new Date();
    if (selectedDay === "tomorrow") d.setDate(d.getDate() + 1);
    d.setHours(selectedHour, 0, 0, 0);
    return new Date(d.getTime() - timing * 60_000);
  })();
  const fireAtValid = fireAtDate > new Date();

  const fireAtDay  = fireAtDate.toDateString();
  const todayStr   = new Date().toDateString();
  const tmrStr     = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toDateString(); })();
  const fireDayLabel =
    fireAtDay === todayStr ? (lang === "en" ? "Today " : "Heute ") :
    fireAtDay === tmrStr   ? (lang === "en" ? "Tomorrow " : "Morgen ") : "";
  const fireLabel = `${fireDayLabel}${pad2(fireAtDate.getHours())}:${pad2(fireAtDate.getMinutes())} Uhr`;

  const smartWindow = todayNextCheapWindow ?? todayCheapestWindow ?? tomorrowCheapestWindow ?? null;
  const smartLabel = smartWindow
    ? smartWindow.date === "tomorrow"
      ? (lang === "en" ? `Tomorrow · ${smartWindow.coreLabel}` : `Morgen · ${smartWindow.coreLabel}`)
      : smartWindow.coreLabel
    : null;

  const barSlots  = selectedDay === "today" ? todaySlots : (tomorrowSlots ?? []);
  const cheapHour = selectedDay === "today" ? todayCheapHour : tomorrowCheapHour;

  async function handleActivate() {
    const existing = await Notifications.getPermissionsAsync();

    const proceed = async () => {
      if (mode === "once") {
        if (!fireAtValid) {
          Alert.alert(
            lang === "en" ? "Time already passed" : "Zeit bereits vergangen",
            lang === "en" ? "Please choose a later hour." : "Bitte eine spätere Stunde wählen.",
          );
          return;
        }
        onActivate("once", timing, fireAtDate.getTime());
      } else {
        onActivate("daily_smart", timing);
      }
      onClose();
    };

    if (existing.status === "granted") {
      await proceed();
      return;
    }

    if (existing.canAskAgain) {
      Alert.alert(
        lang === "en" ? "Allow notifications" : "Benachrichtigungen erlauben",
        lang === "en"
          ? "Strom Ampel can remind you before cheaper electricity times."
          : "Strom Ampel kann dich vor günstigeren Stromzeiten erinnern.",
        [
          { text: lang === "en" ? "Cancel" : "Abbrechen", style: "cancel" },
          {
            text: lang === "en" ? "Continue" : "Weiter",
            onPress: async () => {
              const { status } = await Notifications.requestPermissionsAsync({
                ios: { allowAlert: true, allowBadge: true, allowSound: true },
              });
              if (status !== "granted") {
                Alert.alert(
                  lang === "en" ? "Permission needed" : "Berechtigung erforderlich",
                  lang === "en"
                    ? "Please enable notifications in Settings → Apps → Strom Ampel."
                    : "Bitte unter Einstellungen → Apps → Strom Ampel aktivieren.",
                  [
                    { text: lang === "en" ? "Cancel" : "Abbrechen", style: "cancel" },
                    { text: lang === "en" ? "Open Settings" : "Zu den Einstellungen", onPress: () => Linking.openSettings() },
                  ]
                );
                return;
              }
              await proceed();
            },
          },
        ]
      );
      return;
    }

    Alert.alert(
      lang === "en" ? "Notifications blocked" : "Benachrichtigungen blockiert",
      lang === "en"
        ? "Please enable in Settings → Apps → Strom Ampel → Notifications."
        : "Bitte unter Einstellungen → Apps → Strom Ampel → Benachrichtigungen aktivieren.",
      [
        { text: lang === "en" ? "Cancel" : "Abbrechen", style: "cancel" },
        { text: lang === "en" ? "Open Settings" : "Zu den Einstellungen", onPress: () => Linking.openSettings() },
      ]
    );
  }

  const DARK_BTN = "#111827";
  const ctaDisabled = mode === "once" && !fireAtValid;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

      <Animated.View style={[styles.sheet, { backgroundColor: T.card, transform: [{ translateY: slideAnim }] }]}> 
        <View style={styles.handleWrap}>
          <View style={[styles.handle, { backgroundColor: T.border }]} />
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={[styles.sheetTitle, { color: T.text }]}> 
            {lang === "en" ? "Smart reminder" : "Smarte Erinnerung"}
          </Text>

          {/* Mode Toggle */}
          <Text style={[styles.sectionLabel, { color: T.sub }]}>
            {lang === "en" ? "REMINDER TYPE" : "ART DER ERINNERUNG"}
          </Text>
          <View style={styles.modeRow}>
            {(["daily_smart", "once"] as NotifyMode[]).map((m) => {
              const active = mode === m;
              const icon  = m === "daily_smart" ? "🔄" : "⏱️";
              const title = m === "daily_smart"
                ? (lang === "en" ? "Daily Smart" : "Täglich optimal")
                : (lang === "en" ? "One-time" : "Einmalig");
              const sub = m === "daily_smart"
                ? (lang === "en" ? "Fires at cheapest window each day" : "Täglich zur günstigsten Phase")
                : (lang === "en" ? "Fires once, then turns off" : "Einmalig zur gewählten Zeit");
              return (
                <Pressable
                  key={m}
                  style={[styles.modeCard, { borderColor: active ? T.text : T.inputBorder, backgroundColor: T.bg }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setMode(m);
                  }}
                >
                  <Text style={styles.modeIcon}>{icon}</Text>
                  <Text style={[styles.modeTitle, { color: active ? T.text : T.sub }]}>{title}</Text>
                  <Text style={[styles.modeSub, { color: T.sub }]}>{sub}</Text>
                </Pressable>
              );
            })}
          </View>

          {mode === "daily_smart" && (
            <View style={[styles.previewCard, { backgroundColor: T.bg, borderColor: T.inputBorder }]}> 
              <Text style={[styles.previewTitle, { color: T.text }]}> 
                {lang === "en" ? "We remind you before cheap electricity times." : "Wir erinnern dich vor günstigen Stromzeiten."}
              </Text>
              <Text style={[styles.previewText, { color: T.sub }]}> 
                {smartLabel
                  ? (lang === "en" ? `Next likely window: ${smartLabel}` : `Nächste wahrscheinliche Phase: ${smartLabel}`)
                  : (lang === "en" ? "The app checks the next cheap window automatically." : "Die App prüft automatisch die nächste günstige Phase.")}
              </Text>
            </View>
          )}

          {mode === "once" && (
            <>
              <Text style={[styles.sectionLabel, { color: T.sub }]}>
                {lang === "en" ? "WHEN?" : "WANN?"}
              </Text>
              <View style={styles.dayTabs}>
                {(["today", "tomorrow"] as const).map((day) => {
                  const disabled = day === "tomorrow" && !hasTomorrow;
                  const active   = selectedDay === day;
                  return (
                    <Pressable
                      key={day}
                      disabled={disabled}
                      style={[styles.dayTab, { borderColor: active ? T.text : T.inputBorder, backgroundColor: active ? T.text : T.bg },
                        disabled && styles.dayTabDisabled]}
                      onPress={() => handleDaySwitch(day)}
                    >
                      <Text style={[styles.dayTabText,
                        { color: active ? T.bg : disabled ? T.footer : T.sub }]}>
                        {day === "today"
                          ? (lang === "en" ? "Today" : "Heute")
                          : (hasTomorrow
                            ? (lang === "en" ? "Tomorrow" : "Morgen")
                            : (lang === "en" ? "Tomorrow (pending)" : "Morgen (ausstehend)"))}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.timelineWrap}>
                {barSlots.length > 0 ? (
                  <TimelineBar
                    slots={barSlots}
                    isToday={selectedDay === "today"}
                    activeHour={selectedHour}
                    onActiveHourChange={(h) => { if (h !== null) setSelectedHour(h); }}
                    surchargeCt={surchargeCt}
                  />
                ) : (
                  <Text style={[styles.noSlots, { color: T.sub }]}>
                    {lang === "en" ? "No data available." : "Keine Daten verfügbar."}
                  </Text>
                )}
              </View>
            </>
          )}

          <Text style={[styles.sectionLabel, { color: T.sub, marginTop: 4 }]}> 
            {lang === "en" ? "HOW EARLY?" : "WIE FRÜH?"}
          </Text>
          <View style={styles.timingList}>
            {([
              { value: 30 as Timing, label: lang === "en" ? "30 min before" : "30 Min vorher", badge: lang === "en" ? "Recommended" : "Empfohlen" },
              { value: 60 as Timing, label: lang === "en" ? "1 hour before" : "1 Std vorher", badge: "" },
              { value: 0 as Timing, label: lang === "en" ? "Right at start" : "Genau beim Start", badge: "" },
            ] as const).map(opt => (
              <Pressable
                key={opt.value}
                style={[
                  styles.timingRow,
                  { borderColor: T.inputBorder, backgroundColor: T.bg },
                  timing === opt.value && { borderColor: T.text },
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  setTiming(opt.value);
                }}
              >
                <Text style={[styles.timingLabel, { color: T.text }]}>{opt.label}</Text>
                <View style={styles.timingRight}>
                  {!!opt.badge && (
                    <View style={[styles.badge, { backgroundColor: T.card }]}> 
                      <Text style={[styles.badgeText, { color: T.sub }]}>{opt.badge}</Text>
                    </View>
                  )}
                  {timing === opt.value && <Text style={[styles.check, { color: T.text }]}>✓</Text>}
                </View>
              </Pressable>
            ))}
          </View>

          {mode === "once" && (
            <View style={[styles.previewCard, { backgroundColor: fireAtValid ? "#f0fdf4" : "#fef2f2", borderColor: fireAtValid ? "#dcfce7" : "#fecaca" }]}>
              {fireAtValid ? (
                <>
                  <Text style={[styles.previewRow, { color: T.sub }]}>
                    {lang === "en" ? `📍 Window: ${pad2(selectedHour)}:00` : `📍 Fenster: ${pad2(selectedHour)}:00 Uhr`}
                    {selectedHour === cheapHour ? (lang === "en" ? "  (cheapest)" : "  (günstigste)") : ""}
                  </Text>
                  <Text style={[styles.previewRow, { color: "#15803d", fontWeight: "700", marginVertical: 4 }]}>
                    {lang === "en"
                      ? `🔔 Reminder at ${fireLabel}`
                      : `🔔 Erinnerung um ${fireLabel}`}
                  </Text>
                  <Text style={[styles.previewNote, { color: "#b45309" }]}>
                    {lang === "en" ? "⚠️ Fires once then turns off automatically." : "⚠️ Einmalig – danach automatisch deaktiviert."}
                  </Text>
                </>
              ) : (
                <Text style={[styles.previewText, { color: "#dc2626" }]}>
                  {lang === "en" ? "⚠️ Time already passed — choose a later hour" : "⚠️ Zeit abgelaufen – andere Stunde wählen"}
                </Text>
              )}
            </View>
          )}

          <Pressable
            style={[styles.cta, { backgroundColor: DARK_BTN }, ctaDisabled && styles.ctaDisabled]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              handleActivate();
            }}
            disabled={ctaDisabled}
          >
            <Text style={styles.ctaText}>
              {lang === "en" ? "Turn on reminder" : "Erinnerung aktivieren"}
            </Text>
          </Pressable>

          <Pressable onPress={onClose} style={styles.cancelBtn}>
            <Text style={[styles.cancelText, { color: T.sub }]}> 
              {lang === "en" ? "Cancel" : "Abbrechen"}
            </Text>
          </Pressable>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop:   { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    position: "absolute", bottom: 0, left: 0, right: 0, maxHeight: "92%",
    borderTopLeftRadius: 20, borderTopRightRadius: 20, elevation: 20,
  },
  handleWrap: { alignItems: "center", paddingTop: 12, paddingBottom: 4 },
  handle:     { width: 40, height: 4, borderRadius: 2 },
  scroll:     { flex: 1 },
  content:    { paddingHorizontal: 20, paddingBottom: 36 },
  sheetTitle: { fontSize: 16, fontWeight: "700", marginBottom: 16 },
  previewCard: { borderRadius: 12, borderWidth: 1.5, padding: 12, marginBottom: 16 },
  previewTitle: { fontSize: 13, fontWeight: "700", marginBottom: 4, lineHeight: 18 },
  previewText: { fontSize: 12, lineHeight: 17 },
  sectionLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 1, marginBottom: 8, opacity: 0.55 },
  timingList:  { gap: 8, marginBottom: 14 },
  timingRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 11, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1.5,
  },
  timingLabel: { fontSize: 13, fontWeight: "600" },
  timingRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  badge:       { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  badgeText:   { fontSize: 10 },
  check:       { fontSize: 13 },
  cta:         { borderRadius: 12, paddingVertical: 14, alignItems: "center", marginBottom: 8 },
  ctaDisabled: { opacity: 0.4 },
  ctaText:     { color: "#fff", fontSize: 14, fontWeight: "700" },
  cancelBtn:   { alignItems: "center", paddingVertical: 8 },
  cancelText:  { fontSize: 13 },
  // Mode toggle
  modeRow:     { flexDirection: "row", gap: 10, marginBottom: 16 },
  modeCard: {
    flex: 1, borderRadius: 14, borderWidth: 1.5, paddingVertical: 12,
    paddingHorizontal: 10, alignItems: "center",
  },
  modeIcon:    { fontSize: 20, marginBottom: 4 },
  modeTitle:   { fontSize: 12, fontWeight: "700", marginBottom: 2 },
  modeSub:     { fontSize: 10, textAlign: "center", lineHeight: 14 },
  // Once: day tabs
  dayTabs:     { flexDirection: "row", gap: 8, marginBottom: 12 },
  dayTab: {
    flex: 1, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, alignItems: "center",
  },
  dayTabDisabled: { opacity: 0.4 },
  dayTabText:  { fontSize: 13, fontWeight: "600" },
  noSlots:     { fontSize: 12, textAlign: "center", marginVertical: 10 },
  timelineWrap:{ marginBottom: 12 },
  // Preview Once
  previewRow:  { fontSize: 12 },
  previewNote: { fontSize: 10, marginTop: 2, fontStyle: "italic" },
});
