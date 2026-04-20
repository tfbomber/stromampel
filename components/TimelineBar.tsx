// ============================================================
// TimelineBar — Controlled component (activeHour lifted to parent)
// v4: Dual-zone bar chart with zero baseline
//
// Layout (when negative prices exist):
//   ┌──────────────────────────────┐ ← top of container
//   │  positive zone (flex to top) │   bars grow downward from top... wait
//   │  [bar]          [bar] [bar]  │   actually flex-end (grow UP from zero line)
//   ├──── zero line ───────────────┤ ← price = 0 reference
//   │  negative zone               │   bars grow DOWN from zero line
//   │         [bar]                │
//   └──────────────────────────────┘
//
// When all prices are positive: zero line is at the bottom (not drawn),
// layout is identical to previous version.
// ============================================================

import React, { useRef, useCallback, useEffect } from "react";
import { View, Text, Pressable, StyleSheet, PanResponder, LayoutChangeEvent } from "react-native";
import * as Haptics from "expo-haptics";
import type { HourSlot } from "../lib/types";
import { statusToSlotColor, priceToGradientColor } from "../lib/classify";
import { useTheme } from "../lib/theme";
import { useI18n } from "../lib/i18n";

interface Props {
  slots:              HourSlot[];
  isToday:            boolean;
  activeHour:         number | null;
  onActiveHourChange: (hour: number | null) => void;
  /** Optional surcharge (ct/kWh) to show effective price in tooltip bubble.
   *  When provided, bubble shows ≈ (spot + surcharge) ct instead of raw spot. */
  surchargeCt?:       number;
}

const LABEL_HOURS  = [0, 6, 12, 18, 23];
const SLOTS        = 24;
const CONTAINER_H  = 50;   // total bar area (px); same whether mixed or all-positive
const BAR_MIN_PX   = 3;    // minimum visible bar height for any non-zero price
const ZERO_LINE_H  = 1.5;  // height of the zero reference line (only when negative prices exist)
const NEG_COLOR    = "#0ea5e9"; // sky-blue for below-zero bars (distinct from green-red spectrum)

