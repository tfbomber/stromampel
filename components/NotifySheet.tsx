// ============================================================
// NotifySheet — Redesigned
// Step 1: Device   Step 2: Day / Hour (price bar) / Timing / Preview
// ============================================================

import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, Pressable, StyleSheet, Modal,
  Animated, TouchableOpacity, Alert, ScrollView, Linking,
} from "react-native";
import * as Notifications from "expo-notifications";
import type { Device, Timing } from "../lib/settings";
import type { HourSlot, CheapWindow } from "../lib/types";
import { useTheme } from "../lib/theme";
import { useI18n } from "../lib/i18n";
import TimelineBar from "./TimelineBar";

// ── Labels ─────────────────────────────────────────────────
const DEVICE_LABELS_DE: Record<Device, string> = {
  allgemein:     "Allgemein",
  waschen:       "Waschmaschine",
  spuelmaschine: "Spülmaschine",
  trockner:      "Trockner",
};
const DEVICE_LABELS_EN: Record<Device, string> = {
  allgemein:     "General",
  waschen:       "Washing Machine",
  spuelmaschine: "Dishwasher",
  trockner:      "Dryer",
};
const DEVICE_EMOJI: Record<Device, string> = {
  allgemein:     "🏠",
  waschen:       "🫧",
  spuelmaschine: "🍽️",
  trockner:      "🌀",
};

interface Props {
  visible:    boolean;
  onClose:    () => void;
  /** epoch ms of when the notification should fire */
  onActivate: (device: Device, timing: Timing, fireAtEpoch: number) => void;
  todaySlots:             HourSlot[];
  todayCheapestWindow:    CheapWindow | null;
  tomorrowSlots:          HourSlot[] | null;
  tomorrowCheapestWindow: CheapWindow | null;
}

function pad2(n: number) { return n.toString().padStart(2, "0"); }

