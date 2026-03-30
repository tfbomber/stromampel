// ============================================================
// NotifySheet — Themed version
// ============================================================

import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, Pressable, StyleSheet, Modal,
  Animated, TouchableOpacity, Alert,
} from "react-native";
import * as Notifications from "expo-notifications";
import type { Device, Timing } from "../lib/settings";
import type { CheapWindow } from "../lib/types";
import { useTheme } from "../lib/theme";
import { useI18n } from "../lib/i18n";

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
  onActivate: (device: Device, timing: Timing) => void;
  cheapWindow: CheapWindow | null;
}

export default function NotifySheet({ visible, onClose, onActivate, cheapWindow }: Props) {
  const T = useTheme();
  const { lang } = useI18n();
  const [step,   setStep]   = useState<1 | 2>(1);
  const [device, setDevice] = useState<Device>("allgemein");
  const [timing, setTiming] = useState<Timing>(30);
  const slideAnim = useRef(new Animated.Value(400)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 0 : 400,
      useNativeDriver: true, tension: 65, friction: 11,
    }).start();
    if (!visible) setStep(1);
  }, [visible]);

  async function handleActivate() {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        lang === "en" ? "Notifications disabled" : "Benachrichtigungen deaktiviert",
        lang === "en" ? "Please enable in settings." : "Bitte in den Einstellungen erlauben."
      );
      return;
    }
    // Scheduling is handled by the auto-scheduler in App.tsx
    // which fires immediately after onActivate is called.
    onActivate(device, timing);
    onClose();
  }

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
          {[1, 2].map((n) => (
            <View
              key={n}
              style={[styles.dot, { backgroundColor: T.border }, n === step && { width: 24, backgroundColor: T.text }]}
            />
          ))}
        </View>

        <View style={styles.content}>
          {/* STEP 1 — Device */}
          {step === 1 && (
            <>
              <Text style={[styles.title, { color: T.text }]}>
                {lang === "en" ? "Which device?" : "Für welches Gerät?"}
              </Text>
              <View style={styles.deviceGrid}>
                {(["allgemein", "waschen", "spuelmaschine", "trockner"] as Device[]).map((d) => (
                  <Pressable
                    key={d}
                    style={[
                      styles.deviceCard,
                      { borderColor: T.inputBorder, backgroundColor: T.bg },
                      device === d && { borderColor: T.text },
                    ]}
                    onPress={() => setDevice(d)}
                  >
                    <Text style={styles.deviceEmoji}>{DEVICE_EMOJI[d]}</Text>
                    <Text style={[styles.deviceLabel, { color: T.sub }, device === d && { color: T.text }]}>
                      {lang === "en" ? DEVICE_LABELS_EN[d] : DEVICE_LABELS_DE[d]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          {/* STEP 2 — Timing */}
          {step === 2 && (
            <>
              <Pressable onPress={() => setStep(1)} style={styles.backBtn}>
                <Text style={[styles.backText, { color: T.sub }]}>
                  {lang === "en" ? "← Back" : "← Zurück"}
                </Text>
              </Pressable>
              <Text style={[styles.title, { color: T.text }]}>
                {lang === "en" ? "How early to remind?" : "Wie früh erinnern?"}
              </Text>
              <View style={styles.timingList}>
                {([
                  { value: 30 as Timing, label: lang === "en" ? "30 min before"   : "30 Min vorher",    badge: lang === "en" ? "Recommended" : "Empfohlen" },
                  { value: 60 as Timing, label: lang === "en" ? "1 hour before"   : "1 Std vorher",     badge: "" },
                  { value: 0  as Timing, label: lang === "en" ? "Right at start"  : "Genau beim Start", badge: "" },
                ] as const).map((opt) => (
                  <Pressable
                    key={opt.value}
                    style={[
                      styles.timingRow,
                      { borderColor: T.inputBorder },
                      timing === opt.value && { borderColor: T.text, backgroundColor: T.bg },
                    ]}
                    onPress={() => setTiming(opt.value)}
                  >
                    <Text style={[styles.timingLabel, { color: T.text }]}>{opt.label}</Text>
                    <View style={styles.timingRight}>
                      {opt.badge ? (
                        <View style={[styles.badge, { backgroundColor: T.bg }]}>
                          <Text style={[styles.badgeText, { color: T.sub }]}>{opt.badge}</Text>
                        </View>
                      ) : null}
                      {timing === opt.value && <Text style={[styles.check, { color: T.text }]}>✓</Text>}
                    </View>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          {/* CTA */}
          <Pressable
            style={[styles.cta, { backgroundColor: DARK_BTN }]}
            onPress={step === 1 ? () => setStep(2) : handleActivate}
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
    borderTopLeftRadius: 20, borderTopRightRadius: 20, elevation: 20,
  },
  handleWrap:  { alignItems: "center", paddingTop: 12, paddingBottom: 4 },
  handle:      { width: 40, height: 4, borderRadius: 2 },
  dots:        { flexDirection: "row", justifyContent: "center", gap: 6, paddingVertical: 8 },
  dot:         { width: 8, height: 4, borderRadius: 2 },
  content:     { paddingHorizontal: 20, paddingBottom: 40 },
  title:       { fontSize: 16, fontWeight: "700", marginBottom: 16 },
  backBtn:     { marginBottom: 8 },
  backText:    { fontSize: 14 },
  deviceGrid:  { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  deviceCard: {
    width: "47%", borderRadius: 14, borderWidth: 2,
    paddingVertical: 12, alignItems: "center",
  },
  deviceEmoji:  { fontSize: 22, marginBottom: 4 },
  deviceLabel:  { fontSize: 12, fontWeight: "600" },
  timingList:   { gap: 8, marginBottom: 20 },
  timingRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 14, borderRadius: 12, borderWidth: 2,
  },
  timingLabel:  { fontSize: 14, fontWeight: "600" },
  timingRight:  { flexDirection: "row", alignItems: "center", gap: 8 },
  badge:        { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeText:    { fontSize: 11 },
  check:        { fontSize: 14 },
  cta:          { borderRadius: 12, paddingVertical: 14, alignItems: "center", marginBottom: 8 },
  ctaText:      { color: "#fff", fontSize: 14, fontWeight: "700" },
  cancelBtn:    { alignItems: "center", paddingVertical: 10 },
  cancelText:   { fontSize: 14 },
});