export default function TimelineBar({ slots, isToday, activeHour, onActiveHourChange, surchargeCt }: Props) {
  const T           = useTheme();
  const { lang }    = useI18n();
  const barWidth    = useRef(0);
  const activeSlot  = slots.find((s) => s.hour === activeHour) ?? null;
  const activeIndex = slots.findIndex((s) => s.hour === activeHour);

  // Current hour — for "Jetzt" marker (today only)
  const nowHour    = new Date().getHours();
  const nowFraction = nowHour / 24;

  const onChangeRef = useRef(onActiveHourChange);
  useEffect(() => { onChangeRef.current = onActiveHourChange; }, [onActiveHourChange]);

  // Use effective prices (spot + surcharge) for all bar geometry and colour.
  // When surchargeCt is omitted (e.g. NotifySheet picker), sc=0 → identical to previous behaviour.
  const sc        = surchargeCt ?? 0;
  const allPrices = slots.filter((s) => s.priceCt !== null).map((s) => s.priceCt! + sc);
  const dayMin    = allPrices.length > 0 ? Math.min(...allPrices) : 0;
  const dayMax    = allPrices.length > 0 ? Math.max(...allPrices) : 0;

  // ── Zone geometry ─────────────────────────────────────────────
  const hasMixed  = dayMin < 0; // any price is negative → draw zero line + two zones
  // Positive and negative ranges (always >= 0)
  const posRange  = Math.max(dayMax, 0);
  const negRange  = Math.max(-dayMin, 0);
  const totalRange = posRange + negRange; // total visible range (≠ dayMax - dayMin when dayMin > 0)

  // Heights of the two zones (proportional to their price range)
  // When hasMixed=false → topH = CONTAINER_H, botH = 0 (no split)
  const topH = hasMixed && totalRange > 0
    ? Math.round(CONTAINER_H * posRange / totalRange)
    : CONTAINER_H;
  const botH = hasMixed && totalRange > 0
    ? CONTAINER_H - topH
    : 0;

  // ── SpreadRatio: prevent false visual impression on flat-price days ──────────
  // actualSpread = full day price range (effective prices, spot + surcharge)
  // REFERENCE_SPREAD = typical German intra-day spread (10 ct/kWh)
  // spreadRatio = 0 → all bars same height; 1 → full height variation
  const REFERENCE_SPREAD = 10;
  const actualSpread  = dayMax - dayMin;             // always >= 0
  const spreadRatio   = Math.min(1, actualSpread > 0 ? actualSpread / REFERENCE_SPREAD : 0);

  // Positive zone: base height + variable height range (both anchored to topH)
  const posBaseH    = Math.round((hasMixed ? topH : CONTAINER_H) * 0.18);
  const posCapH     = Math.round((hasMixed ? topH : CONTAINER_H) * 0.80 * spreadRatio);
  // Negative zone: same logic for botH
  const negBaseH    = Math.round(botH * 0.18);
  const negCapH     = Math.round(botH * 0.80 * spreadRatio);
  // Minimum bar height for positive price > 0 (overrides base when base is tiny)
  const posMinBarH  = Math.max(BAR_MIN_PX, posBaseH);
  const negMinBarH  = Math.max(BAR_MIN_PX, negBaseH);
  // Positive price floor for normalization: clamp dayMin to 0 (negative prices don't affect pos baseline)
  const posMin      = Math.max(dayMin, 0);

  // ── Bar height computation ────────────────────────────────────
  function barHeights(
    slot: HourSlot,
    isActive: boolean
  ): { above: number; below: number } {
    if (slot.priceCt === null) return { above: 0, below: 0 };
    const p = slot.priceCt + sc;   // effective price (spot + surcharge)

    const scale = isActive ? 1.18 : 1.0;  // subtle active scale (was 1.25, reduced for var-height compat)

    if (p >= 0) {
      if (posRange === 0) return { above: posMinBarH, below: 0 };  // all-same-price day → equal bars
      // Normalize within positive range: t=0 (cheapest positive) → t=1 (most expensive)
      const t = Math.max(0, Math.min(1, (p - posMin) / posRange));
      const h = Math.round((posBaseH + posCapH * t) * scale);
      return { above: p > 0 ? Math.min(topH, Math.max(posMinBarH, h)) : 0, below: 0 };
    } else {
      // Negative price: grows downward from zero line
      if (negRange === 0) return { above: 0, below: negMinBarH };
      const t = Math.max(0, Math.min(1, Math.abs(p) / negRange));
      const h = Math.round((negBaseH + negCapH * t) * scale);
      return { above: 0, below: Math.min(botH, Math.max(negMinBarH, h)) };
    }
  }

  // ── Bar colour ────────────────────────────────────────────────
  function barColor(slot: HourSlot): string {
    if (slot.isPast) return (T as any).barPast ?? "#d1d5db";
    if (slot.priceCt === null) return statusToSlotColor(slot.status);
    const ep = slot.priceCt + sc;   // effective price
    if (ep < 0) return NEG_COLOR;   // only truly negative when spot < -surchargeCt
    // Gradient mapped to effective price range (dayMin/dayMax are already effective)
    return priceToGradientColor(ep, dayMin, dayMax, slot.status);
  }

  const getHour = useCallback((x: number) => {
    const w = barWidth.current;
    if (w <= 0) return 0;
    return Math.min(SLOTS - 1, Math.floor((Math.max(0, Math.min(x, w - 1)) / w) * SLOTS));
  }, []);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder:  (_, g) => Math.abs(g.dx) > Math.abs(g.dy) + 4,
      onPanResponderGrant:    (e) => onChangeRef.current(getHour(e.nativeEvent.locationX)),
      onPanResponderMove:     (e) => onChangeRef.current(getHour(e.nativeEvent.locationX)),
      onPanResponderRelease:  () => onChangeRef.current(null),
      onPanResponderTerminate:() => onChangeRef.current(null),
    })
  ).current;

  if (!slots || slots.length === 0) {
    return <Text style={{ color: T.sub, textAlign: "center" }}>Keine Daten</Text>;
  }

  const tapHint = lang === "de" ? "Tippen für Details" : "Tap for details";

  return (
    <View style={styles.wrapper}>

      {/* Price bubble (shows when a bar is selected) */}
      <View style={styles.labelArea}>
        {activeSlot ? (
          <View style={[styles.bubble, {
            backgroundColor: T.bubble,
            left: `${Math.max(5, Math.min(((activeIndex + 0.5) / SLOTS) * 100, 85))}%` as unknown as number,
          }]}>
            <Text style={[styles.bubbleText, { color: T.bubbleText }]}>
              {activeSlot.hour}:00
              {activeSlot.priceCt !== null
                ? surchargeCt != null
                  // Show effective price with ≈ prefix
                  ? ` · ≈ ${(activeSlot.priceCt + surchargeCt).toFixed(1).replace(".", ",")} ct`
                  : ` · ${activeSlot.priceCt.toFixed(1).replace(".", ",")} ct`
                : " · –"}
            </Text>
          </View>
        ) : (
          <Text style={[styles.tapHint, { color: T.sub }]}>{tapHint}</Text>
        )}
      </View>

      {/* Bar container with gesture */}
      <View
        style={[styles.barContainer, {
          // Total physical height = CONTAINER_H + optional zero line
          height: CONTAINER_H + (hasMixed ? ZERO_LINE_H : 0),
        }]}
        onLayout={(e: LayoutChangeEvent) => { barWidth.current = e.nativeEvent.layout.width; }}
        {...pan.panHandlers}
      >
        {/* "Jetzt" vertical indicator — today only, absolute positioned */}
        {isToday && (
          <View
            style={[styles.nowLine, {
              left: `${nowFraction * 100}%` as unknown as number,
              backgroundColor: "#f59e0b",
            }]}
          >
            <Text style={[styles.nowLabel, { color: "#f59e0b" }]}>▾</Text>
          </View>
        )}

        {/* Columns */}
        {slots.map((slot) => {
          const isActive = slot.hour === activeHour;
          const { above, below } = barHeights(slot, isActive);
          const color = barColor(slot);

          return (
            <Pressable
              key={slot.hour}
              style={({ pressed }) => ({
                flex: 1,
                height: "100%",
                flexDirection: "column",
                opacity: slot.isPast ? 0.45 : pressed ? 0.75 : 1,
              })}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                onActiveHourChange(isActive ? null : slot.hour);
              }}
            >
              {/* ── Positive (above-zero) zone ── */}
              <View style={{ height: topH, justifyContent: "flex-end" }}>
                {above > 0 && (
                  <View style={{
                    height: above,
                    backgroundColor: color,
                    borderTopLeftRadius: 3,
                    borderTopRightRadius: 3,
                    borderWidth: isActive ? 1.5 : 0,
                    borderColor: isActive ? T.bubble : "transparent",
                  }} />
                )}
              </View>

              {/* ── Zero baseline line (only when negative prices exist) ── */}
              {hasMixed && (
                <View style={{
                  height: ZERO_LINE_H,
                  backgroundColor: "#94a3b8",
                  opacity: 0.30,
                }} />
              )}

              {/* ── Negative (below-zero) zone ── */}
              {hasMixed && (
                <View style={{ height: botH, justifyContent: "flex-start" }}>
                  {below > 0 && (
                    <View style={{
                      height: below,
                      backgroundColor: color,
                      borderBottomLeftRadius: 3,
                      borderBottomRightRadius: 3,
                      borderWidth: isActive ? 1.5 : 0,
                      borderColor: isActive ? T.bubble : "transparent",
                    }} />
                  )}
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {/* Hour labels */}
      <View style={styles.labelsRow}>
        {LABEL_HOURS.map((h) => (
          <Text key={h} style={[styles.hourLabel, {
            color: T.sub,
            position: "absolute",
            left: `${(h / 23) * 100}%` as unknown as number,
          }]}>
            {h}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper:    { width: "100%", marginTop: 10 },
  labelArea:  { height: 32, position: "relative", justifyContent: "flex-end", marginBottom: 3 },
  tapHint:    { fontSize: 10, textAlign: "right", opacity: 0.45, paddingBottom: 2 },
  bubble: {
    position: "absolute", bottom: 2,
    transform: [{ translateX: -40 }],
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7,
  },
  bubbleText: { fontSize: 11, fontWeight: "600" } as any,
  barContainer: {
    flexDirection: "row",
    // height set inline (depends on hasMixed)
    alignItems:    "stretch",    // each column manages its own zones
    borderRadius:  8,
    overflow:      "hidden",
    gap:           1.5,
    backgroundColor: "transparent",
    position:      "relative",
  },
  nowLine: {
    position: "absolute",
    bottom:   0,
    width:    2,
    top:      0,
    zIndex:   10,
    opacity:  0.78,
  },
  nowLabel: {
    position:  "absolute",
    top:       -14,
    fontSize:  10,
    transform: [{ translateX: -3 }],
    opacity:   0.6,
  },
  labelsRow: { height: 16, position: "relative", marginTop: 3 },
  hourLabel: { fontSize: 10, transform: [{ translateX: -4 }] },
});
