// ============================================================
// FeedbackSheet — User feedback modal → Firebase Firestore
// v2: + deviceId tracking (Method A) + i18n support
// ============================================================

import React, { useState } from "react";
import {
  View, Text, Modal, TextInput, Pressable, StyleSheet,
  TouchableOpacity, KeyboardAvoidingView, Platform,
} from "react-native";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import Constants from "expo-constants";
import { db } from "../lib/firebase";
import { logFeedbackSubmitted } from "../lib/analytics";
import { useTheme } from "../lib/theme";
import { useI18n } from "../lib/i18n";
import { getDeviceId } from "../lib/deviceId";

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function FeedbackSheet({ visible, onClose }: Props) {
  const T = useTheme();
  const { t } = useI18n();
  const [text,  setText]  = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function handleSend() {
    if (!text.trim() || state !== "idle") return;
    setState("sending");

    try {
      const deviceId = await getDeviceId();

      const writePromise = addDoc(collection(db, "feedback"), {
        text:       text.trim(),
        timestamp:  serverTimestamp(),
        platform:   Platform.OS,
        appVersion: Constants.expoConfig?.version ?? "unknown",
        createdAt:  Date.now(),
        deviceId,                    // Method A — anonymous device tracking
      });

      // Timeout guard: Firestore may hang if DB not set up or network fails
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("[Feedback] Firestore write timed out")), 8000)
      );
      await Promise.race([writePromise, timeoutPromise]);

      logFeedbackSubmitted();  // fire-and-forget analytics
      setState("sent");
      setText("");
      setTimeout(() => { setState("idle"); onClose(); }, 1800);
    } catch (e) {
      console.error("[Feedback] Firestore write failed:", e);
      setState("error");
      setTimeout(() => setState("idle"), 3000);
    }
  }

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.avoider}
      >
        <View style={[styles.sheet, { backgroundColor: T.card }]}>
          {/* Handle */}
          <View style={styles.handleWrap}>
            <View style={[styles.handle, { backgroundColor: T.border }]} />
          </View>

          <View style={styles.content}>
            {/* Header */}
            <View style={styles.headerRow}>
              <Text style={[styles.title, { color: T.text }]}>{t("feedbackTitle")}</Text>
              <Pressable onPress={onClose} hitSlop={10}>
                <Text style={[styles.closeBtn, { color: T.sub }]}>✕</Text>
              </Pressable>
            </View>
            <Text style={[styles.hint, { color: T.sub }]}>{t("feedbackHint")}</Text>

            {/* Sent state */}
            {state === "sent" ? (
              <View style={styles.sentBox}>
                <Text style={styles.sentEmoji}>✅</Text>
                <Text style={[styles.sentText, { color: "#15803d" }]}>{t("feedbackSent")}</Text>
              </View>
            ) : state === "error" ? (
              <View style={styles.sentBox}>
                <Text style={styles.sentEmoji}>⚠️</Text>
                <Text style={[styles.sentText, { color: "#dc2626" }]}>{t("feedbackError")}</Text>
              </View>
            ) : (
              <>
                <TextInput
                  style={[styles.input, {
                    backgroundColor: T.bg,
                    color: T.text,
                    borderColor: T.inputBorder,
                  }]}
                  placeholder={t("feedbackPlaceholder")}
                  placeholderTextColor={T.sub}
                  multiline
                  maxLength={500}
                  value={text}
                  onChangeText={setText}
                  textAlignVertical="top"
                  editable={state === "idle"}
                />
                <Text style={[styles.charCount, { color: T.footer }]}>{text.length}/500</Text>

                <View style={styles.actions}>
                  <Pressable style={[styles.btn, styles.cancelBtn, { borderColor: T.border }]} onPress={onClose}>
                    <Text style={[styles.btnText, { color: T.sub }]}>{t("cancel")}</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.btn, styles.sendBtn, { opacity: text.trim() ? 1 : 0.4 }]}
                    onPress={handleSend}
                    disabled={!text.trim() || state !== "idle"}
                  >
                    <Text style={[styles.btnText, { color: "#fff" }]}>
                      {state === "sending" ? t("sending") : t("send")}
                    </Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop:   { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  avoider:    { flex: 1, justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15, shadowRadius: 16, elevation: 20,
  },
  handleWrap: { alignItems: "center", paddingTop: 12, paddingBottom: 4 },
  handle:     { width: 40, height: 4, borderRadius: 2 },
  content:    { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 8 },
  headerRow:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  title:      { fontSize: 16, fontWeight: "700" },
  closeBtn:   { fontSize: 16 },
  hint:       { fontSize: 12, lineHeight: 18, marginBottom: 16 },
  input: {
    borderWidth: 1, borderRadius: 14,
    padding: 14, fontSize: 14,
    minHeight: 130, marginBottom: 4,
  },
  charCount:  { fontSize: 10, textAlign: "right", marginBottom: 16 },
  actions:    { flexDirection: "row", gap: 10 },
  btn:        { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: "center" },
  cancelBtn:  { borderWidth: 1 },
  sendBtn:    { backgroundColor: "#16a34a" },
  btnText:    { fontSize: 14, fontWeight: "700" },
  sentBox:    { alignItems: "center", paddingVertical: 48, gap: 12 },
  sentEmoji:  { fontSize: 40 },
  sentText:   { fontSize: 16, fontWeight: "700", textAlign: "center" },
});
