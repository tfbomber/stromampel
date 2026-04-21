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
            <Text style={[styles.body, { color: T.sub }]}> 
              {isDE
                ? "• Zeigt Spotpreise und günstige Zeitfenster für Strom.\n\n• Deine Einstellungen bleiben auf diesem Gerät.\n\n• Anonyme Nutzungsdaten helfen, die App zu verbessern."
                : "• Shows spot prices and cheaper electricity windows.\n\n• Your settings stay on this device.\n\n• Anonymous usage data helps improve the app."}
            </Text>
          </ScrollView>

          {/* Accept button */}
          <Pressable style={styles.acceptBtn} onPress={handleAccept}>
            <Text style={styles.acceptText}>
              {isDE ? "Verstanden & weiter" : "Got it & continue"}
            </Text>
          </Pressable>

          <Pressable onPress={() => Linking.openURL(isDE ? "https://stromampel.de/datenschutz" : "https://stromampel.de/privacy")}> 
            <Text style={[styles.footnote, { color: T.sub }]}> 
              {isDE ? "Datenschutzerklärung öffnen" : "Open privacy policy"}
            </Text>
          </Pressable>
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
    maxHeight: 220,
    marginBottom: 20,
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
    fontSize: 11,
    textAlign: "center",
    opacity: 0.75,
    textDecorationLine: "underline",
  },
});