export default function NotifySheet({
  visible, onClose, onActivate,
  todaySlots, todayCheapestWindow,
  tomorrowSlots, tomorrowCheapestWindow,
}: Props) {
  const T = useTheme();
  const { lang } = useI18n();

  const [step,        setStep]        = useState<1 | 2>(1);
  const [device,      setDevice]      = useState<Device>("allgemein");
  const [selectedDay, setSelectedDay] = useState<"today" | "tomorrow">("today");
  const [selectedHour, setSelectedHour] = useState<number>(0);
  const [timing,      setTiming]      = useState<Timing>(30);

  const slideAnim = useRef(new Animated.Value(400)).current;
  const nowHour   = new Date().getHours();

  // Future-only slots for each day
  const todayFuture  = todaySlots.filter(s => s.hour > nowHour && s.priceCt !== null);
  const tomorrowFull = (tomorrowSlots ?? []).filter(s => s.priceCt !== null);
  const hasTomorrow  = tomorrowFull.length > 0;

  // Default cheapest hour per day
  const todayCheapHour    = todayCheapestWindow?.startHour ?? todayFuture[0]?.hour ?? (nowHour + 1);
  const tomorrowCheapHour = tomorrowCheapestWindow?.startHour ?? tomorrowFull[0]?.hour ?? 10;

  // Reset when sheet opens
  useEffect(() => {
    if (visible) {
      setStep(1);
      setDevice("allgemein");
      setSelectedDay("today");
      setSelectedHour(todayCheapHour);
      setTiming(30);
    }
  }, [visible]);

  // Slide animation
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 0 : 400,
      useNativeDriver: true, tension: 65, friction: 11,
    }).start();
  }, [visible]);

  function handleDaySwitch(day: "today" | "tomorrow") {
    setSelectedDay(day);
    setSelectedHour(day === "today" ? todayCheapHour : tomorrowCheapHour);
  }

  // Compute fireAt epoch
  const fireAtDate = (() => {
    const d = new Date();
    if (selectedDay === "tomorrow") d.setDate(d.getDate() + 1);
    d.setHours(selectedHour, 0, 0, 0);
    return new Date(d.getTime() - timing * 60_000);
  })();
  const fireAtValid = fireAtDate > new Date();
  const fireLabel   = `${pad2(fireAtDate.getHours())}:${pad2(fireAtDate.getMinutes())} Uhr`;

  async function handleActivate() {
    // Step 1: Check current permission status first
    const existing = await Notifications.getPermissionsAsync();

    if (existing.status === "granted") {
      // Already granted — proceed directly
      if (!fireAtValid) {
        Alert.alert(
          lang === "en" ? "Time already passed" : "Zeit bereits vergangen",
          lang === "en" ? "Please choose a later hour." : "Bitte eine spätere Stunde wählen.",
        );
        return;
      }
      onActivate(device, timing, fireAtDate.getTime());
      onClose();
      return;
    }

    // Step 2: Permission not granted — can we still ask?
    if (existing.canAskAgain) {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== "granted") {
        // User just denied — show simple info
        Alert.alert(
          lang === "en" ? "Permission needed" : "Berechtigung erforderlich",
          lang === "en"
            ? "Notifications are needed to remind you. You can enable them in Settings."
            : "Benachrichtigungen sind nötig, damit wir dich erinnern können.",
        );
        return;
      }
      // Granted — proceed
      if (!fireAtValid) {
        Alert.alert(
          lang === "en" ? "Time already passed" : "Zeit bereits vergangen",
          lang === "en" ? "Please choose a later hour." : "Bitte eine spätere Stunde wählen.",
        );
        return;
      }
      onActivate(device, timing, fireAtDate.getTime());
      onClose();
      return;
    }

    // Step 3: Permanently denied — must open system settings
    Alert.alert(
      lang === "en" ? "Notifications blocked" : "Benachrichtigungen blockiert",
      lang === "en"
        ? "StromAmpel needs notification permission. Please enable it in your phone's Settings → Apps → StromAmpel → Notifications."
        : "StromAmpel benötigt die Benachrichtigungsberechtigung. Bitte aktiviere sie unter Einstellungen → Apps → StromAmpel → Benachrichtigungen.",
      [
        { text: lang === "en" ? "Cancel" : "Abbrechen", style: "cancel" },
        {
          text: lang === "en" ? "Open Settings" : "Zu den Einstellungen",
          onPress: () => Linking.openSettings(),
        },
      ]
    );
  }

  // Slots for TimelineBar (full day)
  const barSlots  = selectedDay === "today" ? todaySlots : (tomorrowSlots ?? []);
  const cheapHour = selectedDay === "today" ? todayCheapHour : tomorrowCheapHour;

  const DARK_BTN = "#111827";

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

      <Animated.View style={[styles.sheet, { backgroundColor: T.card, transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.handleWrap}>
          <View style={[styles.handle, { backgroundColor: T.border }]} />
        </View>

        {/* Step dots */}
        <View style={styles.dots}>
          {[1, 2].map(n => (
            <View key={n} style={[styles.dot, { backgroundColor: T.border },
              n === step && { width: 24, backgroundColor: T.text }]} />
          ))}
        </View>

        <View style={styles.content}>

          {/* ─── STEP 1: Device ──────────────────────────────── */}
          {step === 1 && (
            <>
              <Text style={[styles.title, { color: T.text }]}>
                {lang === "en" ? "Which device?" : "Für welches Gerät?"}
              </Text>
              <View style={styles.deviceGrid}>
                {(["allgemein", "waschen", "spuelmaschine", "trockner"] as Device[]).map(d => (
                  <Pressable
                    key={d}
                    style={[styles.deviceCard, { borderColor: T.inputBorder, backgroundColor: T.bg },
                      device === d && { borderColor: T.text }]}
                    onPress={() => setDevice(d)}
                  >
                    <Text style={styles.deviceEmoji}>{DEVICE_EMOJI[d]}</Text>
                    <Text style={[styles.deviceLabel, { color: T.sub },
                      device === d && { color: T.text }]}>
                      {lang === "en" ? DEVICE_LABELS_EN[d] : DEVICE_LABELS_DE[d]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          {/* ─── STEP 2: Day / Hour / Timing / Preview ───────── */}
          {step === 2 && (
            <>
              <Pressable onPress={() => setStep(1)} style={styles.backBtn}>
                <Text style={[styles.backText, { color: T.sub }]}>
                  {lang === "en" ? "← Back" : "← Zurück"}
                </Text>
              </Pressable>

              {/* Day tabs */}
              <View style={styles.dayTabs}>
                <Pressable
                  style={[styles.dayTab, { borderColor: T.inputBorder },
                    selectedDay === "today" && styles.dayTabActive]}
                  onPress={() => handleDaySwitch("today")}
                >
                  <Text style={[styles.dayTabText,
                    { color: selectedDay === "today" ? "#fff" : T.sub }]}>
                    {lang === "en" ? "Today" : "Heute"}
                  </Text>
                </Pressable>
                {hasTomorrow && (
                  <Pressable
                    style={[styles.dayTab, { borderColor: T.inputBorder },
                      selectedDay === "tomorrow" && styles.dayTabActive]}
                    onPress={() => handleDaySwitch("tomorrow")}
                  >
                    <Text style={[styles.dayTabText,
                      { color: selectedDay === "tomorrow" ? "#fff" : T.sub }]}>
                      {lang === "en" ? "Tomorrow" : "Morgen"}
                    </Text>
                  </Pressable>
                )}
                {!hasTomorrow && (
                  <View style={[styles.dayTab, styles.dayTabDisabled, { borderColor: T.border }]}>
                    <Text style={[styles.dayTabText, { color: T.footer }]}>
                      {lang === "en" ? "Tomorrow (pending)" : "Morgen (noch nicht verfügbar)"}
                    </Text>
                  </View>
                )}
              </View>

              {/* Micro price bar */}
              {/* ── TimelineBar (same as main page) ── */}
              <View style={styles.timelineWrap}>
                {barSlots.length > 0 ? (
                  <TimelineBar
                    slots={barSlots}
                    isToday={selectedDay === "today"}
                    activeHour={selectedHour}
                    onActiveHourChange={(h) => { if (h !== null) setSelectedHour(h); }}
                  />
                ) : (
                  <Text style={[styles.noSlots, { color: T.sub }]}>
                    {lang === "en" ? "No data available." : "Keine Daten verfügbar."}
                  </Text>
                )}
              </View>

              {/* Timing selector */}
              <View style={styles.timingList}>
                {([
                  { value: 30 as Timing, label: lang === "en" ? "30 min before"  : "30 Min vorher",    badge: lang === "en" ? "Recommended" : "Empfohlen" },
                  { value: 60 as Timing, label: lang === "en" ? "1 hour before"  : "1 Std vorher",     badge: "" },
                  { value: 0  as Timing, label: lang === "en" ? "Right at start" : "Genau beim Start", badge: "" },
                ] as const).map(opt => (
                  <Pressable
                    key={opt.value}
                    style={[styles.timingRow, { borderColor: T.inputBorder },
                      timing === opt.value && { borderColor: T.text, backgroundColor: T.bg }]}
                    onPress={() => setTiming(opt.value)}
                  >
                    <Text style={[styles.timingLabel, { color: T.text }]}>{opt.label}</Text>
                    <View style={styles.timingRight}>
                      {!!opt.badge && (
                        <View style={[styles.badge, { backgroundColor: T.bg }]}>
                          <Text style={[styles.badgeText, { color: T.sub }]}>{opt.badge}</Text>
                        </View>
                      )}
                      {timing === opt.value && (
                        <Text style={[styles.check, { color: T.text }]}>✓</Text>
                      )}
                    </View>
                  </Pressable>
                ))}
              </View>

              {/* Preview — clearly shows window time vs. notification time */}
              <View style={[styles.preview,
                { backgroundColor: fireAtValid ? "#f0fdf4" : "#fef2f2" }]}>
                {fireAtValid ? (
                  <>
                    <Text style={[styles.previewRow, { color: T.sub }]}>
                      {lang === "en" ? `📍 Window: ${selectedHour}:00 Uhr` : `📍 Fenster: ${pad2(selectedHour)}:00 Uhr`}
                      {selectedHour === cheapHour ? (lang === "en" ? "  (cheapest)" : "  (günstigste)") : ""}
                    </Text>
                    <Text style={[styles.previewRow, { color: "#15803d", fontWeight: "700" }]}>
                      {lang === "en"
                        ? `💡 Reminder at ${fireLabel}${timing > 0 ? ` (${timing} min before)` : ""}`
                        : `💡 Erinnerung um ${fireLabel}${timing > 0 ? ` (${timing} Min vorher)` : ""}`}
                    </Text>
                  </>
                ) : (
                  <Text style={[styles.previewText, { color: "#dc2626" }]}>
                    {lang === "en"
                      ? "⚠️ Time already passed — choose a later hour"
                      : "⚠️ Zeit abgelaufen – andere Stunde wählen"}
                  </Text>
                )}
              </View>
            </>
          )}

          {/* CTA */}
          <Pressable
            style={[styles.cta, { backgroundColor: DARK_BTN },
              step === 2 && !fireAtValid && styles.ctaDisabled]}
            onPress={step === 1 ? () => setStep(2) : handleActivate}
            disabled={step === 2 && !fireAtValid}
          >
            <Text style={styles.ctaText}>
              {step === 1
                ? (lang === "en" ? "Next →" : "Weiter →")
                : (lang === "en" ? "Activate reminder" : "Erinnerung aktivieren")}
            </Text>
          </Pressable>

          <Pressable onPress={onClose} style={styles.cancelBtn}>
            <Text style={[styles.cancelText, { color: T.sub }]}>
              {lang === "en" ? "Cancel" : "Abbrechen"}
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop:    { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    maxHeight: "92%",
    borderTopLeftRadius: 20, borderTopRightRadius: 20, elevation: 20,
  },
  handleWrap:  { alignItems: "center", paddingTop: 12, paddingBottom: 4 },
  handle:      { width: 40, height: 4, borderRadius: 2 },
  dots:        { flexDirection: "row", justifyContent: "center", gap: 6, paddingVertical: 6 },
  dot:         { width: 8, height: 4, borderRadius: 2 },
  content:     { paddingHorizontal: 20, paddingBottom: 36 },
  title:       { fontSize: 16, fontWeight: "700", marginBottom: 14 },
  backBtn:     { marginBottom: 8 },
  backText:    { fontSize: 13 },
  // Device grid
  deviceGrid:  { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 18 },
  deviceCard: {
    width: "47%", borderRadius: 14, borderWidth: 2,
    paddingVertical: 12, alignItems: "center",
  },
  deviceEmoji: { fontSize: 22, marginBottom: 4 },
  deviceLabel: { fontSize: 12, fontWeight: "600" },
  // Day tabs
  dayTabs:     { flexDirection: "row", gap: 8, marginBottom: 10 },
  dayTab: {
    flex: 1, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5,
    alignItems: "center",
  },
  dayTabActive:   { backgroundColor: "#111827", borderColor: "#111827" },
  dayTabDisabled: { opacity: 0.4 },
  dayTabText:  { fontSize: 13, fontWeight: "600" },
  noSlots:     { fontSize: 12, textAlign: "center", marginVertical: 10 },
  // Timeline
  timelineWrap:{ marginBottom: 10 },
  // Timing
  timingList:  { gap: 6, marginBottom: 10 },
  timingRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1.5,
  },
  timingLabel: { fontSize: 13, fontWeight: "600" },
  timingRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  badge:       { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  badgeText:   { fontSize: 10 },
  check:       { fontSize: 13 },
  // Preview
  preview:     { borderRadius: 10, padding: 10, marginBottom: 12, alignItems: "center", gap: 4 },
  previewText: { fontSize: 12, fontWeight: "600" },
  previewRow:  { fontSize: 12 },
  // CTA
  cta:         { borderRadius: 12, paddingVertical: 14, alignItems: "center", marginBottom: 8 },
  ctaDisabled: { opacity: 0.4 },
  ctaText:     { color: "#fff", fontSize: 14, fontWeight: "700" },
  cancelBtn:   { alignItems: "center", paddingVertical: 8 },
  cancelText:  { fontSize: 13 },
});
