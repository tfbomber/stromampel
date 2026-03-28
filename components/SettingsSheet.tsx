// ============================================================
// SettingsSheet — Themed version
// v2: + Language selector (DE / EN) + i18n support
// ============================================================

import React, { useEffect, useRef } from "react";
import {
  View, Text, Pressable, StyleSheet, Modal,
  Animated, TouchableOpacity,
} from "react-native";
import Constants from "expo-constants";
import type { TariffType, AppSettings, Theme, Language } from "../lib/settings";
import { useTheme } from "../lib/theme";
import { useI18n, type TranslationKey } from "../lib/i18n";

type AnbieterOption =
  | { value: string; label: string }
  | { value: string; labelKey: TranslationKey };

const ANBIETER_OPTIONS: AnbieterOption[] = [
  { value: "tibber",   label: "Tibber" },
  { value: "awattar",  label: "aWATTar" },
  { value: "ostrom",   label: "Ostrom" },
  { value: "eprimo",   label: "eprimo" },
  { value: "other",    labelKey: "otherProvider" },
];

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
  const { t } = useI18n();
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

        <View style={styles.content}>
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
                  onPress={() => onChange({ tariffType: tariff, anbieter: tariff === "fixed" ? "" : settings.anbieter })}
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

          {/* ── Anbieter (dynamic only) ─────────────────── */}
          {settings.tariffType === "dynamic" && (
            <>
              <Text style={[styles.sectionLabel, { color: T.sectionLabel }]}>{t("myProvider")}</Text>
              <View style={styles.pills}>
                {ANBIETER_OPTIONS.map((a) => {
                  const selected = settings.anbieter === a.value;
                  const label = "labelKey" in a ? t(a.labelKey) : a.label;
                  return (
                    <Pressable
                      key={a.value}
                      style={[
                        styles.pill,
                        { borderColor: selected ? GREEN : T.inputBorder,
                          backgroundColor: selected ? "#f0fdf4" : T.bg },
                      ]}
                      onPress={() => onChange({ anbieter: selected ? "" : a.value })}
                    >
                      <Text style={[styles.pillText, { color: selected ? "#15803d" : T.sub },
                        selected && { fontWeight: "600" }]}>
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
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
                  onPress={() => onChange({ language: lang.value })}
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
                  onPress={() => onChange({ theme: thm })}
                >
                  <Text style={styles.compactEmoji}>{thm === "light" ? "☀️" : "🌙"}</Text>
                  <Text style={[styles.compactName, { color: selected ? GREEN : T.sub }]}>
                    {t(thm === "light" ? "light" : "dark")}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.footerNote, { color: T.footer }]}>{t("savedLocal")}</Text>
          <Text style={[styles.versionNote, { color: T.footer }]}>
            Version {Constants.expoConfig?.version ?? "1.0.0"}
          </Text>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop:    { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 20,
  },
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
});
