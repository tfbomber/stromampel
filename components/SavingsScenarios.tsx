// ============================================================
// SavingsScenarios — Passive savings hint card
// Replaces DeviceSavings + SavingsSummary (click-to-claim model).
//
// Logic:
//   GREEN  → encouraging banner only (no diff to show)
//   YELLOW/RED + nextCheap → scenario comparison: NOW vs best window
//   YELLOW/RED + no nextCheap → soft fallback message
//   UNKNOWN → null render
//
// Calculation:
//   diff_ct  = currentPriceCt − nextCheap.coreAvgCt   (surcharge cancels out)
//   savingEur = diff_ct × kWh / 100
//   Range display: × 0.8 to × 1.2  (honest ±20% estimation band)
// ============================================================

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { CheapWindow } from "../lib/types";
import { useTheme } from "../lib/theme";
import { useI18n } from "../lib/i18n";

// ── Scenario definitions ─────────────────────────────────────
const SCENARIOS = [
  {
    emoji:    "🏠",
    labelDe:  "Haushalt",
    labelEn:  "Household",
    detailDe: "Waschmaschine · Trockner · Spülmaschine",
    detailEn: "Washing machine · Dryer · Dishwasher",
    kWh:      5.4,   // 1.2 + 3.0 + 1.2
  },
  {
    emoji:    "🚗",
    labelDe:  "E-Auto Laden",
    labelEn:  "EV Charging",
    detailDe: "Ca. 20 kWh Ladung",
    detailEn: "Approx. 20 kWh charge",
    kWh:      20.0,
  },
] as const;

// ── Range band (±20%) ───────────────────────────────────────
const BAND_LO = 0.80;
const BAND_HI = 1.20;

