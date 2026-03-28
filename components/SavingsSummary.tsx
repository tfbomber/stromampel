// ============================================================
// SavingsSummary — Weekly claimed savings overview card
// Resets every Monday (ISO week start)
// Always visible — shows zero-state when no claims yet
// ============================================================

import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { getClaimsForThisWeek, getStartOfWeek, type ClaimRecord } from "../lib/savings";
import { useTheme } from "../lib/theme";
import { useI18n } from "../lib/i18n";

interface Props {
  refreshKey: number;
}

const DEVICE_EMOJI: Record<string, string> = {
  "Waschgang":    "🫧",
  "Spülmaschine": "🍽️",
  "Trockner":     "🌀",
  "E-Auto Laden": "🚗",
};

function weekRangeLabel(lang: "de" | "en"): string {
  const monday = new Date(getStartOfWeek());
  const sunday = new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) =>
    `${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1).toString().padStart(2, "0")}.`;
  return lang === "en"
    ? `Mon ${fmt(monday)} – Sun ${fmt(sunday)}`
    : `Mo ${fmt(monday)} – So ${fmt(sunday)}`;
}

export default function SavingsSummary({ refreshKey }: Props) {
  const T = useTheme();
  const { lang } = useI18n();
  const [claims, setClaims] = useState<ClaimRecord[]>([]);

  useEffect(() => {
    getClaimsForThisWeek().then(setClaims);
  }, [refreshKey]);

  const total = claims.reduce((sum, c) => sum + c.savingEur, 0);
  const hasClaims = claims.length > 0;

  const counts: Record<string, number> = {};
  claims.forEach((c) => {
    counts[c.device] = (counts[c.device] ?? 0) + 1;
  });

  return (
    <View style={[styles.card, { backgroundColor: T.card }]}>
      <View style={styles.accent} />

      <View style={styles.header}>
        <Text style={styles.coin}>{hasClaims ? "💰" : "🪙"}</Text>
        <Text style={[styles.label, { color: T.sub }]}>
          {lang === "en" ? "Saved this week" : "Diese Woche gespart"}
        </Text>
        <Text style={[styles.total, { color: hasClaims ? "#15803d" : T.sub }]}>
          {total.toFixed(2).replace(".", ",")} €
        </Text>
        <Text style={[styles.weekRange, { color: T.sub }]}>{weekRangeLabel(lang)}</Text>
      </View>

      {hasClaims ? (
        <>
          <View style={styles.badges}>
            {Object.entries(counts).map(([device, count]) => (
              <View key={device} style={[styles.badge, { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" }]}>
                <Text style={styles.badgeText}>
                  {DEVICE_EMOJI[device] ?? "⚡"} ×{count}
                </Text>
              </View>
            ))}
          </View>
          <Text style={[styles.footnote, { color: T.sub }]}>
            {claims.length}{" "}
            {claims.length === 1
              ? (lang === "en" ? "action" : "Aktion")
              : (lang === "en" ? "actions" : "Aktionen")}{" "}
            {lang === "en" ? "this week · Resets every Monday" : "diese Woche · Wird jeden Montag zurückgesetzt"}
          </Text>
        </>
      ) : (
        <Text style={[styles.emptyHint, { color: T.sub }]}>
          {lang === "en"
            ? "Press \"Start\" on a device below to record your first saving! 👇"
            : "Drücke \"Starten\" bei einem Gerät unten, um deine erste Ersparnis zu erfassen! 👇"}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14, padding: 16, marginTop: 10, overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  accent: {
    position: "absolute", top: 0, left: 0, right: 0, height: 3,
    backgroundColor: "#16a34a",
  },
  header:    { alignItems: "center", marginTop: 6, marginBottom: 12 },
  coin:      { fontSize: 28, marginBottom: 4 },
  label:     { fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, textAlign: "center" },
  total:     { fontSize: 40, fontWeight: "700", letterSpacing: -1, lineHeight: 46, textAlign: "center" },
  weekRange: { fontSize: 10, marginTop: 2, textAlign: "center" },
  badges:    { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8, justifyContent: "center" },
  badge:     { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  badgeText: { fontSize: 11, opacity: 0.75 },
  footnote:  { fontSize: 11, lineHeight: 15, textAlign: "center" },
  emptyHint: { fontSize: 12, lineHeight: 18, textAlign: "center", paddingHorizontal: 12, marginBottom: 4 },
});
