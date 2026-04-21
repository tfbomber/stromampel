import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, Pressable, StyleSheet, Modal,
  Animated, TouchableOpacity, Alert, ScrollView, Linking,
} from "react-native";
import * as Notifications from "expo-notifications";
import * as Haptics from "expo-haptics";
import type { Timing, NotifyMode } from "../lib/settings";
import type { CheapWindow } from "../lib/types";
import { useTheme } from "../lib/theme";
import { useI18n } from "../lib/i18n";

interface Props {
  visible:    boolean;
  onClose:    () => void;
  onActivate: (mode: NotifyMode, timing: Timing, fireAtEpoch?: number) => void;
  todayCheapestWindow:    CheapWindow | null;
  todayNextCheapWindow:   CheapWindow | null;
  tomorrowCheapestWindow: CheapWindow | null;
  initialTiming?: Timing;
}

export default function NotifySheet({
  visible,
  onClose,
  onActivate,
  todayCheapestWindow,
  todayNextCheapWindow,
  tomorrowCheapestWindow,
  initialTiming,
}: Props) {
  const T = useTheme();
  const { lang } = useI18n();
  const [timing, setTiming] = useState<Timing>(30);
  const slideAnim = useRef(new Animated.Value(400)).current;

  useEffect(() => {
    if (visible) {
      setTiming(initialTiming ?? 30);
    }
  }, [visible, initialTiming]);

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 0 : 400,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  }, [visible, slideAnim]);

  const smartWindow = todayNextCheapWindow ?? todayCheapestWindow ?? tomorrowCheapestWindow ?? null;
  const smartLabel = smartWindow
    ? smartWindow.date === "tomorrow"
      ? (lang === "en" ? `Tomorrow · ${smartWindow.coreLabel}` : `Morgen · ${smartWindow.coreLabel}`)
      : smartWindow.coreLabel
    : null;

  async function handleActivate() {
    const existing = await Notifications.getPermissionsAsync();

    const proceed = async () => {
      onActivate("daily_smart", timing);
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

          <Text style={[styles.sectionLabel, { color: T.sub }]}> 
            {lang === "en" ? "HOW EARLY?" : "WIE FRÜH?"}
          </Text>
          <View style={styles.timingList}>
            {([
              { value: 30 as Timing, label: lang === "en" ? "30 min before" : "30 Min vorher", badge: lang === "en" ? "Recommended" : "Empfohlen" },
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

          <Pressable
            style={styles.cta}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              handleActivate();
            }}
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
    position: "absolute", bottom: 0, left: 0, right: 0,
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
  cta:         { borderRadius: 12, paddingVertical: 14, alignItems: "center", marginBottom: 8, backgroundColor: "#111827" },
  ctaText:     { color: "#fff", fontSize: 14, fontWeight: "700" },
  cancelBtn:   { alignItems: "center", paddingVertical: 8 },
  cancelText:  { fontSize: 13 },
});
