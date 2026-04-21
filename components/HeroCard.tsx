// ============================================================
// HeroCard — v7: All prices show effective (Spot + surchargeCt)
//
// Layout:
//   🟢 Jetzt günstig
//       ≈ 29 ct/kWh          ← Effective price (large, for decision making)
//   ℹ️  (tap → shows Spot 6,3 ct + surcharge explanation)
//   Günstigste Phase: 13–16 Uhr · ø ≈ 27 ct
//
// Classification (GREEN/YELLOW/RED) stays spot-based internally.
// Spot only visible via ℹ️ tooltip — not shown by default.
// ============================================================

import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, LayoutAnimation } from "react-native";
import * as Haptics from "expo-haptics";
import type { HourSlot, CheapWindow } from "../lib/types";
import {
  statusToLabel,
  statusToEmoji,
  statusToBorderColor,
} from "../lib/classify";
import { useTheme } from "../lib/theme";
import { useI18n } from "../lib/i18n";

interface Props {
  current:      HourSlot | null;
  nextCheap:    CheapWindow | null;
  surchargeCt:  number;
  /** @deprecated kept for call-site compat */
  cheapUntilHour?: number | null;
}

/** Hint parts for mixed-style Text rendering. */
interface HintParts {
  prefix: string;
  time:   string;
}

function buildHintParts(
  current:     HourSlot | null,
  nextCheap:   CheapWindow | null,
  surchargeCt: number,
  lang:        "de" | "en"
): HintParts | { plain: string } {
  const status = current?.status ?? "UNKNOWN";

  if (status === "UNKNOWN") {
    return { plain: lang === "en" ? "Loading prices …" : "Daten werden geladen …" };
  }

  if (nextCheap) {
    const label  = nextCheap.coreLabel;

    if (status === "GREEN") {
      const dayPrefix = nextCheap.date === "tomorrow"
        ? (lang === "en" ? "Tomorrow · " : "Morgen · ")
        : "";
      return {
        prefix: lang === "en" ? "Best: " : "Beste: ",
        time:   `${dayPrefix}${label}`,
      };
    }
    if (nextCheap.date === "today") {
      return {
        prefix: lang === "en" ? "Cheaper from " : "Günstiger ab ",
        time:   label,
      };
    }
    return {
      prefix: lang === "en" ? "Tomorrow: " : "Morgen: ",
      time:   label,
    };
  }

  return {
    plain: status === "RED"
      ? (lang === "en" ? "No cheaper phase today" : "Heute keine günstigere Phase mehr")
      : (lang === "en" ? "Prices fairly stable today" : "Kaum Preisunterschied heute"),
  };
}

