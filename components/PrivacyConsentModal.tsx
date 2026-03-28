// ============================================================
// PrivacyConsentModal — First-launch privacy notice
// Shown once on first open. Acceptance stored in AsyncStorage.
// ============================================================

import React, { useEffect, useState } from "react";
import {
  Modal, View, Text, Pressable, StyleSheet, ScrollView, Linking,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../lib/theme";
import { useI18n } from "../lib/i18n";

const CONSENT_KEY = "sa_privacy_consent_v1";

export default function PrivacyConsentModal() {
  const T    = useTheme();
  const { lang } = useI18n();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(CONSENT_KEY).then((raw) => {
      if (!raw) setVisible(true);
    }).catch(() => setVisible(true));
  }, []);

  async function handleAccept() {
    await AsyncStorage.setItem(
      CONSENT_KEY,
      JSON.stringify({ accepted: true, ts: Date.now() })
    ).catch(() => {});
    setVisible(false);
  }

  const isDE = lang !== "en";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: T.card }]}>
          {/* Header */}
          <Text style={[styles.title, { color: T.text }]}>
            {isDE ? "🔒 Datenschutz & Hinweise" : "🔒 Privacy & Notes"}
          </Text>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* Section: What the app does */}
            <Text style={[styles.sectionHead, { color: T.text }]}>
              {isDE ? "Was diese App macht" : "What this app does"}
            </Text>
            <Text style={[styles.body, { color: T.sub }]}>
              {isDE
                ? "StromAmpel zeigt dir Echtzeit-Strompreise vom deutschen Spotmarkt und hilft dir, günstige Ladezeiten für Haushaltsgeräte und E-Autos zu finden."
                : "StromAmpel shows real-time electricity prices from the German spot market and helps you find cheap charging times for appliances and EVs."}
            </Text>

            {/* Section: Data & Privacy */}
            <Text style={[styles.sectionHead, { color: T.text }]}>
              {isDE ? "Deine Daten" : "Your data"}
            </Text>
            <Text style={[styles.body, { color: T.sub }]}>
              {isDE
                ? "• Alle deine Einstellungen (Anbieter, Tarif, Benachrichtigungen) werden ausschließlich lokal auf deinem Gerät gespeichert.\n\n• Deine gespeicherten Aktionen verbleiben lokal – wir sehen sie nicht.\n\n• Die App verwendet Firebase Analytics zur anonymen Nutzungsanalyse (z. B. App-Öffnungen). Es werden keine personenbezogenen Daten erfasst oder weitergegeben.\n\n• Es werden keine Werbeanzeigen eingeblendet."
                : "• All your settings (provider, tariff, notifications) are stored exclusively on your device.\n\n• Your saved actions remain local — we never see them.\n\n• The app uses Firebase Analytics for anonymous usage analysis (e.g. app opens). No personal data is collected or shared.\n\n• No advertisements are shown."}
            </Text>

            {/* Section: Data source */}
            <Text style={[styles.sectionHead, { color: T.text }]}>
              {isDE ? "Datenquelle" : "Data source"}
            </Text>
            <Text style={[styles.body, { color: T.sub }]}>
              {isDE
                ? "Preisdaten stammen vom EPEX Spotmarkt / ENTSO-E. Die App ist kostenlos und unabhängig."
                : "Price data from EPEX Spot market / ENTSO-E. The app is free and independent."}
            </Text>
          </ScrollView>

          {/* Accept button */}
          <Pressable style={styles.acceptBtn} onPress={handleAccept}>
            <Text style={styles.acceptText}>
              {isDE ? "Verstanden & weiter" : "Got it & continue"}
            </Text>
          </Pressable>

          <Text style={[styles.footnote, { color: T.sub }]}>
            {isDE
              ? "Vollständige Datenschutzerklärung: stromampel.de/datenschutz"
              : "Full privacy policy: stromampel.de/privacy"}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 38,
    maxHeight: "85%",
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 16,
    textAlign: "center",
  },
  scroll: {
    maxHeight: 320,
    marginBottom: 20,
  },
  sectionHead: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 14,
    marginBottom: 5,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  body: {
    fontSize: 13,
    lineHeight: 20,
  },
  acceptBtn: {
    backgroundColor: "#16a34a",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 10,
  },
  acceptText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  footnote: {
    fontSize: 10,
    textAlign: "center",
    opacity: 0.5,
  },
});