// ── Helpers ─────────────────────────────────────────────────
function formatEur(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

function savingsRange(diffCt: number, kWh: number): { lo: string; hi: string } {
  const base = (diffCt * kWh) / 100;
  return {
    lo: formatEur(base * BAND_LO),
    hi: formatEur(base * BAND_HI),
  };
}

// ── Props ────────────────────────────────────────────────────
interface Props {
  currentPriceCt: number | null;
  nextCheap:      CheapWindow | null;
  currentStatus:  string;   // "GREEN" | "YELLOW" | "RED" | "UNKNOWN"
  tariffType?:    string;   // "fixed" | "dynamic" — hide for fixed
}

// ── Component ────────────────────────────────────────────────
export default function SavingsScenarios({
  currentPriceCt,
  nextCheap,
  currentStatus,
  tariffType,
}: Props) {
  const T          = useTheme();
  const { lang }   = useI18n();

  // Fixed-tariff users: spot comparison is meaningless
  if (tariffType === "fixed") return null;
  // No price data yet
  if (currentStatus === "UNKNOWN" || currentPriceCt === null) return null;

  // GREEN: HeroCard already signals cheapest period — no redundant card needed
  if (currentStatus === "GREEN") return null;

  // ── YELLOW / RED ─────────────────────────────────────────
  // No upcoming cheap window
  if (!nextCheap) {
    return (
      <View style={[styles.card, { backgroundColor: T.card, overflow: "hidden" }]}>
        <View style={styles.grayAccent} />
        <Text style={[styles.noWindowText, { color: T.sub }]}>
          {lang === "en"
            ? "ℹ️  No cheaper window today — prices are fairly stable."
            : "ℹ️  Kein günstigeres Fenster heute mehr – Preise überwiegend konstant."}
        </Text>
      </View>
    );
  }

  // Diff in ct/kWh between now and the best 3h core block
  const diffCt = currentPriceCt - nextCheap.coreAvgCt;

  // If current is already cheaper than best window, nothing to show
  const anyVisible = SCENARIOS.some((s) => diffCt * s.kWh > 0);
  if (!anyVisible) return null;

  const windowLabel = nextCheap.date === "today"
    ? (lang === "en" ? `from ${nextCheap.coreLabel}` : `ab ${nextCheap.coreLabel}`)
    : (lang === "en" ? `tomorrow ${nextCheap.coreLabel}` : `morgen ${nextCheap.coreLabel}`);

  return (
    <View style={[styles.card, { backgroundColor: T.card, overflow: "hidden" }]}>
      {/* Accent bar — amber for wait signal */}
      <View style={styles.amberAccent} />

      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.headerEmoji}>⏰</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: "#b45309" }]}>
            {lang === "en" ? "Worth waiting!" : "Warten lohnt sich!"}
          </Text>
          <Text style={[styles.headerSub, { color: T.sub }]}>
            {lang === "en"
              ? `Cheaper ${windowLabel} – estimated savings:`
              : `Günstiger ${windowLabel} – voraussichtliche Ersparnis:`}
          </Text>
        </View>
      </View>

      {/* Scenario rows */}
      <View style={styles.scenarioBlock}>
        {SCENARIOS.map((s) => {
          const savingCt = diffCt * s.kWh;
          // Hide scenarios where saving is negligible (< 0.05 EUR = 5 ct)
          if (savingCt < 5) return null;

          const range = savingsRange(diffCt, s.kWh);
          const label  = lang === "en" ? s.labelEn  : s.labelDe;
          const detail = lang === "en" ? s.detailEn : s.detailDe;

          return (
            <View key={s.labelDe} style={[styles.scenarioRow, { borderTopColor: T.border }]}>
              <Text style={styles.scenarioEmoji}>{s.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.scenarioLabel, { color: T.text }]}>{label}</Text>
                <Text style={[styles.scenarioDetail, { color: T.sub }]}>{detail}</Text>
              </View>
              <View style={styles.savingBadge}>
                <Text style={styles.savingRange}>
                  ~{range.lo} € – {range.hi} €
                </Text>
                <Text style={styles.savingCheaper}>
                  {lang === "en" ? "cheaper" : "günstiger"}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  card: {
    borderRadius: 14, padding: 16, marginTop: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  // Accent bars
  greenAccent: {
    position: "absolute", top: 0, left: 0, right: 0, height: 3,
    backgroundColor: "#16a34a",
  },
  amberAccent: {
    position: "absolute", top: 0, left: 0, right: 0, height: 3,
    backgroundColor: "#f59e0b",
  },
  grayAccent: {
    position: "absolute", top: 0, left: 0, right: 0, height: 3,
    backgroundColor: "#d1d5db",
  },
  // GREEN banner
  greenBanner:  { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 4 },
  bigEmoji:     { fontSize: 24 },
  bannerTitle:  { fontSize: 14, fontWeight: "700", marginBottom: 3 },
  bannerSub:    { fontSize: 12, lineHeight: 17 },
  // YELLOW/RED header
  headerRow:    { flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 4, marginBottom: 12 },
  headerEmoji:  { fontSize: 20, marginTop: 2 },
  headerTitle:  { fontSize: 14, fontWeight: "700", marginBottom: 2 },
  headerSub:    { fontSize: 12, lineHeight: 17 },
  // Scenario rows
  scenarioBlock: { gap: 0 },
  scenarioRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  scenarioEmoji:  { fontSize: 20, width: 26, textAlign: "center" },
  scenarioLabel:  { fontSize: 13, fontWeight: "600", marginBottom: 1 },
  scenarioDetail: { fontSize: 11, lineHeight: 15 },
  // Saving badge (right-aligned)
  savingBadge:   { alignItems: "flex-end" },
  savingRange:   { fontSize: 13, fontWeight: "700", color: "#15803d" },
  savingCheaper: { fontSize: 10, color: "#15803d", opacity: 0.75, marginTop: 1 },
  // Fallback
  noWindowText: { fontSize: 12, lineHeight: 18, paddingTop: 4 },
  // Footnote
  footnote: { fontSize: 10, lineHeight: 14, marginTop: 10, opacity: 0.6 },
});
