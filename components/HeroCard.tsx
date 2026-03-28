// ============================================================
// HeroCard — Calm, trustworthy design for daily utility use
// v3: reduced padding, tinted bg, de-emphasised hint
// ============================================================

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { HourSlot, CheapWindow } from "../lib/types";
import {
  statusToLabel,
  statusToEmoji,
  statusToBorderColor,
} from "../lib/classify";
import { useTheme } from "../lib/theme";
import { useI18n } from "../lib/i18n";

interface Props {
  current: HourSlot | null;
  nextCheap: CheapWindow | null;
  cheapUntilHour: number | null;
}



function buildHint(
  current: HourSlot | null,
  nextCheap: CheapWindow | null,
  cheapUntilHour: number | null,
  lang: "de" | "en"
): string {
  const status = current?.status ?? "UNKNOWN";
  if (status === "UNKNOWN") return lang === "en" ? "Loading prices …" : "Daten werden geladen …";
  if (status === "GREEN") {
    if (cheapUntilHour !== null)
      return lang === "en"
        ? `Cheap until ${cheapUntilHour}:00`
        : `Günstig noch bis ${cheapUntilHour}:00 Uhr`;
    return lang === "en"
      ? "Good time to run appliances"
      : "Günstige Phase – jetzt ideal zum Waschen";
  }
  if (nextCheap?.date === "today") {
    const ct = nextCheap.avgCt.toFixed(1).replace(".", ",");
    return lang === "en"
      ? `Cheaper from ${nextCheap.label} · ø ${ct} ct`
      : `Ab ${nextCheap.label} günstiger · ø ${ct} ct`;
  }
  if (nextCheap?.date === "tomorrow") {
    const ct = nextCheap.avgCt.toFixed(1).replace(".", ",");
    return lang === "en"
      ? `Tomorrow: cheaper from ${nextCheap.label} · ø ${ct} ct`
      : `Morgen: günstiger ab ${nextCheap.label} · ø ${ct} ct`;
  }
  return status === "RED"
    ? (lang === "en" ? "No cheaper phase today" : "Heute keine günstigere Phase mehr")
    : (lang === "en" ? "Prices fairly stable today" : "Kaum Preisunterschied heute");
}

export default function HeroCard({ current, nextCheap, cheapUntilHour }: Props) {
  const T      = useTheme();
  const { lang } = useI18n();
  const status = current?.status ?? "UNKNOWN";
  const accentColor = statusToBorderColor(status);
  const label  = statusToLabel(status, lang);
  const emoji  = statusToEmoji(status);
  const hint   = buildHint(current, nextCheap, cheapUntilHour, lang);
  const price  = current?.priceCt?.toFixed(1).replace(".", ",") ?? "–";

  return (
    <View style={[styles.card, { backgroundColor: T.bg, borderColor: T.border }]}>
      {/* Accent bar — 3px, status colour */}
      <View style={[styles.accentBar, { backgroundColor: accentColor }]} />

      {/* Inner — screen bg tone, widget-style */}
      <View style={[styles.inner, { backgroundColor: T.bg }]}>
        {/* Status row */}
        <View style={styles.statusRow}>
          <Text style={styles.emoji}>{emoji}</Text>
          <Text style={[styles.statusLabel, { color: T.text }]}>{label}</Text>
        </View>

        {/* Price — large number / small unit split */}
        <View style={styles.priceRow}>
          <Text style={[styles.price, { color: T.text }]}>{price}</Text>
          <Text style={[styles.unit, { color: T.sub }]}> ct/kWh</Text>
        </View>

        {/* Hint — small, subdued */}
        <Text style={[styles.hint, { color: T.sub }]}>{hint}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14, borderWidth: 1,
    marginTop: 10, overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  accent: {
    position: "absolute", top: 0, left: 0, right: 0, height: 3,
    backgroundColor: "#16a34a",
  },
  accentBar:   { height: 3, width: "100%" },
  inner:       { paddingVertical: 18, paddingHorizontal: 24, alignItems: "center" },
  statusRow:   { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  emoji:       { fontSize: 18 },
  statusLabel: { fontSize: 15, fontWeight: "600", letterSpacing: 0.2 },
  // Price: number and unit on same baseline row
  priceRow:    { flexDirection: "row", alignItems: "flex-end", marginBottom: 8 },
  price:       { fontSize: 48, fontWeight: "700", letterSpacing: -1, lineHeight: 52 },
  unit:        { fontSize: 16, fontWeight: "400", paddingBottom: 6 },
  // Hint: small, low-emphasis
  hint:        { fontSize: 12, textAlign: "center", lineHeight: 17, opacity: 0.8 },
});
