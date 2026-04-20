// ============================================================
// SettingsSheet — Themed version
// v2: + Language selector (DE / EN) + i18n support
// ============================================================

import React, { useEffect, useRef } from "react";
import {
  View, Text, Pressable, StyleSheet, Modal,
  Animated, TouchableOpacity, ScrollView,
} from "react-native";
import Constants from "expo-constants";
import * as Haptics from "expo-haptics";
import type { TariffType, AppSettings, Theme, Language } from "../lib/settings";
import { useTheme } from "../lib/theme";
import { useI18n } from "../lib/i18n";

const LANGUAGE_OPTIONS: { value: Language; flag: string; label: string }[] = [
  { value: "de", flag: "🇩🇪", label: "Deutsch" },
  { value: "en", flag: "🇬🇧", label: "English" },
];

interface Props {
  visible:  boolean;
  settings: AppSettings;
  onClose:  () => void;
  onChange: (patch: Partial<AppSettings>) => void;
}

export default function SettingsSheet({ visible, settings, onClose, onChange }: Props) {
  const T = useTheme();
  const { t, lang } = useI18n();
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 0 : 300,
      useNativeDriver: true, tension: 65, friction: 11,
    }).start();
  }, [visible]);

  const GREEN = "#16a34a";

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

      <Animated.View style={[styles.sheet, { backgroundColor: T.card, transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.handleWrap}>
          <View style={[styles.handle, { backgroundColor: T.border }]} />
        </View>

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: T.text }]}>{t("settings")}</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Text style={[styles.closeBtn, { color: T.sub }]}>✕</Text>
            </Pressable>
          </View>

          {/* ── Tariff toggle ──────────────────────────── */}
          <Text style={[styles.sectionLabel, { color: T.sectionLabel }]}>{t("myTariff")}</Text>
          <View style={styles.tariffRow}>
            {(["dynamic", "fixed"] as TariffType[]).map((tariff) => {
              const selected = settings.tariffType === tariff;
              return (
                <Pressable
                  key={tariff}
                  style={[
                    styles.compactCard,
                    { borderColor: selected ? GREEN : T.inputBorder, backgroundColor: T.bg },
                  ]}
                  onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  onChange({ tariffType: tariff });
                }}
                >
                  <Text style={styles.compactEmoji}>{tariff === "dynamic" ? "⚡" : "🔒"}</Text>
                  <Text style={[styles.compactName, { color: selected ? GREEN : T.sub }]}>
                    {t(tariff === "dynamic" ? "dynamic" : "fixed")}
                  </Text>
                  <Text style={[styles.compactSub, { color: T.sectionLabel }]}>
                    {t(tariff === "dynamic" ? "dynamicSub" : "fixedSub")}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {settings.tariffType === "fixed" && (
            <Text style={[styles.tariffNote, { color: T.sub }]}>{t("fixedNote")}</Text>
          )}

          {/* ── Language ────────────────────────────────── */}
          <Text style={[styles.sectionLabel, { color: T.sectionLabel }]}>{t("language")}</Text>
          <View style={styles.tariffRow}>
            {LANGUAGE_OPTIONS.map((lang) => {
              const selected = settings.language === lang.value;
              return (
                <Pressable
                  key={lang.value}
                  style={[
                    styles.compactCard,
                    { borderColor: selected ? GREEN : T.inputBorder, backgroundColor: T.bg },
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    onChange({ language: lang.value });
                  }}
                >
                  <Text style={styles.compactEmoji}>{lang.flag}</Text>
                  <Text style={[styles.compactName, { color: selected ? GREEN : T.sub }]}>
                    {lang.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* ── Appearance ──────────────────────────────── */}
          <Text style={[styles.sectionLabel, { color: T.sectionLabel }]}>{t("appearance")}</Text>
          <View style={styles.tariffRow}>
            {(["light", "dark"] as Theme[]).map((thm) => {
              const selected = settings.theme === thm;
              return (
                <Pressable
                  key={thm}
                  style={[
                    styles.compactCard,
                    { borderColor: selected ? GREEN : T.inputBorder, backgroundColor: T.bg },
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    onChange({ theme: thm });
                  }}
                >
                  <Text style={styles.compactEmoji}>{thm === "light" ? "☀️" : "🌙"}</Text>
                  <Text style={[styles.compactName, { color: selected ? GREEN : T.sub }]}>
                    {t(thm === "light" ? "light" : "dark")}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* ── Troubleshooting ─────────────────────────────── */}
          <Text style={[styles.sectionLabel, { color: T.sectionLabel }]}>
            {lang === "en" ? "TROUBLESHOOTING" : "FEHLERBEHEBUNG"}
          </Text>
          <Pressable
            style={[styles.troubleCard, { borderColor: T.inputBorder, backgroundColor: T.bg }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              import("react-native").then(({ Alert, Linking }) => {
                Alert.alert(
                  lang === "en" ? "Notification Fixes" : "Benachrichtigungs-Hilfe",
                  lang === "en"
                    ? "• Android 14+: Please ensure \"Alarms & reminders\" (Exact Alarms) permission is granted.\n\n• Xiaomi/Huawei/Samsung: If the app is swiped away from Recents, alarms may be killed. Lock the app in Recents or enable \"AutoStart\" in phone settings."
                    : "• Android 14+: Bitte überprüfe in den Einstellungen, ob die Berechtigung für \"Wecker und Erinnerungen\" erteilt ist.\n\n• Xiaomi/Huawei/Samsung: Wenn Du die App wegwischst, werden Alarme oft blockiert. Bitte die App im Task-Manager sperren oder \"AutoStart\" aktivieren.",
                  [
                    { text: lang === "en" ? "Cancel" : "Abbrechen", style: "cancel" },
                    { text: lang === "en" ? "Open Settings" : "Zu den Einstellungen", onPress: () => Linking.openSettings() }
                  ]
                );
              });
            }}
          >
            <Text style={styles.troubleEmoji}>🛠️</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.troubleTitle, { color: T.text }]}>
                {lang === "en" ? "Fix Notifications" : "Benachrichtigungen reparieren"}
              </Text>
              <Text style={[styles.troubleSub, { color: T.sub }]}>
                {lang === "en"
                  ? "Not receiving alerts? Check permissions & battery."
                  : "Keine Erinnerungen? Rechte & Akku-Optionen prüfen."}
              </Text>
            </View>
          </Pressable>

          {/* ── Netzentgelt / Surcharge ─────────────────────── */}
          <Text style={[styles.sectionLabel, { color: T.sectionLabel }]}>
            {lang === "en" ? "GRID FEE ESTIMATE" : "NETZENTGELT"}
          </Text>
          <View style={[styles.surchargeBox, { borderColor: T.inputBorder, backgroundColor: T.bg }]}>
            <Text style={[styles.surchargeSub, { color: T.sub }]}>
              {lang === "en"
                ? `Added to spot price. Default 23 ct covers most German regions.`
                : `Zum Spotpreis addiert. Standard 23 ct gilt für die meisten deutschen Regionen.`}
            </Text>
            <View style={styles.surchargeRow}>
              {[18, 20, 23, 25, 28].map(v => {
                const sel = (settings.surchargeCt ?? 23) === v;
                return (
                  <Pressable
                    key={v}
                    style={[styles.surchargeChip,
                      { borderColor: sel ? GREEN : T.inputBorder,
                        backgroundColor: sel ? "#f0fdf4" : T.bg }]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      onChange({ surchargeCt: v });
                    }}
                  >
                    <Text style={[styles.surchargeChipText, { color: sel ? "#15803d" : T.sub }]}>{v} ct</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Text style={[styles.footerNote, { color: T.footer }]}>{t("savedLocal")}</Text>
          <Text style={[styles.versionNote, { color: T.footer }]}>
            Version {Constants.expoConfig?.version ?? "1.0.0"}
          </Text>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop:    { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    maxHeight: "85%",
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 20,
  },
  scrollArea: { flexShrink: 1 },
  handleWrap:  { alignItems: "center", paddingTop: 12, paddingBottom: 4 },
  handle:      { width: 40, height: 4, borderRadius: 2 },
  content:     { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 8 },
  headerRow:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  title:       { fontSize: 16, fontWeight: "700" },
  closeBtn:    { fontSize: 16 },
  sectionLabel:{ fontSize: 11, fontWeight: "600", letterSpacing: 0.8, marginBottom: 8, opacity: 0.7 },
  tariffRow:   { flexDirection: "row", gap: 8, marginBottom: 16 },
  // compactCard: used for Tariff / Appearance / Language rows
  compactCard: {
    flex: 1, borderRadius: 12, borderWidth: 1.5, paddingVertical: 8, paddingHorizontal: 8,
    alignItems: "center",
  },
  compactEmoji: { fontSize: 16, marginBottom: 2 },
  compactName:  { fontSize: 12, fontWeight: "600" },
  compactSub:   { fontSize: 9, marginTop: 1 },
  tariffNote:  { fontSize: 11, marginBottom: 14, marginTop: -6, lineHeight: 16 },
  pills:       { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  pill:        { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  pillText:    { fontSize: 13 },
  footerNote:  { fontSize: 11, textAlign: "center", marginTop: 4 },
  versionNote: { fontSize: 10, textAlign: "center", marginTop: 2, opacity: 0.6 },
  troubleCard: {
    flexDirection: "row", alignItems: "center", gap: 12, padding: 12,
    borderRadius: 12, borderWidth: 1.5, marginBottom: 16,
  },
  troubleEmoji: { fontSize: 22 },
  troubleTitle: { fontSize: 13, fontWeight: "600", marginBottom: 2 },
  troubleSub:   { fontSize: 11, lineHeight: 15 },
  // Surcharge / Netzentgelt section
  surchargeBox: {
    borderWidth: 1.5, borderRadius: 12, padding: 12, marginBottom: 14,
  },
  surchargeSub:      { fontSize: 11, lineHeight: 16, marginBottom: 10 },
  surchargeRow:      { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  surchargeChip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1.5,
  },
  surchargeChipText: { fontSize: 13, fontWeight: "600" },
});