export default function HeroCard({ current, nextCheap, surchargeCt }: Props) {
  const T           = useTheme();
  const { lang }    = useI18n();
  const [showTooltip, setShowTooltip] = useState(false);

  const status      = current?.status ?? "UNKNOWN";
  const accentColor = statusToBorderColor(status);
  const label       = statusToLabel(status, lang);
  const emoji       = statusToEmoji(status);

  // Spot price (raw, classification basis — only shown in tooltip)
  const spotCt      = current?.priceCt ?? null;

  // Effective price = Spot + surcharge (what the user actually pays ≈)
  const effectiveCt   = spotCt !== null ? spotCt + surchargeCt : null;
  // Split into parts for mixed-size rendering: prefix "≈", main number, unit "ct"
  const effectiveNum   = effectiveCt !== null
    ? effectiveCt.toFixed(1).replace(".", ",")
    : "–";
  const effectiveNote = lang === "en"
    ? `incl. ~${surchargeCt} ct fees`
    : `inkl. ~${surchargeCt} ct Aufschlag`;
  const spotLabel = spotCt !== null
    ? `${spotCt.toFixed(1).replace(".", ",")} ct`
    : "–";

  const hintParts = buildHintParts(current, nextCheap, surchargeCt, lang);
  const isPlain   = "plain" in hintParts;

  function toggleTooltip() {
    Haptics.selectionAsync().catch(() => {});
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowTooltip(v => !v);
  }

  return (
    <View style={[styles.card, { backgroundColor: T.card, borderColor: T.border }]}> 
      {/* Accent bar */}
      <View style={[styles.accentBar, { backgroundColor: accentColor }]} />

      <View style={[styles.inner, { backgroundColor: T.card }]}> 

        {/* Status row */}
        <View style={styles.statusRow}>
          <Text style={styles.emoji}>{emoji}</Text>
          <Text style={[styles.statusLabel, { color: T.text }]}>{label}</Text>
        </View>

        {/* Effective price — large, primary. Mixed sizes: ≈ small | number big | ct small */}
        <View style={styles.priceRow}>
          {/* ≈ prefix — small, dimmed */}
          {effectiveCt !== null && (
            <Text style={[styles.pricePrefix, { color: T.sub }]}>≈</Text>
          )}
          <Text style={[styles.price, { color: T.text }]}>{effectiveNum}</Text>
          {/* unit block: ct and /kWh stacked small */}
          <View style={styles.unitBlock}>
            <Text style={[styles.unitCt, { color: T.sub }]}>ct</Text>
            <Text style={[styles.unitKwh, { color: T.sub }]}>/kWh</Text>
          </View>
          {/* ℹ️ tappable — reveals Spot price */}
          <Pressable onPress={toggleTooltip} hitSlop={10} style={styles.infoBtn}>
            <Text style={[styles.infoIcon, { color: T.sub }]}>ℹ️</Text>
          </Pressable>
        </View>

        <Text style={[styles.effectiveNote, { color: T.sub }]}>{effectiveNote}</Text>

        {/* Tooltip — Spot price + surcharge explanation (concise) */}
        {showTooltip && (
          <View style={[styles.tooltip, { backgroundColor: T.card, borderColor: T.border }]}> 
            <Text style={[styles.tooltipText, { color: T.sub }]}> 
              {lang === "en"
                ? `Spot only: ${spotLabel}`
                : `Nur Spot: ${spotLabel}`}
            </Text>
          </View>
        )}

        {/* Hint line — time bold + status color, price effective */}
        {isPlain ? (
          <Text style={[styles.hint, { color: T.sub }]}>
            {(hintParts as { plain: string }).plain}
          </Text>
        ) : (
          <Text style={[styles.hint, { color: T.sub }]}> 
            {(hintParts as HintParts).prefix}
            <Text style={[styles.hintTime, { color: accentColor }]}> 
              {(hintParts as HintParts).time}
            </Text>
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    marginTop: 8, overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  accentBar:   { height: 3, width: "100%" },
  inner:       { paddingVertical: 16, paddingHorizontal: 20, alignItems: "center" },
  statusRow:   { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  emoji:       { fontSize: 18 },
  statusLabel: { fontSize: 14, fontWeight: "600", letterSpacing: 0.2 },
  // Effective price (large) + ℹ️
  priceRow:    { flexDirection: "row", alignItems: "flex-end", marginBottom: 4, gap: 3 },
  pricePrefix: { fontSize: 16, fontWeight: "400", paddingBottom: 9, opacity: 0.55 },
  price:       { fontSize: 52, fontWeight: "800", letterSpacing: -1.8, lineHeight: 56 },
  unitBlock:   { paddingBottom: 8, paddingLeft: 2, justifyContent: "flex-end" },
  unitCt:      { fontSize: 13, fontWeight: "600", lineHeight: 15, opacity: 0.75 },
  unitKwh:     { fontSize: 10, fontWeight: "400", lineHeight: 12, opacity: 0.5 },
  infoBtn:     { paddingBottom: 5, paddingLeft: 5 },
  infoIcon:    { fontSize: 13, opacity: 0.45 },
  effectiveNote: { fontSize: 11, lineHeight: 15, marginBottom: 8, opacity: 0.72 },
  // Tooltip — compact, single line
  tooltip: {
    borderWidth: 1, borderRadius: 8,
    paddingVertical: 6, paddingHorizontal: 10, marginBottom: 8, marginTop: -4,
  },
  tooltipText: { fontSize: 10, lineHeight: 14, textAlign: "center" },
  // Hint
  hint:      { fontSize: 12, textAlign: "center", lineHeight: 18, opacity: 0.9 },
  hintTime:  { fontWeight: "800", fontSize: 12 },
});
